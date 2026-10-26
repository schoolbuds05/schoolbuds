<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Department;
use App\Models\Room;
use App\Models\Section;
use App\Models\SectionSubject;
use App\Models\Subject;
use App\Models\TeacherSubjectEligibility;
use App\Models\User;
use App\Services\SectionScheduleService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class SectionGenerationTest extends TestCase
{
    use RefreshDatabase;

    private User $chair;

    private User $teacher;

    private Course $course;

    private Subject $subject;

    private Subject $general;

    private array $input;

    protected function setUp(): void
    {
        parent::setUp();
        $this->chair = User::factory()->create(['role' => 'faculty', 'position' => 'head_department']);
        $department = Department::create(['name' => 'Computing', 'code' => 'COMP', 'chair_user_id' => $this->chair->id, 'type' => 'course', 'is_active' => true]);
        $this->chair->update(['department_id' => $department->id]);
        $math = Department::create(['name' => 'Mathematics', 'code' => 'MATH', 'type' => 'general', 'is_active' => true]);
        $this->course = Course::create(['name' => 'BS Information Technology', 'acronym' => 'BSIT', 'program_type' => 'college', 'department_id' => $department->id, 'is_active' => true]);
        $this->teacher = User::factory()->create(['role' => 'faculty', 'position' => 'teacher', 'department_id' => $math->id]);
        $this->subject = Subject::create(['code' => 'IT101', 'name' => 'Computing', 'program_type' => 'college', 'course' => $this->course->name, 'year_level' => '1', 'semester' => '1st', 'department_id' => $department->id, 'is_active' => true]);
        $this->subject->update(['units_lec' => 3, 'units_lab' => 1]);
        $this->general = Subject::create(['code' => 'MATH101', 'name' => 'Mathematics', 'program_type' => 'college', 'year_level' => '1', 'semester' => '1st', 'department_id' => $math->id, 'is_active' => true]);
        $lectureRoom = Room::create(['name' => 'Room 101', 'room_type' => Room::TYPE_LECTURE, 'capacity' => 40, 'is_active' => true]);
        $secondLectureRoom = Room::create(['name' => 'Room 102', 'room_type' => Room::TYPE_LECTURE, 'capacity' => 40, 'is_active' => true]);
        $labRoom = Room::create(['name' => 'Lab 201', 'room_type' => Room::TYPE_LAB, 'capacity' => 40, 'is_active' => true]);
        foreach ([$this->subject, $this->general] as $subject) {
            $this->approve($this->teacher, $subject);
        }
        $this->input = ['course_id' => $this->course->id, 'year_level' => '1', 'school_year' => '2026-2027', 'semester' => '1st', 'expected_students' => 100, 'max_students' => 40, 'days' => ['Monday', 'Wednesday', 'Friday'], 'time_start' => '08:00', 'time_end' => '17:00', 'room_ids' => [$lectureRoom->id, $secondLectureRoom->id, $labRoom->id], 'max_teacher_minutes' => 1080, 'subjects' => [['subject_id' => $this->subject->id, 'meetings' => 3, 'minutes' => 60], ['subject_id' => $this->general->id, 'meetings' => 3, 'minutes' => 60]]];
        $this->actingAs($this->chair);
    }

    private function approve(User $teacher, Subject $subject): void
    {
        TeacherSubjectEligibility::create(['teacher_id' => $teacher->id, 'subject_id' => $subject->id, 'department_id' => $subject->department_id, 'status' => 'approved', 'source' => 'chair_assignment']);
    }

    private function preview(array $overrides = [])
    {
        return $this->postJson('/api/section-generation/preview', array_replace($this->input, $overrides));
    }

    private function existing(array $sectionOverrides = [], array $assignmentOverrides = []): SectionSubject
    {
        $section = Section::create(array_replace(['name' => 'Existing', 'course' => $this->course->name, 'year_level' => '1', 'program_type' => 'college', 'school_year' => '2026-2027', 'semester' => '1st', 'max_students' => 40, 'workflow_status' => 'approved', 'department_id' => $this->course->department_id, 'is_active' => true], $sectionOverrides));

        return $section->sectionSubjects()->create(array_replace(['subject_id' => $this->subject->id, 'teacher_id' => $this->teacher->id, 'day' => 'MWF', 'time_start' => '8:00 AM', 'time_end' => '09:00', 'room' => ' Room 101 '], $assignmentOverrides));
    }

    public function test_preview_and_save_generate_rounded_up_draft_sections_with_general_and_course_subjects(): void
    {
        $preview = $this->preview()->assertOk()->assertJsonCount(3, 'plan.sections');
        $meetings = $preview->json('plan.sections.0.assignments.0.meetings');
        $this->assertSame(['Lecture', 'Lecture', 'Lab'], array_column($meetings, 'type'));
        $roomTypes = Room::query()->pluck('room_type', 'name');
        foreach ($preview->json('plan.sections') as $section) {
            $subjectRoomsByType = [];
            foreach ($section['assignments'] as $assignment) {
                foreach ($assignment['meetings'] as $meeting) {
                    $this->assertFalse($meeting['time_start'] < '13:00' && $meeting['time_end'] > '12:00');
                    $this->assertContains($roomTypes[$meeting['room']], [strtolower($meeting['type']), Room::TYPE_FLEXIBLE]);
                    $subjectRoomsByType[$assignment['subject_id']][$meeting['type']][] = $meeting['room'];
                }
            }
            foreach ($subjectRoomsByType as $roomsByType) {
                foreach ($roomsByType as $roomsForType) {
                    $this->assertCount(1, array_unique($roomsForType));
                }
            }
            $this->assertNotSame(
                $subjectRoomsByType[$this->subject->id]['Lecture'][0],
                $subjectRoomsByType[$this->general->id]['Lecture'][0],
            );
            $this->assertNotSame(
                $subjectRoomsByType[$this->subject->id]['Lecture'][0],
                $subjectRoomsByType[$this->subject->id]['Lab'][0],
            );
        }
        $this->assertSame([40, 40, 20], array_column($preview->json('plan.sections'), 'expected_students'));
        $this->assertTrue($preview->json('plan.schedule_validation.conflict_free'));
        $this->assertSame(18, $preview->json('plan.schedule_validation.generated_meetings'));
        $this->assertSame(0, $preview->json('plan.schedule_validation.existing_meetings_compared'));
        $this->assertSame('2026-2027', $preview->json('plan.schedule_validation.school_year'));
        $this->assertSame('1st', $preview->json('plan.schedule_validation.semester'));
        $this->assertDatabaseCount('sections', 0);
        $batch = $preview->json('batch_id');
        $this->postJson('/api/section-generation', ['batch_id' => $batch])->assertOk()->assertJsonCount(3, 'section_ids');
        $this->assertDatabaseCount('sections', 3);
        $this->assertDatabaseCount('section_subjects', 6);
        $this->assertDatabaseCount('section_subject_schedules', 18);
        $this->assertDatabaseCount('section_students', 0);
        foreach (Section::all() as $section) {
            $this->assertSame('draft', $section->workflow_status);
            $this->assertFalse($section->is_active);
            $this->assertSame($this->course->department_id, $section->department_id);
            $this->assertNull(app(SectionScheduleService::class)->approvalConflict($section));
        }
        // A retry of the same confirmation cannot create duplicate sections.
        $this->postJson('/api/section-generation', ['batch_id' => $batch])->assertOk();
        $this->assertDatabaseCount('sections', 3);
        $section = Section::first();
        $this->postJson("/api/sections/{$section->id}/submit")->assertOk();
        $this->actingAs(User::factory()->create(['role' => 'registrar', 'position' => null]));
        $this->postJson("/api/sections/{$section->id}/review", ['decision' => 'approve'])->assertOk()->assertJsonPath('section.is_active', true);
    }

    public function test_previewed_random_room_choices_remain_the_same_when_saved(): void
    {
        $preview = $this->preview(['expected_students' => 1])->assertOk();
        $plan = $preview->json('plan.sections.0');
        $saved = $this->postJson('/api/section-generation', ['batch_id' => $preview->json('batch_id')])
            ->assertOk()
            ->assertJsonCount(1, 'section_ids')
            ->json('section_ids.0');

        $section = Section::with('sectionSubjects.schedules')->findOrFail($saved);
        foreach ($plan['assignments'] as $plannedAssignment) {
            $savedAssignment = $section->sectionSubjects->firstWhere('subject_id', $plannedAssignment['subject_id']);
            $this->assertNotNull($savedAssignment);
            $this->assertSame(
                $plannedAssignment['meetings'],
                $savedAssignment->schedules->map(fn ($schedule) => [
                    'type' => $plannedAssignment['meetings'][0]['type'],
                    'day' => $schedule->day,
                    'time_start' => $schedule->time_start,
                    'time_end' => $schedule->time_end,
                    'room' => $schedule->room,
                ])->all(),
            );
        }
    }

    public function test_department_chair_course_is_selected_and_subjects_load_automatically(): void
    {
        $this->withoutVite()
            ->get('/department-chair/sections/generate')
            ->assertOk()
            ->assertSee('value="'.$this->course->id.'"', false)
            ->assertSee('value="BS Information Technology"', false)
            ->assertSee('IT101')
            ->assertViewHas('fixedCourse', fn ($course) => $course->is($this->course))
            ->assertViewHas('subjects', fn ($subjects) => $subjects->contains('id', $this->subject->id));
    }

    public function test_existing_legacy_and_additional_meetings_reserve_teacher_and_room_without_double_counting(): void
    {
        $assignment = $this->existing();
        $assignment->schedules()->create(['day' => 'Monday, Wednesday, Friday', 'time_start' => '08:00', 'time_end' => '09:00', 'room' => 'Room 101']);
        $assignment->schedules()->create(['day' => 'Monday', 'time_start' => '09:00', 'time_end' => '10:00', 'room' => 'Room 102']);
        $preview = $this->preview(['expected_students' => 1, 'max_teacher_minutes' => 600])->assertOk();
        $this->assertTrue($preview->json('plan.schedule_validation.conflict_free'));
        $this->assertSame(6, $preview->json('plan.schedule_validation.generated_meetings'));
        $this->assertSame(4, $preview->json('plan.schedule_validation.existing_meetings_compared'));
        $this->assertCount(4, $preview->json('plan.existing_schedule'));
        $this->assertSame($assignment->section_id, $preview->json('plan.existing_schedule.0.section_id'));
        $this->assertSame('Existing', $preview->json('plan.existing_schedule.0.section'));
        $this->assertContains('Monday', array_column($preview->json('plan.existing_schedule'), 'day'));
        $plan = $preview->json('plan.sections.0.assignments');
        foreach ($plan as $item) {
            foreach ($item['meetings'] as $meeting) {
                $this->assertGreaterThanOrEqual('09:00', $meeting['time_start']);
                if ($meeting['day'] === 'Monday') {
                    $this->assertGreaterThanOrEqual('10:00', $meeting['time_start']);
                }
            }
        }
        // 240 existing + 360 generated = 600; primary meeting is counted only once.
        $this->preview(['expected_students' => 1, 'max_teacher_minutes' => 599])->assertUnprocessable()->assertJsonValidationErrors('schedule');
    }

    public function test_teacher_selection_uses_current_approvals_and_balances_load(): void
    {
        $this->existing();
        $second = User::factory()->create(['role' => 'faculty', 'position' => 'teacher']);
        $this->approve($second, $this->subject);
        $this->approve($second, $this->general);
        $preview = $this->preview(['expected_students' => 1])->assertOk();
        $this->assertSame($second->id, $preview->json('plan.sections.0.assignments.0.teacher_id'));
        TeacherSubjectEligibility::where('teacher_id', $second->id)->update(['status' => 'pending']);
        TeacherSubjectEligibility::where('teacher_id', $this->teacher->id)->update(['status' => 'revoked']);
        $this->preview()->assertUnprocessable()->assertJsonValidationErrors('subjects');
        $this->assertDatabaseCount('section_generation_batches', 1);
    }

    public function test_no_solution_has_no_partial_writes_and_invalid_inputs_are_rejected(): void
    {
        $this->preview(['time_end' => '08:30'])->assertUnprocessable()->assertJsonValidationErrors('schedule');
        foreach ([['max_students' => 0], ['expected_students' => 0], ['school_year' => '2026-2028'], ['days' => []], ['time_end' => '07:00'], ['room_ids' => [$this->input['room_ids'][0], $this->input['room_ids'][0]]], ['subjects' => []], ['expected_students' => 2000, 'max_students' => 1], ['subjects' => [['subject_id' => $this->subject->id, 'minutes' => 17, 'meetings' => 3]]]] as $invalid) {
            $this->preview($invalid)->assertUnprocessable();
        }
        $smallLectureRoom = Room::create(['name' => 'Small Lecture', 'room_type' => Room::TYPE_LECTURE, 'capacity' => 20, 'is_active' => true]);
        $smallLabRoom = Room::create(['name' => 'Small Lab', 'room_type' => Room::TYPE_LAB, 'capacity' => 20, 'is_active' => true]);
        $this->preview(['room_ids' => [$smallLectureRoom->id, $smallLabRoom->id]])->assertUnprocessable()->assertJsonValidationErrors('room_ids');
        $this->assertDatabaseCount('sections', 0);
        $this->assertDatabaseCount('section_subjects', 0);
        $this->assertDatabaseCount('section_generation_batches', 0);
    }

    public function test_stale_expired_and_foreign_previews_cannot_be_saved(): void
    {
        $id = $this->preview(['expected_students' => 1])->assertOk()->json('batch_id');
        $this->existing();
        $this->postJson('/api/section-generation', ['batch_id' => $id])->assertUnprocessable()->assertJsonValidationErrors('batch_id');
        $this->assertDatabaseCount('sections', 1);
        $id = $this->preview(['expected_students' => 1])->assertOk()->json('batch_id');
        DB::table('section_generation_batches')->where('id', $id)->update(['expires_at' => now()->subMinute()]);
        $this->postJson('/api/section-generation', ['batch_id' => $id])->assertUnprocessable()->assertJsonValidationErrors('batch_id');
        $id = $this->preview(['expected_students' => 1])->assertOk()->json('batch_id');
        $this->actingAs(User::factory()->create(['role' => 'admin', 'position' => null]));
        $this->postJson('/api/section-generation', ['batch_id' => $id])->assertNotFound();
        $this->assertDatabaseCount('sections', 1);
    }

    public function test_revocation_or_department_changes_after_preview_prevent_commit(): void
    {
        $id = $this->preview()->assertOk()->json('batch_id');
        TeacherSubjectEligibility::query()->update(['status' => 'revoked']);
        $this->postJson('/api/section-generation', ['batch_id' => $id])->assertUnprocessable()->assertJsonValidationErrors('subjects');
        $this->assertDatabaseCount('sections', 0);
    }

    public function test_generation_requires_course_department_access_and_matching_subjects(): void
    {
        foreach (['student', 'faculty'] as $role) {
            $this->actingAs(User::factory()->create(['role' => $role, 'position' => null]));
            $this->preview()->assertForbidden();
            $this->getJson('/api/section-generation/options')->assertForbidden();
        }
        $generalChair = User::factory()->create(['role' => 'faculty', 'position' => 'head_department', 'department_id' => $this->general->department_id]);
        $this->actingAs($generalChair);
        $this->preview()->assertForbidden();
        $this->get('/department-chair/sections/generate')->assertForbidden();
        $this->actingAs($this->chair);
        $other = Department::create(['name' => 'Business', 'code' => 'BUS', 'is_active' => true]);
        $otherCourse = Course::create(['name' => 'BS Business', 'program_type' => 'college', 'is_active' => true, 'department_id' => $other->id]);
        $this->preview(['course_id' => $otherCourse->id])->assertForbidden();
        foreach ([['course' => 'BS Business'], ['year_level' => '2'], ['semester' => '2nd'], ['program_type' => 'shs'], ['is_active' => false]] as $change) {
            $old = $this->subject->getAttributes();
            $this->subject->update($change);
            $this->preview()->assertUnprocessable()->assertJsonValidationErrors('subjects');
            $this->subject->update(array_intersect_key($old, $change));
        }
        $this->getJson('/api/section-generation/options?course_id='.$this->course->id.'&year_level=1&semester=1st')->assertOk()->assertJsonCount(2, 'subjects')->assertJsonCount(1, 'courses')->assertJsonCount(3, 'rooms');
    }

    public function test_other_terms_and_closed_sections_do_not_reserve_resources(): void
    {
        $this->existing(['semester' => '2nd']);
        $this->existing(['workflow_status' => 'closed']);
        $preview = $this->preview(['expected_students' => 1])->assertOk();
        $this->assertSame('08:00', $preview->json('plan.sections.0.assignments.0.meetings.0.time_start'));
    }

    public function test_additional_meeting_conflict_blocks_web_and_api_approval_in_same_term_only(): void
    {
        $busy = $this->existing();
        $id = $this->preview(['expected_students' => 1])->assertOk()->json('batch_id');
        $this->postJson('/api/section-generation', ['batch_id' => $id])->assertOk();
        $section = Section::latest('id')->first();
        $this->postJson("/api/sections/{$section->id}/submit")->assertOk();
        $busy->schedules()->create(['day' => 'Monday', 'time_start' => '09:00', 'time_end' => '10:00', 'room' => 'Different room']);
        $this->actingAs(User::factory()->create(['role' => 'registrar', 'position' => null]));
        $this->postJson("/api/sections/{$section->id}/review", ['decision' => 'approve'])->assertUnprocessable();
        $this->post("/registrar/sections/{$section->id}/review", ['decision' => 'approve'])->assertSessionHasErrors('section');
        $this->assertFalse($section->fresh()->is_active);
        $busy->section->update(['semester' => '2nd']);
        $this->postJson("/api/sections/{$section->id}/review", ['decision' => 'approve'])->assertOk();
    }

    public function test_room_conflicts_apply_even_when_the_teacher_is_different(): void
    {
        $otherTeacher = User::factory()->create(['role' => 'faculty', 'position' => 'teacher']);
        $this->existing([], ['teacher_id' => $otherTeacher->id]);
        $preview = $this->preview(['expected_students' => 1, 'subjects' => [$this->input['subjects'][0]]])->assertOk();
        $meeting = $preview->json('plan.sections.0.assignments.0.meetings.0');
        $this->assertSame('08:00', $meeting['time_start']);
        $this->assertSame('Room 102', $meeting['room']);
    }

    public function test_confirmation_rolls_back_all_sections_if_a_write_fails(): void
    {
        $id = $this->preview()->assertOk()->json('batch_id');
        $dispatcher = SectionSubject::getEventDispatcher();
        $temporary = clone $dispatcher;
        SectionSubject::setEventDispatcher($temporary);
        $temporary->listen('eloquent.creating: '.SectionSubject::class, function (SectionSubject $assignment) {
            if ($assignment->subject_id === $this->general->id) {
                throw new \RuntimeException('Synthetic write failure');
            }
        });
        try {
            $this->postJson('/api/section-generation', ['batch_id' => $id])->assertStatus(500);
        } finally {
            SectionSubject::setEventDispatcher($dispatcher);
        }
        $this->assertDatabaseCount('sections', 0);
        $this->assertDatabaseCount('section_subjects', 0);
        $this->assertNull(DB::table('section_generation_batches')->where('id', $id)->value('section_ids'));
        $this->postJson('/api/section-generation', ['batch_id' => $id])->assertOk();
        $this->assertDatabaseCount('sections', 3);
    }

    public function test_generated_teacher_must_still_be_eligible_at_approval(): void
    {
        $id = $this->preview(['expected_students' => 1])->assertOk()->json('batch_id');
        $this->postJson('/api/section-generation', ['batch_id' => $id])->assertOk();
        $section = Section::first();
        $this->postJson("/api/sections/{$section->id}/submit")->assertOk();
        TeacherSubjectEligibility::query()->update(['status' => 'revoked']);
        $this->actingAs(User::factory()->create(['role' => 'registrar', 'position' => null]));
        $this->postJson("/api/sections/{$section->id}/review", ['decision' => 'approve'])->assertUnprocessable();
        $this->assertFalse($section->fresh()->is_active);
    }

    public function test_competing_previews_cannot_duplicate_a_batch_and_web_errors_return_to_a_get_page(): void
    {
        $one = $this->preview(['expected_students' => 1])->assertOk()->json('batch_id');
        $two = $this->preview(['expected_students' => 1])->assertOk()->json('batch_id');
        $this->postJson('/api/section-generation', ['batch_id' => $one])->assertOk();
        $this->post('/department-chair/sections/generate', ['batch_id' => $two])->assertRedirect('/department-chair/sections/generate')->assertSessionHasErrors('batch_id');
        $this->assertDatabaseCount('sections', 1);
    }

    public function test_web_generation_preview_and_confirmation_flow(): void
    {
        $this->withoutVite()->get('/department-chair/sections/generate?course_id='.$this->course->id)
            ->assertOk()
            ->assertSee('MATH101')
            ->assertSee('IT101')
            ->assertSee('Available rooms')
            ->assertSee('Lab 201')
            ->assertSee('room_ids[]', false);
        $this->post('/department-chair/sections/generate/preview', $this->input)
            ->assertOk()
            ->assertSee('Generation preview')
            ->assertSee('Save section drafts')
            ->assertSee('Monday 8:00 AM')
            ->assertSee('Lecture · Monday 8:00 AM')
            ->assertSee('Lab · Friday 8:00 AM')
            ->assertSee('9:00 AM');
        $batch = DB::table('section_generation_batches')->first();
        $this->post('/department-chair/sections/generate', ['batch_id' => $batch->id])->assertRedirect('/department-chair/sections')->assertSessionHasNoErrors();
        $this->assertDatabaseCount('sections', 3);
    }

    public function test_web_generation_preview_compares_existing_schedules_without_printing_them(): void
    {
        $this->withoutVite();
        $this->existing();

        $this->post('/department-chair/sections/generate/preview', array_replace($this->input, ['expected_students' => 1]))
            ->assertOk()
            ->assertSee('existing meeting(s) were included in the comparison')
            ->assertDontSee('Existing section schedules')
            ->assertDontSee('Print this section');
    }
}
