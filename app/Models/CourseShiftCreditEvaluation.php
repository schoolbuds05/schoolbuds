<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CourseShiftCreditEvaluation extends Model
{
    protected $fillable = [
        'course_shift_request_id', 'source_subject_code', 'source_subject_name',
        'target_subject_id', 'decision', 'remarks', 'evaluated_by', 'evaluated_at',
    ];

    protected $casts = [
        'evaluated_at' => 'datetime',
    ];

    public function request()
    {
        return $this->belongsTo(CourseShiftRequest::class, 'course_shift_request_id');
    }

    public function targetSubject()
    {
        return $this->belongsTo(Subject::class, 'target_subject_id');
    }

    public function evaluator()
    {
        return $this->belongsTo(User::class, 'evaluated_by');
    }
}