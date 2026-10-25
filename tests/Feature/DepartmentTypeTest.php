<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Department;
use App\Models\Section;
use App\Models\SectionSubject;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class DepartmentTypeTest extends TestCase
{
    use RefreshDatabase;

    private function department(string $type = 'course', string $code = 'IT'): array
    {
        $chair = User::factory()->create(['role' => 'faculty', 'position' => 'head_department']);
        $department = Department::create(['name' => $code, 'code' => $code, 'type' => $type, 'chair_user_id' => $chair->id, 'is_active' => true]);
        $chair->update(['department_id' => $department->id]);

        return [$department, $chair];
    }

    private function course(Department $department): Course
    {
        return Course::create(['name' => 'BS '.$department->code, 'department_id' => $department->id, 'program_type' => 'college', 'is_active' => true]);
    }

    private function sectionData(): array
    {
        return ['name' => 'BSIT 1A', 'course' => 'BS IT', 'program_type' => 'college', 'year_level' => '1', 'school_year' => '2026-2027', 'semester' => '1st', 'max_students' => 40];
    }

    private function subject(Department $department): Subject
    {
        return Subject::create(['code' => 'MATH101', 'name' => 'Mathematics', 'department_id' => $department->id, 'program_type' => 'college', 'is_active' => true]);
    }

    public function test_existing_department_clients_default_to_course_and_admin_can_create_general_department(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $this->actingAs($admin)->post('/admin/departments', ['name' => 'Computing', 'code' => 'COMP', 'is_active' => 1])
            ->assertRedirect()->assertSessionHasNoErrors();
        $this->assertDatabaseHas('departments', ['code' => 'COMP', 'type' => 'course']);
        $this->post('/admin/departments', ['name' => 'Mathematics', 'code' => 'MATH', 'type' => 'general', 'is_active' => 1])
            ->assertRedirect()->assertSessionHasNoErrors();
        $this->assertDatabaseHas('departments', ['code' => 'MATH', 'type' => 'general']);
        $this->withoutVite()->get('/admin/departments')->assertOk()->assertSee('General subject department')->assertSee('Course department');
    }

    public function test_general_department_cannot_receive_programs_and_invalid_type_is_rejected(): void
    {
        [$department] = $this->department();
        $course = $this->course($department);
        $admin = User::factory()->create(['role' => 'admin']);
        $this->actingAs($admin)->post('/admin/departments', ['name' => 'Math', 'code' => 'MATH', 'type' => 'general', 'course_ids' => [$course->id]])
            ->assertSessionHasErrors('course_ids');
        $this->assertDatabaseMissing('departments', ['code' => 'MATH']);
        $this->post('/admin/departments', ['name' => 'Math', 'code' => 'MATH', 'type' => 'other'])->assertSessionHasErrors('type');
        $this->assertSame($department->id, $course->fresh()->department_id);
    }

    public function test_conversion_requires_reassigning_existing_courses_or_sections(): void
    {
        [$department] = $this->department();
        $course = $this->course($department);
        $admin = User::factory()->create(['role' => 'admin']);
        $payload = ['name' => $department->name, 'code' => $department->code, 'type' => 'general', 'is_active' => 1];
        $this->actingAs($admin)->put("/admin/departments/{$department->id}", $payload)->assertSessionHasErrors('type');
        $this->assertSame('course', $department->fresh()->type);
        $this->assertSame($department->id, $course->fresh()->department_id);
        $course->update(['department_id' => null]);
        $section = Section::create($this->sectionData() + ['department_id' => $department->id]);
        $this->put("/admin/departments/{$department->id}", $payload)->assertSessionHasErrors('type');
        $section->update(['department_id' => null]);
        $this->put("/admin/departments/{$department->id}", $payload)->assertSessionHasNoErrors();
        $this->assertSame('general', $department->fresh()->type);
    }

    public function test_model_guards_block_general_ownership_even_outside_department_form(): void
    {
        [$department] = $this->department('general', 'MATH');
        foreach (['course', 'section'] as $kind) {
            try {
                if ($kind === 'course') {
                    $this->course($department);
                } else {
                    Section::create($this->sectionData() + ['department_id' => $department->id]);
                }
                $this->fail('General departments must not own '.$kind.' records.');
            } catch (ValidationException $error) {
                $this->assertArrayHasKey('department_id', $error->errors());
            }
        }
        $this->assertSame(0, $department->courses()->count());
        $this->assertSame(0, $department->sections()->count());
    }

    public function test_general_chair_cannot_create_or_manage_sections_through_web_or_api(): void
    {
        [$general, $chair] = $this->department('general', 'MATH');
        [$courseDepartment] = $this->department();
        $section = Section::create($this->sectionData() + ['department_id' => $courseDepartment->id]);
        $subject = $this->subject($general);
        $student = User::factory()->create(['role' => 'student']);
        $assignment = SectionSubject::create(['section_id' => $section->id, 'subject_id' => $subject->id]);
        $this->actingAs($chair);
        $this->post('/department-chair/sections', $this->sectionData())->assertForbidden();
        $this->post('/registrar/sections', $this->sectionData())->assertForbidden();
        $this->get('/department-chair/sections')->assertForbidden();
        $this->get('/registrar/sections')->assertForbidden();
        foreach (['department-chair', 'registrar'] as $portal) {
            $this->put("/{$portal}/sections/{$section->id}", $this->sectionData())->assertForbidden();
            $this->post("/{$portal}/sections/{$section->id}/submit")->assertForbidden();
            $this->post("/{$portal}/sections/{$section->id}/subjects", ['subject_id' => $subject->id])->assertForbidden();
            $this->delete("/{$portal}/sections/{$section->id}/subjects/{$assignment->id}")->assertForbidden();
            $this->post("/{$portal}/sections/{$section->id}/students", ['user_id' => $student->id])->assertForbidden();
            $this->delete("/{$portal}/sections/{$section->id}/students/{$student->id}")->assertForbidden();
            $this->delete("/{$portal}/sections/{$section->id}")->assertForbidden();
        }
        $this->postJson('/api/sections', $this->sectionData())->assertForbidden();
        $this->getJson('/api/registrar/sections')->assertForbidden();
        $this->getJson("/api/sections/{$section->id}")->assertForbidden();
        $this->putJson("/api/sections/{$section->id}", ['department_id' => $general->id, 'is_active' => true])->assertForbidden();
        foreach (['submit', 'review', 'close', 'reopen'] as $action) {
            $this->postJson("/api/sections/{$section->id}/{$action}", ['decision' => 'approve'])->assertForbidden();
        }
        $this->postJson("/api/sections/{$section->id}/subjects", ['subject_id' => $subject->id])->assertForbidden();
        $this->deleteJson("/api/sections/{$section->id}/subjects/{$subject->id}")->assertForbidden();
        $this->postJson("/api/sections/{$section->id}/students", ['user_id' => $student->id])->assertForbidden();
        $this->deleteJson("/api/sections/{$section->id}/students/{$student->id}")->assertForbidden();
        $this->deleteJson("/api/sections/{$section->id}")->assertForbidden();
        $this->assertSame(1, Section::count());
        $this->assertSame(1, SectionSubject::count());
    }

    public function test_course_chair_can_create_draft_sections_in_own_course_and_submit_for_review(): void
    {
        [$department, $chair] = $this->department();
        $this->course($department);
        $this->actingAs($chair)->post('/department-chair/sections', $this->sectionData() + ['is_active' => 1])
            ->assertRedirect()->assertSessionHasNoErrors();
        $section = Section::firstOrFail();
        $this->assertSame($department->id, $section->department_id);
        $this->assertSame('draft', $section->workflow_status);
        $this->assertFalse($section->is_active);
        $this->post("/department-chair/sections/{$section->id}/submit")->assertSessionHasNoErrors();
        $this->postJson('/api/sections', array_merge($this->sectionData(), ['name' => 'BSIT 1B', 'is_active' => true]))->assertCreated()->assertJsonPath('workflow_status', 'draft')->assertJsonPath('is_active', false);
        $apiSection = Section::latest('id')->first();
        $this->putJson("/api/sections/{$apiSection->id}", ['workflow_status' => 'approved', 'department_id' => null, 'is_active' => true])->assertOk()->assertJsonPath('workflow_status', 'draft')->assertJsonPath('department_id', $department->id)->assertJsonPath('is_active', false);
        $this->postJson("/api/sections/{$apiSection->id}/submit")->assertOk()->assertJsonPath('section.workflow_status', 'pending');
        $this->getJson('/api/registrar/sections')->assertOk()->assertJsonCount(2);
    }

    public function test_course_chair_cannot_choose_other_course_or_mutate_other_department_sections(): void
    {
        [$department, $chair] = $this->department();
        $this->course($department);
        [$other] = $this->department('course', 'BUS');
        $otherCourse = $this->course($other);
        $section = Section::create(array_merge($this->sectionData(), ['course' => $otherCourse->name, 'department_id' => $other->id]));
        $this->actingAs($chair)->postJson('/api/sections', array_merge($this->sectionData(), ['course' => $otherCourse->name]))->assertUnprocessable();
        $this->post('/department-chair/sections', array_merge($this->sectionData(), ['course' => $otherCourse->name]))->assertSessionHasErrors('course');
        $this->putJson("/api/sections/{$section->id}", ['name' => 'Changed'])->assertForbidden();
        $this->deleteJson("/api/sections/{$section->id}")->assertForbidden();
    }

    public function test_general_chair_keeps_subject_approval_and_teacher_access_and_has_no_section_navigation(): void
    {
        [$department, $chair] = $this->department('general', 'MATH');
        $subject = $this->subject($department);
        $teacher = User::factory()->create(['role' => 'faculty', 'position' => 'teacher', 'department_id' => $department->id]);
        $this->actingAs($chair)->postJson('/api/teaching-eligibility/grants', ['subject_id' => $subject->id, 'teacher_id' => $teacher->id, 'remarks' => 'Verified mathematics credentials.'])->assertCreated();
        $this->getJson('/api/teaching-eligibility/department')->assertOk()->assertJsonCount(1, 'subjects');
        $this->getJson('/api/academic-leadership/dashboard')->assertOk()->assertJsonPath('department_type', 'general')->assertJsonPath('can_manage_sections', false);
        $this->withoutVite()->get('/teaching-eligibility/department')->assertOk()->assertSee('Teaching Approvals')->assertDontSee('href="'.route('department-chair.sections.index').'"', false);
        $this->get('/department-chair/teachers')->assertOk()->assertSee($teacher->name);
        $this->assertSame(1, $department->subjects()->count());
    }

    public function test_admin_registrar_and_student_permissions_are_preserved(): void
    {
        foreach (['student', 'faculty'] as $role) {
            $this->actingAs(User::factory()->create(['role' => $role, 'position' => null]))
                ->postJson('/api/sections', $this->sectionData())->assertForbidden();
            $this->getJson('/api/registrar/sections')->assertForbidden();
        }
        foreach (['admin', 'registrar'] as $role) {
            $this->actingAs(User::factory()->create(['role' => $role, 'position' => null]))
                ->postJson('/api/sections', array_merge($this->sectionData(), ['name' => $role.' section', 'is_active' => true]))
                ->assertCreated()->assertJsonPath('workflow_status', 'approved');
        }
    }
}
