<?php

namespace Tests\Feature;

use App\Models\AcademicTerm;
use App\Models\SchoolClass;
use App\Models\Section;
use App\Models\SectionSubject;
use App\Models\Student;
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

    public function test_current_class_attendance_history_breadcrumb_returns_to_current_classes(): void
    {
        $teacher = User::factory()->create([
            'role' => User::ROLE_FACULTY,
            'position' => User::POSITION_TEACHER,
        ]);

        AcademicTerm::create([
            'school_year' => '2026-2027',
            'semester' => '1st',
        ]);
        $this->createOffering($teacher, 'Current Attendance Mathematics', '2026-2027', '1st');
        $this->actingAs($teacher)->get(route('teacher.classes'))->assertOk();

        $class = SchoolClass::query()
            ->where('teacher_id', $teacher->id)
            ->where('subject', 'Current Attendance Mathematics')
            ->firstOrFail();

        $this->get(route('teacher.attendance', ['class' => $class, 'view' => 'past']))
            ->assertOk()
            ->assertSee('>Classes</a>', false)
            ->assertDontSee('>Past Classes</a>', false)
            ->assertSee('Attendance history')
            ->assertSee('Back to mark attendance');

        $this->get(route('teacher.attendance', $class))
            ->assertOk()
            ->assertSee('View attendance history');
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

    public function test_api_attendance_rejects_students_outside_the_teacher_class_roster(): void
    {
        $teacher = User::factory()->create([
            'role' => User::ROLE_FACULTY,
            'position' => User::POSITION_TEACHER,
        ]);
        AcademicTerm::create(['school_year' => '2026-2027', 'semester' => '1st']);
        $offering = $this->createOffering($teacher, 'Attendance Mathematics', '2026-2027', '1st');
        $outsideStudent = $this->createStudent('Outside Student', '2026-2027', $offering->section);

        $this->actingAs($teacher)
            ->postJson("/api/teacher/class/{$offering->id}/attendance", [
                'date' => today()->toDateString(),
                'attendance' => [
                    ['student_id' => $outsideStudent->id, 'status' => 'present'],
                ],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('attendance');

        $this->assertDatabaseMissing('attendances', [
            'student_id' => $outsideStudent->id,
        ]);
    }

    public function test_api_attendance_rejects_past_class_edits(): void
    {
        $teacher = User::factory()->create([
            'role' => User::ROLE_FACULTY,
            'position' => User::POSITION_TEACHER,
        ]);
        AcademicTerm::create(['school_year' => '2026-2027', 'semester' => '1st']);
        $offering = $this->createOffering($teacher, 'Past Attendance Mathematics', '2025-2026', '1st');
        $student = $this->createStudent('Past Attendance Student', '2025-2026', $offering->section);
        $offering->section->students()->attach($student->user_id, ['status' => 'enrolled']);

        $this->actingAs($teacher)
            ->postJson("/api/teacher/class/{$offering->id}/attendance", [
                'date' => today()->toDateString(),
                'attendance' => [
                    ['student_id' => $student->id, 'status' => 'present'],
                ],
            ])
            ->assertForbidden();

        $this->assertDatabaseMissing('attendances', [
            'student_id' => $student->id,
        ]);
    }

    public function test_web_attendance_rejects_out_of_roster_students_and_syncs_reward_points_on_correction(): void
    {
        $teacher = User::factory()->create([
            'role' => User::ROLE_FACULTY,
            'position' => User::POSITION_TEACHER,
        ]);
        AcademicTerm::create(['school_year' => '2026-2027', 'semester' => '1st']);
        $offering = $this->createOffering($teacher, 'Web Attendance Mathematics', '2026-2027', '1st');
        $enrolledStudent = $this->createStudent('Enrolled Student', '2026-2027', $offering->section);
        $outsideStudent = $this->createStudent('Outside Student', '2026-2027', $offering->section);
        $offering->section->students()->attach($enrolledStudent->user_id, ['status' => 'enrolled']);

        $this->actingAs($teacher)->getJson('/api/teacher/classes')->assertOk();
        $class = SchoolClass::query()
            ->where('teacher_id', $teacher->id)
            ->where('subject', 'Web Attendance Mathematics')
            ->firstOrFail();
        $date = today()->toDateString();
        $route = route('teacher.attendance.store', $class);

        $this->post($route, [
            'date' => $date,
            'attendance' => [
                ['student_id' => $outsideStudent->id, 'status' => 'present'],
            ],
        ])->assertSessionHasErrors('attendance');
        $this->assertDatabaseMissing('attendances', ['student_id' => $outsideStudent->id]);

        $this->post($route, [
            'date' => $date,
            'attendance' => [
                ['student_id' => $enrolledStudent->id, 'status' => 'present'],
            ],
        ])->assertSessionHasNoErrors();

        $dailyRewardKey = "attendance-daily:{$enrolledStudent->id}:{$class->id}:{$date}";
        $monthlyRewardKey = 'attendance-monthly:' . $enrolledStudent->id . ':' . substr($date, 0, 7);
        $this->assertDatabaseHas('student_rewards', ['source_key' => $dailyRewardKey]);

        $this->post($route, [
            'date' => $date,
            'attendance' => [
                ['student_id' => $enrolledStudent->id, 'status' => 'absent'],
            ],
        ])->assertSessionHasNoErrors();

        $this->assertDatabaseMissing('student_rewards', ['source_key' => $dailyRewardKey]);
        $this->assertDatabaseMissing('student_rewards', ['source_key' => $monthlyRewardKey]);
    }

    private function createStudent(string $name, string $schoolYear, Section $section): Student
    {
        $user = User::factory()->create(['role' => User::ROLE_STUDENT]);
        [$firstName, $lastName] = array_pad(explode(' ', $name, 2), 2, 'Student');

        return Student::create([
            'student_id' => 'STU-' . $user->id,
            'first_name' => $firstName,
            'last_name' => $lastName,
            'email' => "student-{$user->id}@example.com",
            'gender' => 'female',
            'grade_level' => $section->year_level,
            'section' => $section->name,
            'school_year' => $schoolYear,
            'user_id' => $user->id,
        ]);
    }

    private function createOffering(User $teacher, string $subjectName, string $schoolYear, string $semester): SectionSubject
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

        return SectionSubject::create([
            'section_id' => $section->id,
            'subject_id' => $subject->id,
            'teacher_id' => $teacher->id,
        ]);
    }
}
