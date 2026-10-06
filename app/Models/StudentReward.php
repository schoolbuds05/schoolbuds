<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StudentReward extends Model
{
    protected $fillable = [
        'student_id',
        'awarded_by_id',
        'section_subject_id',
        'source',
        'source_key',
        'category',
        'title',
        'description',
        'points',
        'school_year',
        'semester',
        'meta',
    ];

    protected $casts = [
        'meta' => 'array',
        'points' => 'integer',
    ];

    public function student()
    {
        return $this->belongsTo(Student::class);
    }

    public function awardedBy()
    {
        return $this->belongsTo(User::class, 'awarded_by_id');
    }

    public function sectionSubject()
    {
        return $this->belongsTo(SectionSubject::class);
    }
}
