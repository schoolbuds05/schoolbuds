<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StudentSubject extends Model
{
    protected $fillable = [
        'user_id',
        'subject_id',
        'section_id',
        'status',
        'drop_reason',
        'dropped_at',
        'dropped_by',
    ];

    protected $casts = [
        'dropped_at' => 'datetime',
    ];

    public function subject()
    {
        return $this->belongsTo(Subject::class);
    }

    public function section()
    {
        return $this->belongsTo(Section::class);
    }

    public function student()
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
