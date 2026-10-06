<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CourseShiftRequest extends Model
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_REJECTED = 'rejected';

    protected $fillable = [
        'user_id', 'current_course_id', 'requested_course_id', 'reason',
        'school_year', 'semester', 'status', 'reviewed_by', 'reviewed_at', 'remarks',
    ];

    protected $casts = [
        'reviewed_at' => 'datetime',
    ];

    public function student()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function currentCourse()
    {
        return $this->belongsTo(Course::class, 'current_course_id');
    }

    public function requestedCourse()
    {
        return $this->belongsTo(Course::class, 'requested_course_id');
    }

    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function creditEvaluations()
    {
        return $this->hasMany(CourseShiftCreditEvaluation::class);
    }
}