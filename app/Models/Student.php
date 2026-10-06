<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Student extends Model
{
    protected $fillable = [
        'student_id', 'first_name', 'last_name', 'email',
        'phone', 'birthdate', 'gender', 'address',
        'father_name', 'father_occupation', 'mother_name', 'mother_occupation',
        'prev_school', 'prev_school_address', 'student_type', 'academic_status',
        'grade_level', 'section', 'school_year', 'status', 'user_id', 'parent_user_id',
    ];

    public function user() { return $this->belongsTo(User::class); }
    public function parent() { return $this->belongsTo(User::class, 'parent_user_id'); }
    public function grades() { return $this->hasMany(Grade::class); }
    public function attendances() { return $this->hasMany(Attendance::class); }
    public function fees() { return $this->hasMany(Fee::class); }
    public function rewards() { return $this->hasMany(StudentReward::class); }
}
