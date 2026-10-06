<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class GradeChangeRequest extends Model
{
    public const STATUS_CHAIR_REVIEW = 'chair_review';
    public const STATUS_REGISTRAR_REVIEW = 'registrar_review';
    public const STATUS_REJECTED = 'rejected';
    public const STATUS_APPROVED = 'approved';

    protected $fillable = [
        'grade_submission_id', 'teacher_id', 'status', 'reason', 'changes',
        'chair_reviewed_by', 'chair_reviewed_at', 'chair_note',
        'registrar_reviewed_by', 'registrar_reviewed_at', 'registrar_note', 'approved_at',
    ];

    protected $casts = [
        'changes' => 'array',
        'chair_reviewed_at' => 'datetime',
        'registrar_reviewed_at' => 'datetime',
        'approved_at' => 'datetime',
    ];

    public function submission(): BelongsTo
    {
        return $this->belongsTo(GradeSubmission::class, 'grade_submission_id');
    }

    public function teacher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'teacher_id');
    }

    public function chairReviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'chair_reviewed_by');
    }

    public function registrarReviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'registrar_reviewed_by');
    }

    public function events(): HasMany
    {
        return $this->hasMany(GradeChangeRequestEvent::class)->orderBy('created_at');
    }
}