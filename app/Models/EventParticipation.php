<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EventParticipation extends Model
{
    protected $fillable = [
        'student_id',
        'verified_by',
        'approved_by',
        'event_name',
        'event_date',
        'points',
        'school_year',
        'semester',
        'status',
        'remarks',
        'approved_at',
    ];

    protected $casts = [
        'event_date' => 'date',
        'approved_at' => 'datetime',
        'points' => 'integer',
    ];

    public function student()
    {
        return $this->belongsTo(Student::class);
    }

    public function verifier()
    {
        return $this->belongsTo(User::class, 'verified_by');
    }

    public function approver()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }
}
