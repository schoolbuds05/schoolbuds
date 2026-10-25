<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Subject extends Model
{
    protected $fillable = [
        'code', 'name', 'description',
        'units_lec', 'units_lab',
        'program_type', 'course', 'year_level', 'strand', 'semester',
        'is_active', 'department_id',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'units_lec' => 'float',
        'units_lab' => 'float',
    ];

    protected static function booted(): void
    {
        static::updated(function (Subject $subject): void {
            if ($subject->wasChanged('department_id')) {
                $subject->teachingEligibilities()->whereIn('status', ['pending', 'approved'])->get()
                    ->each(fn (TeacherSubjectEligibility $eligibility) => $eligibility->update([
                        'status' => 'revoked',
                        'remarks' => 'Subject ownership changed. Approval by the new managing department is required.',
                    ]));
            }
        });
    }

    public function department()
    {
        return $this->belongsTo(Department::class);
    }

    public function teachingEligibilities()
    {
        return $this->hasMany(TeacherSubjectEligibility::class);
    }

    public function sectionSubjects()
    {
        return $this->hasMany(SectionSubject::class);
    }

    public function prerequisites()
    {
        return $this->belongsToMany(
            Subject::class,
            'subject_prerequisite',
            'subject_id',
            'prerequisite_id'
        );
    }

    public function requiredBy()
    {
        return $this->belongsToMany(
            Subject::class,
            'subject_prerequisite',
            'prerequisite_id',
            'subject_id'
        );
    }

    public function getTotalUnitsAttribute(): float
    {
        return $this->units_lec + $this->units_lab;
    }
}
