<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use DateTimeInterface;
use Stringable;

class ActivityLog extends Model
{
    protected $fillable = [
        'user_id',
        'actor_name',
        'actor_email',
        'actor_role',
        'action',
        'description',
        'subject_type',
        'subject_id',
        'ip_address',
        'user_agent',
        'meta',
    ];

    protected $casts = [
        'meta' => 'array',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public static function record(Request $request, string $action, string $description, array $options = []): self
    {
        $user = $options['user'] ?? $request->user();

        return self::create([
            'user_id' => $user?->id,
            'actor_name' => $user?->name,
            'actor_email' => $user?->email,
            'actor_role' => $user?->role,
            'action' => $action,
            'description' => $description,
            'subject_type' => $options['subject_type'] ?? null,
            'subject_id' => $options['subject_id'] ?? null,
            'ip_address' => $request->ip(),
            'user_agent' => substr((string) $request->userAgent(), 0, 1000),
            'meta' => self::normalizeAuditValue($options['meta'] ?? null),
        ]);
    }

    public static function recordModelChange(Model $model, string $event): void
    {
        if ($model instanceof self || !in_array($event, ['created', 'updated', 'deleted', 'restored'], true)) {
            return;
        }

        $attributes = $event === 'updated' || $event === 'restored'
            ? $model->getChanges()
            : $model->getAttributes();

        $changes = [];
        foreach ($attributes as $field => $value) {
            if (
                in_array($field, ['id', 'created_at', 'updated_at'], true)
                || ($field === 'deleted_at' && $event !== 'restored')
            ) {
                continue;
            }

            $redacted = self::isSensitiveField($field);
            $oldValue = $event === 'created' ? null : $model->getRawOriginal($field);
            $newValue = $event === 'deleted' ? null : $value;

            $changes[$field] = [
                'old' => $redacted ? '[REDACTED]' : self::normalizeAuditValue($oldValue),
                'new' => $redacted ? '[REDACTED]' : self::normalizeAuditValue($newValue),
            ];
        }

        if ($event === 'updated' && !$changes) {
            return;
        }

        self::record(
            request(),
            'model_' . $event,
            ucfirst($event) . ' ' . class_basename($model) . ' record #' . ($model->getKey() ?? 'unknown') . '.',
            [
                'subject_type' => $model::class,
                'subject_id' => $model->getKey(),
                'meta' => ['changes' => $changes],
            ]
        );
    }

    public static function recordRelationChange(Request $request, Model $subject, string $relation, array $before, array $after): void
    {
        $before = self::normalizeRelationSnapshot($before);
        $after = self::normalizeRelationSnapshot($after);

        if ($before === $after) {
            return;
        }

        self::record(
            $request,
            'relationship_updated',
            'Updated ' . $relation . ' relationship for ' . class_basename($subject) . ' record #' . ($subject->getKey() ?? 'unknown') . '.',
            [
                'subject_type' => $subject::class,
                'subject_id' => $subject->getKey(),
                'meta' => ['relation' => $relation, 'old' => $before, 'new' => $after],
            ]
        );
    }

    private static function normalizeRelationSnapshot(array $snapshot): array
    {
        if (array_is_list($snapshot)) {
            $snapshot = array_values(array_unique($snapshot));
            sort($snapshot);
            return $snapshot;
        }

        ksort($snapshot);
        return $snapshot;
    }

    private static function normalizeAuditValue(mixed $value, ?string $key = null): mixed
    {
        if ($value instanceof DateTimeInterface) {
            return $value->format(DateTimeInterface::ATOM);
        }

        if ($key !== null && self::isSensitiveField($key)) {
            if (is_array($value) && array_key_exists('old', $value) && array_key_exists('new', $value)) {
                return ['old' => '[REDACTED]', 'new' => '[REDACTED]'];
            }

            return '[REDACTED]';
        }

        if (is_array($value)) {
            foreach ($value as $key => $nestedValue) {
                $value[$key] = self::normalizeAuditValue($nestedValue, (string) $key);
            }
        }

        if ($value instanceof Stringable) {
            return (string) $value;
        }

        if (is_object($value)) {
            $normalized = json_decode(json_encode($value, JSON_PARTIAL_OUTPUT_ON_ERROR), true);
            return is_array($normalized) ? self::normalizeAuditValue($normalized) : $normalized;
        }

        return $value;
    }

    private static function isSensitiveField(string $field): bool
    {
        return preg_match('/password|passphrase|secret|token|api[_-]?key|remember|otp|verification|credential|authorization|cookie|private[_-]?key/i', $field) === 1;
    }
}
