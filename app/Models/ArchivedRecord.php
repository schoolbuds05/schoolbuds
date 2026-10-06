<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ArchivedRecord extends Model
{
    protected $fillable = [
        'record_type',
        'record_id',
        'label',
        'payload',
        'deleted_by',
        'restored_by',
        'source',
        'deleted_at',
        'restored_at',
    ];

    protected $casts = [
        'payload' => 'array',
        'deleted_at' => 'datetime',
        'restored_at' => 'datetime',
    ];

    public function deletedBy()
    {
        return $this->belongsTo(User::class, 'deleted_by');
    }

    public function restoredBy()
    {
        return $this->belongsTo(User::class, 'restored_by');
    }
}
