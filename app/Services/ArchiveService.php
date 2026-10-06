<?php

namespace App\Services;

use App\Models\ArchivedRecord;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Arr;

class ArchiveService
{
    public static function record(Model $model, ?int $deletedBy = null, ?string $source = null, ?string $label = null, array $extra = []): ArchivedRecord
    {
        $model->loadMissing(self::relationsFor($model));

        return ArchivedRecord::create([
            'record_type' => class_basename($model),
            'record_id' => $model->getKey(),
            'label' => $label ?: self::labelFor($model),
            'payload' => [
                'attributes' => $model->getAttributes(),
                'relations' => Arr::except($model->toArray(), array_keys($model->getAttributes())),
                'extra' => $extra,
            ],
            'deleted_by' => $deletedBy,
            'source' => $source,
            'deleted_at' => now(),
        ]);
    }

    private static function relationsFor(Model $model): array
    {
        return match (class_basename($model)) {
            'User' => ['roles', 'permissions'],
            'Student' => ['user', 'parent', 'grades', 'attendances', 'fees', 'rewards'],
            'Subject' => ['sectionSubjects.section', 'sectionSubjects.teacher', 'prerequisites', 'requiredBy'],
            'Section' => ['sectionSubjects.subject', 'sectionSubjects.teacher', 'students'],
            'Course' => [],
            'SectionSubject' => ['section', 'subject', 'teacher'],
            default => [],
        };
    }

    private static function labelFor(Model $model): ?string
    {
        return match (class_basename($model)) {
            'Subject' => trim(($model->code ?? '') . ' - ' . ($model->name ?? '')),
            'Section' => $model->name ?? null,
            'Course' => $model->name ?? null,
            'User' => trim(($model->name ?? '') . ' - ' . ($model->email ?? '')),
            'Student' => trim(($model->student_id ?? '') . ' - ' . ($model->first_name ?? '') . ' ' . ($model->last_name ?? '')),
            'SectionSubject' => trim(($model->section?->name ?? 'Section') . ' - ' . ($model->subject?->code ?? 'Subject')),
            default => method_exists($model, 'getKey') ? (string) $model->getKey() : null,
        };
    }
}
