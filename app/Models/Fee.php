<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Fee extends Model
{
    protected $fillable = [
        'student_id', 'type', 'amount', 'paid_amount',
        'status', 'due_date', 'paid_date',
        'payment_method', 'payment_reference', 'paid_by',
        'verified_by', 'payment_verified_at',
        'school_year', 'semester', 'quarter', 'notes',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'paid_amount' => 'decimal:2',
        'due_date' => 'date',
        'paid_date' => 'date',
        'payment_verified_at' => 'datetime',
    ];

    public function student()
    {
        return $this->belongsTo(Student::class);
    }
}
