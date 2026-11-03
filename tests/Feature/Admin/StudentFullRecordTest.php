<?php

namespace Tests\Feature\Admin;

use App\Models\EnrollmentApplication;
use App\Models\Grade;
use App\Models\SchoolClass;
use App\Models\Section;
use App\Models\Student;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StudentFullRecordTest extends TestCase
{
    use RefreshDatabase;

    public function test_student_full_record_includes_imported_section_subject_ids(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
        $student = Student::create([
            'student_id' => 'STU-IMPORT-001',
            'first_name' => 'Imported',
            'last_name' => 'Student',
            'email' => 'imported.student@example.com',
            'gender' => 'female',
            'grade_level' => '2',
            'section' => 'A',
            'school_year' => '2024-2025',
        ]);
        $subject = Subject::create([
            'code' => 'HIST102',
            'name' => 'Imported Historical Subject',
            'units_lec' => 3,
            'program_type' => 'college',
        ]);
        $section = Section::create([
            'name' => 'BSIT 2B',
            'school_year' => '2024-2025',
            'semester' => '1st',
            'program_type' => 'college',
        ]);
        $sectionSubject = $section->sectionSubjects()->create(['subject_id' => $subject->id]);

        EnrollmentApplication::create([
            'email' => 'imported.student@example.com',
            'password' => 'unused-import-password',
            'first_name' => 'Imported',
            'last_name' => 'Student',
            'id_no' => $student->student_id,
            'program_type' => 'college',
            'school_year' => '2024-2025',
            'semester' => '1st',
            'subject_ids' => [],
            'section_subject_ids' => [$sectionSubject->id],
            'status' => 'approved',
        ]);

        $this->actingAs($admin)
            ->get(route('admin.students.show', $student))
            ->assertOk()
            ->assertSee('Imported Historical Subject')
            ->assertSee('2024-2025')
            ->assertSee('1st semester');
    }

    public function test_student_full_record_includes_completed_past_section_subjects_and_grades(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
        $studentUser = User::factory()->create(['role' => User::ROLE_STUDENT]);
        $student = Student::create([
            'student_id' => 'STU-PAST-001',
            'first_name' => 'Past',
            'last_name' => 'Student',
            'email' => 'past.student@example.com',
            'gender' => 'female',
            'grade_level' => '2',
            'section' => 'A',
            'school_year' => '2025-2026',
            'user_id' => $studentUser->id,
        ]);
        $subject = Subject::create([
            'code' => 'HIST101',
            'name' => 'Historical Subject',
            'units_lec' => 3,
            'program_type' => 'college',
        ]);
        $section = Section::create([
            'name' => 'BSIT 2A',
            'school_year' => '2024-2025',
            'semester' => '2nd',
            'program_type' => 'college',
        ]);
        $section->students()->attach($studentUser->id, ['status' => 'completed']);
        $section->sectionSubjects()->create(['subject_id' => $subject->id]);

        $schoolClass = SchoolClass::create([
            'name' => 'Historical Subject Class',
            'subject' => 'Historical Subject',
            'grade_level' => '2',
            'section' => 'BSIT 2A',
            'school_year' => '2024-2025',
        ]);
        Grade::create([
            'student_id' => $student->id,
            'school_class_id' => $schoolClass->id,
            'school_year' => '2024-2025',
            'quarter' => '4',
            'score' => 2.75,
        ]);

        $this->actingAs($admin)
            ->get(route('admin.students.show', $student))
            ->assertOk()
            ->assertSee('Historical Subject')
            ->assertSee('Completed')
            ->assertSee('2024-2025')
            ->assertSee('2nd semester')
            ->assertSee('2.75');
    }

    public function test_student_full_record_includes_past_subjects_available_only_in_imported_grade_records(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
        $student = Student::create([
            'student_id' => 'STU-GRADE-IMPORT-001',
            'first_name' => 'Grade',
            'last_name' => 'Import',
            'email' => 'grade.import@example.com',
            'gender' => 'female',
            'grade_level' => '2',
            'section' => 'TBA',
            'school_year' => '2025-2026',
        ]);
        Subject::create([
            'code' => 'IMPHIST',
            'name' => 'Imported Past Subject',
            'units_lec' => 3,
            'program_type' => 'college',
        ]);
        $schoolClass = SchoolClass::create([
            'name' => 'Imported Past Subject',
            'subject' => 'IMPHIST',
            'grade_level' => '2',
            'section' => '',
            'school_year' => '2023-2024',
        ]);
        Grade::create([
            'student_id' => $student->id,
            'school_class_id' => $schoolClass->id,
            'school_year' => '2023-2024',
            'quarter' => '4',
            'score' => 88,
        ]);

        $this->actingAs($admin)
            ->get(route('admin.students.show', $student))
            ->assertOk()
            ->assertSee('Imported Past Subject')
            ->assertSee('Imported academic record')
            ->assertSee('2023-2024')
            ->assertSee('88.00')
            ->assertSee('Completed');
    }
}
