<?php

namespace App\Models;

use Illuminate\Support\Carbon;
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

    public function setExamDateAttribute($value): void
    {
        $this->attributes['exam_date'] = $this->toLocalDateTimeString($value);
    }

    public function getExamDateAttribute($value): ?Carbon
    {
        return $this->fromLocalDateTimeString($value);
    }

    public function setGradeFinalizationDeadlineAttribute($value): void
    {
        $this->attributes['grade_finalization_deadline'] = $this->toLocalDateTimeString($value);
    }

    public function getGradeFinalizationDeadlineAttribute($value): ?Carbon
    {
        return $this->fromLocalDateTimeString($value);
    }

    public function setEnrollmentOpensAtAttribute($value): void
    {
        $this->attributes['enrollment_opens_at'] = $this->toLocalDateTimeString($value);
    }

    public function getEnrollmentOpensAtAttribute($value): ?Carbon
    {
        return $this->fromLocalDateTimeString($value);
    }

    public function setEnrollmentClosesAtAttribute($value): void
    {
        $this->attributes['enrollment_closes_at'] = $this->toLocalDateTimeString($value);
    }

    public function getEnrollmentClosesAtAttribute($value): ?Carbon
    {
        return $this->fromLocalDateTimeString($value);
    }

    private function toLocalDateTimeString(mixed $value): ?string
    {
        return $value === null || $value === ''
            ? null
            : Carbon::parse($value, 'Asia/Manila')->setTimezone('Asia/Manila')->format('Y-m-d H:i:s');
    }

    private function fromLocalDateTimeString(?string $value): ?Carbon
    {
        return $value === null
            ? null
            : Carbon::parse($value, 'Asia/Manila');
    }
}
