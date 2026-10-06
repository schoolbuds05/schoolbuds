<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SchoolClass extends Model
{
    protected $appends = ['is_college'];

    public function teacher()
    {
        return $this->belongsTo(User::class, 'teacher_id');
    }

    public function getIsCollegeAttribute(): bool
    {
        return Section::query()
            ->where('program_type', 'college')
            ->where('name', $this->section)
            ->where('year_level', $this->grade_level)
            ->where('school_year', $this->school_year)
            ->whereHas('sectionSubjects', fn ($query) => $query->whereHas(
                'subject',
                fn ($subjectQuery) => $subjectQuery->where('name', $this->subject)
            ))
            ->exists();
    }
}
