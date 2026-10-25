<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\SectionSubject;
use App\Models\Subject;
use App\Models\TeacherSubjectEligibility;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TeachingEligibilityTest extends TestCase
{
    use RefreshDatabase;

    private function department(string $code = 'MATH'): array
    {
        $chair = User::factory()->create(['role' => 'faculty', 'position' => 'head_department']);
        $department = Department::create(['name' => $code, 'code' => $code, 'chair_user_id' => $chair->id, 'is_active' => true]);
        $chair->update(['department_id' => $department->id]);

        return [$department, $chair];
    }

    private function teacher(): User
    {
        return User::factory()->create(['role' => 'faculty', 'position' => 'teacher']);
    }

    private function subject(?Department $department, ?string $course = null): Subject
    {
        return Subject::create([
            'code' => fake()->unique()->bothify('SUB###??'), 'name' => 'College Mathematics',
            'program_type' => 'college', 'course' => $course, 'units_lec' => 3, 'units_lab' => 0,
            'department_id' => $department?->id, 'is_active' => true,
        ]);
    }

    private function requestSubject(User $teacher, Subject $subject): TeacherSubjectEligibility
    {
        $this->actingAs($teacher)->postJson('/api/teaching-eligibility/requests', [
            'subject_id' => $subject->id, 'qualification' => 'Mathematics degree and five years of teaching.',
        ])->assertCreated()->assertJsonPath('data.status', 'pending');

        return TeacherSubjectEligibility::where('teacher_id', $teacher->id)->where('subject_id', $subject->id)->firstOrFail();
    }

    public function test_teacher_request_is_pending_and_only_subject_department_chair_can_approve(): void
    {
        [$math, $chair] = $this->department();
        [, $otherChair] = $this->department('IT');
        $teacher = $this->teacher();
        $subject = $this->subject($math);
        $eligibility = $this->requestSubject($teacher, $subject);
        $this->assertSame(0, TeacherSubjectEligibility::eligible()->count());

        $this->actingAs($otherChair)->postJson("/api/teaching-eligibility/{$eligibility->id}/review", ['decision' => 'approve'])->assertForbidden();
        $this->actingAs($teacher)->postJson("/api/teaching-eligibility/{$eligibility->id}/review", ['decision' => 'approve'])->assertForbidden();
        $this->actingAs($chair)->postJson("/api/teaching-eligibility/{$eligibility->id}/review", ['decision' => 'approve'])
            ->assertOk()->assertJsonPath('data.reviewed_by', $chair->id)->assertJsonPath('data.status', 'approved');
        $this->assertSame(1, TeacherSubjectEligibility::eligible()->count());
        $this->assertSame(0, SectionSubject::count());
        $this->assertNull($subject->fresh()->course);
        $this->assertDatabaseHas('activity_logs', ['subject_type' => TeacherSubjectEligibility::class, 'subject_id' => $eligibility->id, 'action' => 'model_updated']);
    }

    public function test_duplicate_requests_and_repeated_decisions_are_rejected(): void
    {
        [$department, $chair] = $this->department();
        $teacher = $this->teacher();
        $subject = $this->subject($department);
        $eligibility = $this->requestSubject($teacher, $subject);
        $this->postJson('/api/teaching-eligibility/requests', ['subject_id' => $subject->id, 'qualification' => 'Another request.'])->assertUnprocessable();
        $this->actingAs($chair)->postJson("/api/teaching-eligibility/{$eligibility->id}/review", ['decision' => 'approve'])->assertOk();
        $this->postJson("/api/teaching-eligibility/{$eligibility->id}/review", ['decision' => 'reject', 'remarks' => 'Changed mind.'])->assertUnprocessable();
        $this->assertSame(1, TeacherSubjectEligibility::count());
    }

    public function test_rejection_requires_reason_and_teacher_can_resubmit(): void
    {
        [$department, $chair] = $this->department();
        $teacher = $this->teacher();
        $subject = $this->subject($department);
        $eligibility = $this->requestSubject($teacher, $subject);
        $this->actingAs($chair)->postJson("/api/teaching-eligibility/{$eligibility->id}/review", ['decision' => 'reject'])->assertUnprocessable();
        $this->postJson("/api/teaching-eligibility/{$eligibility->id}/review", ['decision' => 'reject', 'remarks' => 'Need evidence of qualifications.'])->assertOk();
        $this->requestSubject($teacher, $subject);
        $this->assertSame(1, TeacherSubjectEligibility::count());
        $this->assertNull($eligibility->fresh()->reviewed_by);
        $this->assertNull($eligibility->fresh()->remarks);
    }

    public function test_chair_can_grant_and_revoke_eligibility_without_a_teacher_request(): void
    {
        [$department, $chair] = $this->department();
        $teacher = $this->teacher();
        $subject = $this->subject($department, 'BSIT');
        $payload = ['teacher_id' => $teacher->id, 'subject_id' => $subject->id, 'remarks' => 'Verified teaching credentials.'];
        $response = $this->actingAs($chair)->postJson('/api/teaching-eligibility/grants', $payload)
            ->assertCreated()->assertJsonPath('data.source', 'chair_assignment')->assertJsonPath('data.status', 'approved');
        $id = $response->json('data.id');
        $this->postJson('/api/teaching-eligibility/grants', $payload)->assertUnprocessable();
        $this->postJson("/api/teaching-eligibility/{$id}/revoke", [])->assertUnprocessable();
        $this->postJson("/api/teaching-eligibility/{$id}/revoke", ['remarks' => 'Qualifications require renewal.'])->assertOk();
        $this->assertSame(0, TeacherSubjectEligibility::eligible()->count());
        $this->assertSame('BSIT', $subject->fresh()->course);
        $this->requestSubject($teacher, $subject);
    }

    public function test_chair_cannot_grant_for_other_departments_or_non_teachers_or_self(): void
    {
        [$department, $chair] = $this->department();
        [$other] = $this->department('IT');
        $teacher = $this->teacher();
        $subject = $this->subject($department);
        $otherSubject = $this->subject($other);
        $this->actingAs($chair)->postJson('/api/teaching-eligibility/grants', ['subject_id' => $otherSubject->id, 'teacher_id' => $teacher->id, 'remarks' => 'Qualified.'])->assertForbidden();
        $student = User::factory()->create(['role' => 'student']);
        foreach ([$student, $chair] as $ineligible) {
            $this->postJson('/api/teaching-eligibility/grants', ['subject_id' => $subject->id, 'teacher_id' => $ineligible->id, 'remarks' => 'Qualified.'])->assertForbidden();
        }
        $eligibility = $this->requestSubject($chair, $subject);
        $this->postJson("/api/teaching-eligibility/{$eligibility->id}/review", ['decision' => 'approve'])->assertForbidden();
    }

    public function test_inactive_or_unmanaged_subjects_are_not_requestable(): void
    {
        [$department] = $this->department();
        $teacher = $this->teacher();
        $unmanaged = $this->subject(null);
        $inactive = $this->subject($department);
        $inactive->update(['is_active' => false]);
        foreach ([$unmanaged, $inactive] as $subject) {
            $this->actingAs($teacher)->postJson('/api/teaching-eligibility/requests', ['subject_id' => $subject->id, 'qualification' => 'Experienced.'])->assertUnprocessable();
        }
        $this->getJson('/api/teaching-eligibility/mine')->assertOk()->assertJsonCount(0, 'subjects');
    }

    public function test_ownership_changes_invalidate_approvals_and_preserve_course_applicability(): void
    {
        [$department, $chair] = $this->department();
        [$newDepartment, $newChair] = $this->department('SCIENCE');
        $teacher = $this->teacher();
        $subject = $this->subject($department, 'BSIT');
        $this->actingAs($chair)->postJson('/api/teaching-eligibility/grants', ['subject_id' => $subject->id, 'teacher_id' => $teacher->id, 'remarks' => 'Verified.'])->assertCreated();
        $registrar = User::factory()->create(['role' => 'registrar']);
        $this->actingAs($registrar)->putJson("/api/teaching-eligibility/subject-departments/{$subject->id}", ['department_id' => $newDepartment->id])->assertOk();
        $this->assertSame('BSIT', $subject->fresh()->course);
        $this->assertSame(0, TeacherSubjectEligibility::eligible()->count());
        $this->assertSame('revoked', TeacherSubjectEligibility::first()->status);
        $eligibility = $this->requestSubject($teacher, $subject->fresh());
        $this->actingAs($chair)->postJson("/api/teaching-eligibility/{$eligibility->id}/review", ['decision' => 'approve'])->assertForbidden();
        $this->actingAs($newChair)->postJson("/api/teaching-eligibility/{$eligibility->id}/review", ['decision' => 'approve'])->assertOk();
        $this->assertSame(1, TeacherSubjectEligibility::eligible()->count());
    }

    public function test_lists_do_not_leak_other_teacher_or_department_requests(): void
    {
        [$department, $chair] = $this->department();
        [$otherDepartment] = $this->department('IT');
        $teacher = $this->teacher();
        $otherTeacher = $this->teacher();
        $this->requestSubject($teacher, $this->subject($department));
        $other = $this->requestSubject($otherTeacher, $this->subject($otherDepartment));
        $this->actingAs($teacher)->getJson('/api/teaching-eligibility/mine')->assertJsonCount(1, 'rows.data')->assertJsonMissing(['id' => $other->id, 'teacher_id' => $otherTeacher->id]);
        $this->actingAs($chair)->getJson('/api/teaching-eligibility/department')->assertOk()->assertJsonCount(1, 'rows.data')->assertJsonCount(1, 'subjects');
    }

    public function test_students_and_unassigned_chairs_cannot_access_workflows(): void
    {
        $this->getJson('/api/teaching-eligibility/mine')->assertUnauthorized();
        $student = User::factory()->create(['role' => 'student']);
        $this->actingAs($student)->getJson('/api/teaching-eligibility/mine')->assertForbidden();
        $this->getJson('/api/teaching-eligibility/department')->assertForbidden();
        $this->getJson('/api/teaching-eligibility/subject-departments')->assertForbidden();
        $chair = User::factory()->create(['role' => 'faculty', 'position' => 'head_department']);
        $this->actingAs($chair)->getJson('/api/teaching-eligibility/department')->assertForbidden();
    }

    public function test_teacher_and_chair_cannot_change_subject_ownership(): void
    {
        [$department, $chair] = $this->department();
        $subject = $this->subject(null);
        foreach ([$this->teacher(), $chair] as $user) {
            $this->actingAs($user)->putJson("/api/teaching-eligibility/subject-departments/{$subject->id}", ['department_id' => $department->id])->assertForbidden();
        }
    }

    public function test_eligible_scope_excludes_inactive_department_subject_and_nonfaculty(): void
    {
        [$department, $chair] = $this->department();
        $teacher = $this->teacher();
        $subject = $this->subject($department);
        $this->actingAs($chair)->postJson('/api/teaching-eligibility/grants', ['subject_id' => $subject->id, 'teacher_id' => $teacher->id, 'remarks' => 'Verified.'])->assertCreated();
        $department->update(['is_active' => false]);
        $this->assertSame(0, TeacherSubjectEligibility::eligible()->count());
        $department->update(['is_active' => true]);
        $subject->update(['is_active' => false]);
        $this->assertSame(0, TeacherSubjectEligibility::eligible()->count());
        $subject->update(['is_active' => true]);
        $teacher->update(['role' => 'student']);
        $this->assertSame(0, TeacherSubjectEligibility::eligible()->count());
    }

    public function test_web_pages_and_form_submission_work_for_each_role(): void
    {
        [$department, $chair] = $this->department();
        $teacher = $this->teacher();
        $subject = $this->subject($department);
        $this->withoutVite();
        $this->actingAs($teacher)->get('/teaching-eligibility/mine')->assertOk()->assertSee('Qualifications and teaching experience');
        $this->post('/teaching-eligibility/requests', ['subject_id' => $subject->id, 'qualification' => 'Teaching degree.'])->assertRedirect()->assertSessionHasNoErrors();
        $this->actingAs($chair)->get('/teaching-eligibility/department')->assertOk()->assertSee('Teaching degree.')->assertSee('Approve a teacher directly');
        $admin = User::factory()->create(['role' => 'admin']);
        $this->actingAs($admin)->get('/teaching-eligibility/subject-departments')->assertOk()->assertSee('Subject Departments');
    }
}
