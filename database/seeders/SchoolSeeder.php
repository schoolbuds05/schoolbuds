<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\Student;
use App\Models\SchoolClass;
use App\Models\Subject;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;

class SchoolSeeder extends Seeder
{
    public function run(): void
    {
        // Create roles
        $roles = User::ROLES;
        foreach ($roles as $role) {
            Role::findOrCreate($role, 'web');
        }

        // Admin
        $admin = User::firstOrCreate(
            ['email' => 'admin@school.com'],
            ['name' => 'Admin', 'password' => Hash::make('password'), 'role' => 'admin']
        );
        $admin->assignRole('admin');

        // Registrar
        $registrar = User::firstOrCreate(
            ['email' => 'registrar@school.com'],
            ['name' => 'Registrar', 'password' => Hash::make('password'), 'role' => 'registrar']
        );
        $registrar->assignRole('registrar');

        // Faculty
        $teacher = User::firstOrCreate(
            ['email' => 'teacher@school.com'],
            ['name' => 'Mr. Santos', 'password' => Hash::make('password'), 'role' => 'faculty']
        );
        $teacher->assignRole('faculty');

        // Student user
        $studentUser = User::firstOrCreate(
            ['email' => 'student@school.com'],
            ['name' => 'Juan dela Cruz', 'password' => Hash::make('password'), 'role' => 'student']
        );
        $studentUser->assignRole('student');

        // Student profile
        Student::firstOrCreate(
            ['student_id' => '2025-0001'],
            [
                'first_name'   => 'Juan',
                'last_name'    => 'dela Cruz',
                'email'        => 'student@school.com',
                'gender'       => 'male',
                'grade_level'  => '10',
                'section'      => 'Rizal',
                'school_year'  => '2025-2026',
                'user_id'      => $studentUser->id,
            ]
        );

        // Classes
        $subjects = ['Mathematics 10', 'English 10', 'Science 10', 'Filipino 10'];
        foreach ($subjects as $subject) {
            SchoolClass::firstOrCreate(
                ['subject' => $subject, 'school_year' => '2025-2026'],
                [
                    'name'        => $subject,
                    'grade_level' => '10',
                    'section'     => 'Rizal',
                    'school_year' => '2025-2026',
                    'teacher_id'  => $teacher->id,
                    'room'        => 'Room 204',
                    'schedule'    => '7:30 - 8:30 AM',
                ]
            );
        }

        // BSIT college subjects
        $collegeSubjects = [
            [
                'code'        => 'IT101',
                'name'        => 'Introduction to Programming',
                'description' => 'Basic programming concepts using procedural and object-oriented approaches.',
                'units_lec'   => 3,
                'units_lab'   => 1,
                'program_type'=> 'college',
                'course'      => 'BS Information Technology',
                'year_level'  => '1',
                'strand'      => null,
                'semester'    => '1st',
            ],
            [
                'code'        => 'IT102',
                'name'        => 'Computer Systems and Programming',
                'description' => 'Fundamentals of computer systems and software development life cycle.',
                'units_lec'   => 3,
                'units_lab'   => 1,
                'program_type'=> 'college',
                'course'      => 'BS Information Technology',
                'year_level'  => '1',
                'strand'      => null,
                'semester'    => '2nd',
            ],
            [
                'code'        => 'IT103',
                'name'        => 'Data Structures and Algorithms',
                'description' => 'Core data structures, algorithm analysis, and problem-solving strategies.',
                'units_lec'   => 3,
                'units_lab'   => 1,
                'program_type'=> 'college',
                'course'      => 'BS Information Technology',
                'year_level'  => '2',
                'strand'      => null,
                'semester'    => '1st',
            ],
        ];

        foreach ($collegeSubjects as $subject) {
            Subject::firstOrCreate(
                ['code' => $subject['code']],
                $subject
            );
        }

        // Default courses for college and SHS
        $courses = [
            ['name' => 'BS Information Technology', 'program_type' => 'college'],
            ['name' => 'BS Computer Science', 'program_type' => 'college'],
            ['name' => 'BS Accountancy', 'program_type' => 'college'],
            ['name' => 'BS Information Systems', 'program_type' => 'college'],
            ['name' => 'STEM', 'program_type' => 'shs'],
            ['name' => 'ABM', 'program_type' => 'shs'],
            ['name' => 'HUMSS', 'program_type' => 'shs'],
        ];

        foreach ($courses as $course) {
            \App\Models\Course::firstOrCreate(
                ['name' => $course['name'], 'program_type' => $course['program_type']],
                ['description' => null, 'is_active' => true]
            );
        }
    }
}
