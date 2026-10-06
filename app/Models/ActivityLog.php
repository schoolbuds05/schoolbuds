<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

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
            'meta' => $options['meta'] ?? null,
        ]);
    }
}
