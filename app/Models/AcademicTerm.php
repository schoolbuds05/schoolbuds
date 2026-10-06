<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AcademicTerm extends Model
{
    protected $fillable = [
        'school_year',
        'semester',
        'exam_date',
        'grade_finalization_deadline',
        'enrollment_opens_at',
        'enrollment_closes_at',
        'is_active',
        'updated_by',
    ];

    protected $casts = [
        'exam_date' => 'datetime',
        'grade_finalization_deadline' => 'datetime',
        'enrollment_opens_at' => 'datetime',
        'enrollment_closes_at' => 'datetime',
        'is_active' => 'boolean',
    ];

    public function isEnrollmentOpen(): bool
    {
        $now = now();

        return $this->is_active
            && (!$this->enrollment_opens_at || $now->greaterThanOrEqualTo($this->enrollment_opens_at))
            && (!$this->enrollment_closes_at || $now->lessThanOrEqualTo($this->enrollment_closes_at))
            && (!$this->grade_finalization_deadline || $now->greaterThanOrEqualTo($this->grade_finalization_deadline));
    }
}
