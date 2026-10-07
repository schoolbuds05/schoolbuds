<?php

namespace Tests\Feature;

use App\Models\AcademicTerm;
use App\Models\Section;
use App\Models\SectionSubject;
use App\Models\SchoolClass;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TeacherCurrentClassesTest extends TestCase
{
    use RefreshDatabase;

    public function test_teacher_classes_only_shows_offerings_in_the_current_academic_term(): void
    {
        $teacher = User::factory()->create([
            'role' => User::ROLE_FACULTY,
            'position' => User::POSITION_TEACHER,
        ]);

        AcademicTerm::create([
            'school_year' => '2026-2027',
            'semester' => '1st',
        ]);

        $this->createOffering($teacher, 'Current Mathematics', '2026-2027', '1st');
        $this->createOffering($teacher, 'Other Semester Mathematics', '2026-2027', '2nd');
        $this->createOffering($teacher, 'Previous Year Mathematics', '2025-2026', '1st');

        $this->actingAs($teacher)
            ->get(route('teacher.classes'))
            ->assertOk()
            ->assertSee('Current Mathematics')
            ->assertDontSee('Other Semester Mathematics')
            ->assertDontSee('Previous Year Mathematics')
            ->assertSeeText('Showing 1ST semester classes for A.Y. 2026-2027.');
    }

    public function test_teacher_can_view_classes_from_past_academic_terms(): void
    {
        $teacher = User::factory()->create([
            'role' => User::ROLE_FACULTY,
            'position' => User::POSITION_TEACHER,
        ]);

        AcademicTerm::create([
            'school_year' => '2026-2027',
            'semester' => '1st',
        ]);

        $this->createOffering($teacher, 'Current Mathematics', '2026-2027', '1st');
        $this->createOffering($teacher, 'Other Semester Mathematics', '2026-2027', '2nd');
        $this->createOffering($teacher, 'Previous Year Mathematics', '2025-2026', '1st');

        $this->actingAs($teacher)
            ->get(route('teacher.classes', ['view' => 'past']))
            ->assertOk()
            ->assertSee('Other Semester Mathematics')
            ->assertSee('Previous Year Mathematics')
            ->assertDontSee('Current Mathematics')
            ->assertSee('Review past class rosters and grades.')
            ->assertSee('Past Attendance');
    }

    public function test_past_class_attendance_is_view_only_even_without_the_past_view_query(): void
    {
        $teacher = User::factory()->create([
            'role' => User::ROLE_FACULTY,
            'position' => User::POSITION_TEACHER,
        ]);

        AcademicTerm::create([
            'school_year' => '2026-2027',
            'semester' => '1st',
        ]);
        $this->createOffering($teacher, 'Past Attendance Mathematics', '2025-2026', '1st');
        $this->actingAs($teacher)->get(route('teacher.classes', ['view' => 'past']))->assertOk();

        $class = SchoolClass::query()
            ->where('teacher_id', $teacher->id)
            ->where('subject', 'Past Attendance Mathematics')
            ->firstOrFail();

        $this->get(route('teacher.attendance', ['class' => $class, 'view' => 'past']))
            ->assertOk()
            ->assertSee('Past Attendance')
            ->assertSee('Past Classes')
            ->assertSee('No past attendance records are available for this class.');

        $this->post(route('teacher.attendance.store', $class), [
            'date' => today()->toDateString(),
            'attendance' => [],
        ])->assertForbidden();
    }

    public function test_teacher_classes_are_empty_when_no_academic_term_is_configured(): void
    {
        $teacher = User::factory()->create([
            'role' => User::ROLE_FACULTY,
            'position' => User::POSITION_TEACHER,
        ]);

        $this->actingAs($teacher)
            ->get(route('teacher.classes'))
            ->assertOk()
            ->assertSee('No active academic term is configured.')
            ->assertSee('No classes assigned for the current academic term.');
    }

    public function test_teacher_dashboard_only_shows_classes_from_the_current_academic_term(): void
    {
        $teacher = User::factory()->create([
            'role' => User::ROLE_FACULTY,
            'position' => User::POSITION_TEACHER,
        ]);

        AcademicTerm::create([
            'school_year' => '2026-2027',
            'semester' => '1st',
        ]);

        $this->createOffering($teacher, 'Current Dashboard Mathematics', '2026-2027', '1st');
        $this->createOffering($teacher, 'Past Dashboard Mathematics', '2025-2026', '1st');

        $this->actingAs($teacher)
            ->get(route('teacher.dashboard'))
            ->assertOk()
            ->assertSee('Current Dashboard Mathematics')
            ->assertDontSee('Past Dashboard Mathematics')
            ->assertSeeText('Showing 1ST semester · A.Y. 2026-2027');
    }

    public function test_department_chair_can_access_teaching_dashboard_and_department_tools(): void
    {
        $chair = User::factory()->create([
            'role' => User::ROLE_FACULTY,
            'position' => User::POSITION_HEAD_DEPARTMENT,
        ]);

        $this->actingAs($chair)
            ->get(route('teacher.dashboard'))
            ->assertOk()
            ->assertSee('Classes')
            ->assertSee('Department Chair')
            ->assertSee('Teacher List')
            ->assertSee('Open department chair tools');
    }

    public function test_teacher_class_work_only_offers_current_class_subjects(): void
    {
        $teacher = User::factory()->create([
            'role' => User::ROLE_FACULTY,
            'position' => User::POSITION_TEACHER,
        ]);

        AcademicTerm::create([
            'school_year' => '2026-2027',
            'semester' => '1st',
        ]);
        $this->createOffering($teacher, 'Current Work Mathematics', '2026-2027', '1st');
        $this->createOffering($teacher, 'Past Work Mathematics', '2025-2026', '1st');

        $this->actingAs($teacher)
            ->get(route('teacher.assignments'))
            ->assertOk()
            ->assertSee('Current Work Mathematics')
            ->assertDontSee('Past Work Mathematics');
    }

    private function createOffering(User $teacher, string $subjectName, string $schoolYear, string $semester): void
    {
        $section = Section::create([
            'name' => "{$schoolYear} {$semester}",
            'year_level' => '1',
            'program_type' => 'college',
            'school_year' => $schoolYear,
            'semester' => $semester,
        ]);
        $subject = Subject::create([
            'code' => strtoupper(str_replace(' ', '-', $subjectName)),
            'name' => $subjectName,
            'program_type' => 'college',
        ]);

        SectionSubject::create([
            'section_id' => $section->id,
            'subject_id' => $subject->id,
            'teacher_id' => $teacher->id,
        ]);
    }
}
