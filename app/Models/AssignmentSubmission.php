<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AssignmentSubmission extends Model
{
    protected $fillable = [
        'class_assignment_id',
        'student_id',
        'user_id',
        'answer_text',
        'file_url',
        'answers',
        'score',
        'plagiarism_score',
        'violation_count',
        'violations',
        'feedback',
        'status',
        'submitted_at',
        'auto_submitted_at',
        'flagged_at',
        'graded_at',
    ];

    protected $casts = [
        'answers' => 'array',
        'violations' => 'array',
        'score' => 'decimal:2',
        'plagiarism_score' => 'decimal:2',
        'submitted_at' => 'datetime',
        'auto_submitted_at' => 'datetime',
        'flagged_at' => 'datetime',
        'graded_at' => 'datetime',
    ];

    public function assignment()
    {
        return $this->belongsTo(ClassAssignment::class, 'class_assignment_id');
    }

    public function student()
    {
        return $this->belongsTo(Student::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
