<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GradeChangeRequestEvent extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'grade_change_request_id', 'actor_id', 'action', 'from_status', 'to_status',
        'note', 'changes_snapshot', 'created_at',
    ];

    protected $casts = [
        'changes_snapshot' => 'array',
        'created_at' => 'datetime',
    ];

    public function request(): BelongsTo
    {
        return $this->belongsTo(GradeChangeRequest::class, 'grade_change_request_id');
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }
}