<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, HasRoles, Notifiable;

    public const ROLE_ADMIN = 'admin';
    public const ROLE_REGISTRAR = 'registrar';
    public const ROLE_FACULTY = 'faculty';
    public const ROLE_TEACHER = 'teacher';
    public const ROLE_HEAD_TEACHER = 'head_teacher';
    public const ROLE_DEAN = 'dean';
    public const ROLE_STUDENT = 'student';
    public const ROLE_PARENT = 'parent';
    public const ROLE_STAFF = 'staff';

    public const POSITION_TEACHER = 'teacher';
    public const POSITION_HEAD_DEPARTMENT = 'head_department';
    public const POSITION_HEAD_TEACHER = 'head_teacher';
    public const POSITION_DEAN = 'dean';
    public const POSITION_LIBRARIAN = 'librarian';
    public const POSITION_PROPERTY_CUSTODIAN = 'property_custodian';

    public const ROLES = [
        self::ROLE_ADMIN,
        self::ROLE_REGISTRAR,
        self::ROLE_FACULTY,
        self::ROLE_STUDENT,
        self::ROLE_PARENT,
        self::ROLE_STAFF,
    ];

    public const LEGACY_POSITION_ROLES = [
        self::ROLE_HEAD_TEACHER,
        self::ROLE_DEAN,
        self::POSITION_LIBRARIAN,
        self::POSITION_PROPERTY_CUSTODIAN,
    ];

    public const STAFF_ROLES = [
        self::ROLE_STAFF,
        self::POSITION_LIBRARIAN,
        self::POSITION_PROPERTY_CUSTODIAN,
    ];

    public const FACULTY_ROLES = [
        self::ROLE_FACULTY,
        self::ROLE_TEACHER,
        self::POSITION_HEAD_TEACHER,
        self::POSITION_DEAN,
    ];

    public const ADMIN_MANAGEABLE_ROLES = [
        self::ROLE_ADMIN,
        self::ROLE_REGISTRAR,
        self::ROLE_FACULTY,
        self::ROLE_PARENT,
        self::ROLE_STAFF,
        self::ROLE_STUDENT,
    ];

    public const MOBILE_STAFF_PORTAL_ROLES = [
        self::ROLE_STAFF,
        self::POSITION_LIBRARIAN,
        self::POSITION_PROPERTY_CUSTODIAN,
    ];

    public const POSITIONS = [
        self::ROLE_FACULTY => [
            self::POSITION_TEACHER,
            self::POSITION_HEAD_DEPARTMENT,
            self::POSITION_DEAN,
        ],
        self::ROLE_STAFF => [
            self::POSITION_LIBRARIAN,
            self::POSITION_PROPERTY_CUSTODIAN,
        ],
    ];

    protected $fillable = [
        'name', 'first_name', 'middle_name', 'last_name', 'email', 'password', 'role', 'position', 'department', 'department_id', 'profile_photo_path',
    ];

    protected $appends = [
        'profile_photo_url',
    ];

    protected $hidden = [
        'password', 'remember_token',
    ];

    public function getProfilePhotoUrlAttribute(): ?string
    {
        return $this->profile_photo_path
            ? url('storage/' . ltrim($this->profile_photo_path, '/'))
            : null;
    }

    public function student()
    {
        return $this->hasOne(Student::class);
    }

    public function grades()
    {
        return $this->hasManyThrough(Grade::class, Student::class, 'user_id', 'student_id');
    }

    public function teacherSections()
    {
        return $this->hasMany(SectionSubject::class, 'teacher_id');
    }

    public function teacherClasses()
    {
        return $this->hasMany(SchoolClass::class, 'teacher_id');
    }

    public function academicDepartment()
    {
        return $this->belongsTo(Department::class, 'department_id');
    }
}
