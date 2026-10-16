<?php

namespace Tests\Feature;

use App\Models\ClassAssignment;
use App\Models\Section;
use App\Models\SectionSubject;
use App\Models\Student;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TimedExamTest extends TestCase
{
    use RefreshDatabase;

    public function test_teacher_can_create_an_exam_with_up_to_fifty_questions(): void
    {
        $teacher = $this->createTeacher();
        $sectionSubject = $this->createSectionSubject($teacher);
        $questions = array_map(fn ($index) => [
            'question' => "Question {$index}",
            'choices' => ['Choice A', 'Choice B', 'Choice C', 'Choice D'],
            'answer' => 'A',
        ], range(1, 50));

        $response = $this->actingAs($teacher)->postJson('/api/teacher/assignments', [
            'section_subject_id' => $sectionSubject->id,
            'type' => 'exam',
            'title' => 'Final exam',
            'points_possible' => 100,
            'duration_minutes' => 90,
            'questions' => $questions,
        ]);

        $response->assertCreated()
            ->assertJsonPath('type', 'exam')
            ->assertJsonPath('duration_minutes', 90);
        $this->assertCount(50, ClassAssignment::firstOrFail()->questions);
        $this->assertSame('Choice A', ClassAssignment::firstOrFail()->questions[0]['answer']);
    }

    public function test_exam_progress_is_saved_and_automatically_scored_at_the_deadline(): void
    {
        $teacher = $this->createTeacher();
        $studentUser = User::factory()->create(['role' => 'student']);
        $sectionSubject = $this->createSectionSubject($teacher);
        $student = Student::create([
            'student_id' => 'EXAM-001',
            'first_name' => 'Exam',
            'last_name' => 'Student',
            'email' => 'exam.student@example.test',
            'gender' => 'female',
            'grade_level' => '10',
            'section' => '10A',
            'school_year' => '2026-2027',
            'user_id' => $studentUser->id,
        ]);
        $sectionSubject->section->students()->attach($studentUser->id, ['status' => 'enrolled']);
        $exam = ClassAssignment::create([
            'section_subject_id' => $sectionSubject->id,
            'teacher_id' => $teacher->id,
            'type' => 'exam',
            'title' => 'Timed exam',
            'points_possible' => 100,
            'duration_minutes' => 30,
            'questions' => [
                ['question' => 'First?', 'choices' => ['Yes', 'No'], 'answer' => 'Yes'],
                ['question' => 'Second?', 'choices' => ['True', 'False'], 'answer' => 'True'],
            ],
            'status' => 'published',
        ]);

        $this->actingAs($studentUser)
            ->postJson("/api/assignments/{$exam->id}/start")
            ->assertOk()
            ->assertJsonPath('submission.status', 'in_progress');

        $this->putJson("/api/assignments/{$exam->id}/progress", [
            'answers' => ['Yes', 'False'],
        ])->assertOk();

        $this->travel(31)->minutes();

        $this->putJson("/api/assignments/{$exam->id}/progress", [
            'answers' => ['No', 'False'],
        ])->assertOk()
            ->assertJsonPath('status', 'graded')
            ->assertJsonPath('score', '50.00')
            ->assertJsonPath('answers.0', 'Yes')
            ->assertJsonPath('answers.1', 'False');

        $this->assertNotNull($exam->submissions()->first()?->submitted_at);
    }

    private function createTeacher(): User
    {
        return User::factory()->create([
            'role' => User::ROLE_FACULTY,
            'position' => User::POSITION_TEACHER,
        ]);
    }

    private function createSectionSubject(User $teacher): SectionSubject
    {
        $section = Section::create([
            'name' => 'Exam Section',
            'year_level' => '1',
            'program_type' => 'college',
            'school_year' => '2026-2027',
            'semester' => '1st',
        ]);
        $subject = Subject::create([
            'code' => 'EXAM101',
            'name' => 'Exam Subject',
            'program_type' => 'college',
        ]);

        return SectionSubject::create([
            'section_id' => $section->id,
            'subject_id' => $subject->id,
            'teacher_id' => $teacher->id,
        ]);
    }
}
