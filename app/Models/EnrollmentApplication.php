<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\Course;

class EnrollmentApplication extends Model
{
    protected $fillable = [
        // Account
        'email', 'password',

        // Personal
        'first_name', 'last_name', 'middle_name',
        'birthdate', 'gender', 'religion', 'civil_status',
        'citizenship', 'place_of_birth', 'contact_number', 'address',

        // Family
        'father_name', 'father_occupation',
        'mother_name', 'mother_occupation', 'parent_email',

        // Previous school
        'prev_school', 'prev_school_address',

        // Classification
        'student_type', 'academic_status',
        'shiftee_from', 'shiftee_to', 'id_no',

        // Program
        'program_type', 'grade_level', 'strand',
        'course', 'course_id', 'year_level',

        // Enrollment period
        'school_year', 'semester',
        'subject_ids', 'section_subject_ids', 'document_urls',

        // Review
        'status', 'remarks', 'user_id',
        'reviewed_by', 'reviewed_at',
    ];

    protected $hidden = ['password'];

    protected $casts = [
        'birthdate'   => 'date',
        'reviewed_at' => 'datetime',
        'course_id'   => 'integer',
        'subject_ids' => 'array',
        'section_subject_ids' => 'array',
        'document_urls' => 'array',
    ];

    public function student()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function course()
    {
        return $this->belongsTo(Course::class, 'course_id');
    }

    public function getFullNameAttribute(): string
    {
        return trim("{$this->first_name} {$this->middle_name} {$this->last_name}");
    }
}
