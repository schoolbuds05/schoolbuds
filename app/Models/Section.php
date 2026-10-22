<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Section extends Model
{
    protected $fillable = [
        'name', 'course', 'year_level', 'program_type',
        'strand', 'school_year', 'semester',
        'max_students', 'is_active', 'workflow_status', 'workflow_remarks',
        'department_id', 'created_by', 'reviewed_by', 'submitted_at', 'reviewed_at',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'submitted_at' => 'datetime',
        'reviewed_at' => 'datetime',
    ];

    // Subjects assigned to this section (with schedule)
    public function sectionSubjects()
    {
        return $this->hasMany(SectionSubject::class);
    }

    // Students enrolled in this section
    public function students()
    {
        return $this->belongsToMany(User::class, 'section_students')
                    ->withPivot('status')
                    ->withTimestamps();
    }

    public function getStudentCountAttribute(): int
    {
        return $this->students()->wherePivot('status', 'enrolled')->count();
    }
}
