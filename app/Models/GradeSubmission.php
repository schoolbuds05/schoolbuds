<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class GradeSubmission extends Model
{
    public const STATUS_DRAFT = 'draft';
    public const STATUS_CHAIR_REVIEW = 'chair_review';
    public const STATUS_TEACHER_REVISION = 'teacher_revision';
    public const STATUS_REGISTRAR_REVIEW = 'registrar_review';
    public const STATUS_REGISTRAR_RETURNED = 'registrar_returned';
    public const STATUS_FINALIZED = 'finalized';

    protected $fillable = [
        'school_class_id', 'teacher_id', 'school_year', 'quarter', 'status', 'revision', 'grades',
        'submitted_at', 'chair_reviewed_by', 'chair_reviewed_at', 'chair_note',
        'registrar_reviewed_by', 'registrar_reviewed_at', 'registrar_note', 'finalized_at',
    ];

    protected $casts = [
        'grades' => 'array',
        'revision' => 'integer',
        'submitted_at' => 'datetime',
        'chair_reviewed_at' => 'datetime',
        'registrar_reviewed_at' => 'datetime',
        'finalized_at' => 'datetime',
    ];

    public function schoolClass(): BelongsTo
    {
        return $this->belongsTo(SchoolClass::class, 'school_class_id');
    }

    public function teacher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'teacher_id');
    }

    public function events(): HasMany
    {
        return $this->hasMany(GradeSubmissionEvent::class)->orderBy('created_at');
    }

    public function changeRequests(): HasMany
    {
        return $this->hasMany(GradeChangeRequest::class, 'grade_submission_id')->latest();
    }
}
