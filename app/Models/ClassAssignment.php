<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ClassAssignment extends Model
{
    protected $fillable = [
        'section_subject_id',
        'teacher_id',
        'type',
        'title',
        'instructions',
        'points_possible',
        'due_at',
        'allow_file_upload',
        'questions',
        'status',
    ];

    protected $casts = [
        'points_possible' => 'decimal:2',
        'due_at' => 'datetime',
        'allow_file_upload' => 'boolean',
        'questions' => 'array',
    ];

    public function sectionSubject()
    {
        return $this->belongsTo(SectionSubject::class);
    }

    public function teacher()
    {
        return $this->belongsTo(User::class, 'teacher_id');
    }

    public function submissions()
    {
        return $this->hasMany(AssignmentSubmission::class);
    }
}
