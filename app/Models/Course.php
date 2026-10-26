<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\ValidationException;

class Course extends Model
{
    protected static function booted(): void
    {
        static::saving(function (Course $model): void {
            if ($model->department_id && Department::query()->whereKey($model->department_id)
                ->where('type', Department::TYPE_GENERAL)->exists()) {
                throw ValidationException::withMessages([
                    'department_id' => 'General subject departments cannot own courses or sections.',
                ]);
            }
        });

        static::updated(function (Course $course): void {
            if (! $course->wasChanged('department_id')) {
                return;
            }

            $scopes = array_values(array_filter([$course->name, $course->acronym]));
            if (! $scopes) {
                return;
            }

            Subject::query()
                ->where('program_type', 'college')
                ->whereIn('course', $scopes)
                ->get()
                ->each(fn (Subject $subject) => $subject->update(['department_id' => $course->department_id]));
        });
    }

    protected $fillable = [
        'name', 'acronym', 'description', 'program_type', 'department_id', 'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function department()
    {
        return $this->belongsTo(Department::class);
    }
}
