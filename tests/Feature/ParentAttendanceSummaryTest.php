<?php

namespace Tests\Feature;

use App\Models\Attendance;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ParentAttendanceSummaryTest extends TestCase
{
    use RefreshDatabase;

    public function test_parent_dashboard_includes_overall_and_today_attendance_counts(): void
    {
        $parent = User::factory()->create(['role' => User::ROLE_PARENT]);
        $studentUser = User::factory()->create(['role' => User::ROLE_STUDENT]);
        $student = Student::create([
            'student_id' => 'STU-ATT-001',
            'first_name' => 'Test',
            'last_name' => 'Student',
            'email' => 'attendance-student@example.com',
            'gender' => 'female',
            'grade_level' => 'Grade 1',
            'section' => 'A',
            'school_year' => '2026-2027',
            'user_id' => $studentUser->id,
            'parent_user_id' => $parent->id,
        ]);
        $schoolClass = SchoolClass::create([
            'name' => 'Class A',
            'subject' => 'Mathematics',
            'grade_level' => 'Grade 1',
            'section' => 'A',
            'school_year' => '2026-2027',
        ]);

        foreach ([
            [today(), 'present'],
            [today(), 'late'],
            [today()->subDay(), 'present'],
            [today()->subDay(), 'absent'],
            [today()->subDay(), 'excused'],
        ] as [$date, $status]) {
            Attendance::create([
                'student_id' => $student->id,
                'school_class_id' => $schoolClass->id,
                'date' => $date->toDateString(),
                'status' => $status,
            ]);
        }

        $this->actingAs($parent)
            ->getJson('/api/dashboard/parent')
            ->assertOk()
            ->assertJsonPath('children.0.attendance_pct', 40)
            ->assertJsonPath('children.0.attendance_counts.present', 2)
            ->assertJsonPath('children.0.attendance_counts.late', 1)
            ->assertJsonPath('children.0.attendance_counts.absent', 1)
            ->assertJsonPath('children.0.attendance_counts.excused', 1)
            ->assertJsonPath('children.0.attendance_by_subject.0.subject', 'Mathematics')
            ->assertJsonPath('children.0.attendance_by_subject.0.present', 2)
            ->assertJsonPath('children.0.attendance_by_subject.0.total', 5)
            ->assertJsonPath('children.0.attendance_by_subject.0.attendance_pct', 40)
            ->assertJsonPath('children.0.attendance_history.present.0.date', today()->toDateString())
            ->assertJsonPath('children.0.attendance_history.present.0.subject', 'Mathematics')
            ->assertJsonPath('children.0.today_attendance.recorded', 2)
            ->assertJsonPath('children.0.today_attendance.counts.present', 1)
            ->assertJsonPath('children.0.today_attendance.counts.late', 1)
            ->assertJsonPath('children.0.today_attendance.counts.absent', 0)
            ->assertJsonPath('children.0.today_attendance.counts.excused', 0);
    }
}
