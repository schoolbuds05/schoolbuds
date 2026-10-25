<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class TeacherSubjectEligibility extends Model
{
    protected $fillable = [
        'teacher_id', 'subject_id', 'department_id', 'status', 'source',
        'qualification', 'remarks', 'reviewed_by', 'reviewed_at',
    ];

    protected $casts = ['reviewed_at' => 'datetime'];

    public function teacher()
    {
        return $this->belongsTo(User::class, 'teacher_id');
    }

    public function subject()
    {
        return $this->belongsTo(Subject::class);
    }

    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    // Only current approvals for active subjects/departments may be used by a scheduler.
    public function scopeEligible(Builder $query): Builder
    {
        return $query->where('status', 'approved')
            ->whereHas('teacher', fn ($teachers) => $teachers->teachingFaculty())
            ->whereHas('subject', fn ($subjects) => $subjects->where('is_active', true)
                ->whereColumn('subjects.department_id', 'teacher_subject_eligibilities.department_id')
                ->whereHas('department', fn ($departments) => $departments->where('is_active', true)));
    }
}
