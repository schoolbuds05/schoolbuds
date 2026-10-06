<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GradeSubmissionEvent extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'grade_submission_id', 'actor_id', 'action', 'from_status', 'to_status',
        'revision', 'note', 'grade_snapshot', 'created_at',
    ];

    protected $casts = [
        'grade_snapshot' => 'array',
        'created_at' => 'datetime',
        'revision' => 'integer',
    ];

    public function submission(): BelongsTo
    {
        return $this->belongsTo(GradeSubmission::class, 'grade_submission_id');
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }
}
