<?php

namespace Tests\Feature;

use App\Models\Section;
use App\Models\SectionSubject;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RegistrarSectionSubjectAssignmentTest extends TestCase
{
    use RefreshDatabase;

    public function test_registrar_can_assign_multiple_subjects_then_set_a_teacher_for_one_subject(): void
    {
        $registrar = User::factory()->create(['role' => User::ROLE_REGISTRAR]);
        $teacher = User::factory()->create([
            'role' => User::ROLE_FACULTY,
            'position' => User::POSITION_TEACHER,
        ]);
        $section = Section::create([
            'name' => 'BSIT 1A',
            'program_type' => 'college',
            'course' => 'BS Information Technology',
            'year_level' => '1',
            'school_year' => '2026-2027',
            'semester' => '1st',
        ]);
        $math = $this->createSubject('MATH101', 'Mathematics');
        $english = $this->createSubject('ENG101', 'English');

        $this->actingAs($registrar)
            ->get(route('registrar.sections.index'))
            ->assertOk()
            ->assertSee('Select one or more subjects')
            ->assertSee('Set teacher or edit schedule');

        $this->post(route('registrar.sections.subjects.store', $section), [
            'subject_ids' => [$math->id, $english->id],
        ])
            ->assertSessionHas('status', '2 subjects assigned to section.');

        $this->assertDatabaseHas('section_subjects', [
            'section_id' => $section->id,
            'subject_id' => $math->id,
            'teacher_id' => null,
        ]);
        $this->assertDatabaseHas('section_subjects', [
            'section_id' => $section->id,
            'subject_id' => $english->id,
            'teacher_id' => null,
        ]);

        $this->post(route('registrar.sections.subjects.store', $section), [
            'subject_id' => $math->id,
            'teacher_id' => $teacher->id,
        ])->assertSessionHas('status', 'Subject assigned to section.');

        $this->assertSame(
            $teacher->id,
            SectionSubject::query()
                ->where('section_id', $section->id)
                ->where('subject_id', $math->id)
                ->value('teacher_id')
        );
        $this->assertNull(
            SectionSubject::query()
                ->where('section_id', $section->id)
                ->where('subject_id', $english->id)
                ->value('teacher_id')
        );
        $this->assertSame(2, SectionSubject::where('section_id', $section->id)->count());

        $mathAssignment = SectionSubject::query()
            ->where('section_id', $section->id)
            ->where('subject_id', $math->id)
            ->firstOrFail();
        $mathAssignment->update([
            'day' => 'Monday',
            'time_start' => '08:00',
            'time_end' => '09:00',
            'room' => 'Room 101',
        ]);
        $mathAssignment->schedules()->create([
            'day' => 'Monday',
            'time_start' => '08:00',
            'time_end' => '09:00',
            'room' => 'Room 101',
        ]);
        $mathAssignment->schedules()->create([
            'day' => 'Tuesday',
            'time_start' => '09:00',
            'time_end' => '10:00',
            'room' => 'Room 102',
        ]);

        $this->get(route('registrar.sections.index'))
            ->assertOk()
            ->assertSee('Print schedule')
            ->assertSee('BSIT 1A schedule')
            ->assertSee('Tuesday')
            ->assertSee('Room 102');
    }

    private function createSubject(string $code, string $name): Subject
    {
        return Subject::create([
            'code' => $code,
            'name' => $name,
            'program_type' => 'college',
        ]);
    }
}
