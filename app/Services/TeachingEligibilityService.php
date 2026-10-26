<?php

namespace App\Services;

use App\Models\Department;
use App\Models\Subject;
use App\Models\TeacherSubjectEligibility;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TeachingEligibilityService
{
    public function requireTeacher(User $user): void
    {
        abort_unless(User::query()->teachingFaculty()->whereKey($user->id)->exists(), 403);
    }

    public function chairDepartment(User $user): Department
    {
        abort_unless($user->position === User::POSITION_HEAD_DEPARTMENT, 403);
        $department = Department::query()->where('is_active', true)->find($user->department_id);
        abort_unless($department && (int) $department->chair_user_id === (int) $user->id, 403,
            'You must be the assigned chair of an active department.');

        return $department;
    }

    public function request(User $teacher, int $subjectId, string $qualification): TeacherSubjectEligibility
    {
        $this->requireTeacher($teacher);
        $department = $teacher->position === User::POSITION_HEAD_DEPARTMENT
            ? $this->chairDepartment($teacher)
            : null;

        return DB::transaction(function () use ($teacher, $subjectId, $qualification, $department) {
            $subject = Subject::query()->lockForUpdate()->findOrFail($subjectId);
            if ($department) {
                $this->requireOwnedSubject($subject, $department);
            }
            $this->requireManagedSubject($subject);
            $eligibility = TeacherSubjectEligibility::firstOrNew(['teacher_id' => $teacher->id, 'subject_id' => $subject->id]);
            if ($eligibility->exists && in_array($eligibility->status, ['pending', 'approved'], true)) {
                throw ValidationException::withMessages(['subject_id' => 'You already have a pending request or approval for this subject.']);
            }
            $eligibility->fill([
                'department_id' => $subject->department_id,
                'status' => 'pending', 'source' => 'teacher_request',
                'qualification' => $qualification, 'remarks' => null,
                'reviewed_by' => null, 'reviewed_at' => null,
            ])->save();

            return $eligibility;
        });
    }

    public function review(User $chair, TeacherSubjectEligibility $eligibility, string $decision, ?string $remarks): TeacherSubjectEligibility
    {
        $department = $this->chairDepartment($chair);

        return DB::transaction(function () use ($chair, $department, $eligibility, $decision, $remarks) {
            // Lock the subject first in every workflow to serialize requests, reviews and direct grants.
            $subject = Subject::query()->lockForUpdate()->findOrFail($eligibility->subject_id);
            $eligibility = TeacherSubjectEligibility::query()->lockForUpdate()->findOrFail($eligibility->id);
            $this->requireOwnedSubject($subject, $department);
            abort_if((int) $eligibility->teacher_id === (int) $chair->id, 403, 'You cannot approve your own eligibility.');
            abort_if($eligibility->teacher?->position === User::POSITION_HEAD_DEPARTMENT, 403, 'Department chair requests must be reviewed by the Registrar.');
            if ($eligibility->status !== 'pending' || (int) $eligibility->department_id !== (int) $department->id) {
                throw ValidationException::withMessages(['decision' => 'Only a pending request for this department can be reviewed.']);
            }
            $this->requireTeacher($eligibility->teacher);
            $eligibility->update([
                'status' => $decision === 'approve' ? 'approved' : 'rejected',
                'remarks' => $remarks, 'reviewed_by' => $chair->id, 'reviewed_at' => now(),
            ]);

            return $eligibility;
        });
    }

    public function reviewChairRequest(User $registrar, TeacherSubjectEligibility $eligibility, string $decision, ?string $remarks): TeacherSubjectEligibility
    {
        abort_unless(
            $registrar->role === User::ROLE_REGISTRAR || $registrar->hasRole(User::ROLE_REGISTRAR),
            403
        );

        return DB::transaction(function () use ($registrar, $eligibility, $decision, $remarks) {
            $subject = Subject::query()->lockForUpdate()->findOrFail($eligibility->subject_id);
            $eligibility = TeacherSubjectEligibility::query()->lockForUpdate()->findOrFail($eligibility->id);
            $this->requireManagedSubject($subject);
            $teacher = $eligibility->teacher;
            if (
                $eligibility->status !== 'pending'
                || $eligibility->source !== 'teacher_request'
                || (int) $eligibility->department_id !== (int) $subject->department_id
                || $teacher?->position !== User::POSITION_HEAD_DEPARTMENT
            ) {
                throw ValidationException::withMessages(['decision' => 'Only a pending department-chair request can be reviewed here.']);
            }

            abort_unless($teacher, 404);
            $this->requireTeacher($teacher);
            $eligibility->update([
                'status' => $decision === 'approve' ? 'approved' : 'rejected',
                'remarks' => $remarks, 'reviewed_by' => $registrar->id, 'reviewed_at' => now(),
            ]);

            return $eligibility;
        });
    }

    public function grant(User $chair, int $subjectId, int $teacherId, string $remarks): TeacherSubjectEligibility
    {
        $department = $this->chairDepartment($chair);
        $teacher = User::findOrFail($teacherId);
        $this->requireTeacher($teacher);
        abort_if((int) $teacher->id === (int) $chair->id, 403, 'You cannot approve your own eligibility.');

        return DB::transaction(function () use ($chair, $department, $subjectId, $teacher, $remarks) {
            $subject = Subject::query()->lockForUpdate()->findOrFail($subjectId);
            $this->requireOwnedSubject($subject, $department);
            $eligibility = TeacherSubjectEligibility::firstOrNew(['teacher_id' => $teacher->id, 'subject_id' => $subject->id]);
            if ($eligibility->status === 'approved') {
                throw ValidationException::withMessages(['teacher_id' => 'This teacher is already approved.']);
            }
            $eligibility->fill([
                'department_id' => $department->id, 'status' => 'approved', 'source' => 'chair_assignment',
                'remarks' => $remarks, 'reviewed_by' => $chair->id, 'reviewed_at' => now(),
            ])->save();

            return $eligibility;
        });
    }

    public function revoke(User $chair, TeacherSubjectEligibility $eligibility, string $remarks): TeacherSubjectEligibility
    {
        $department = $this->chairDepartment($chair);

        return DB::transaction(function () use ($chair, $department, $eligibility, $remarks) {
            $subject = Subject::query()->lockForUpdate()->findOrFail($eligibility->subject_id);
            $eligibility = TeacherSubjectEligibility::query()->lockForUpdate()->findOrFail($eligibility->id);
            $this->requireOwnedSubject($subject, $department);
            if ($eligibility->status !== 'approved') {
                throw ValidationException::withMessages(['eligibility' => 'Only approved eligibility can be revoked.']);
            }
            $eligibility->update(['status' => 'revoked', 'remarks' => $remarks, 'reviewed_by' => $chair->id, 'reviewed_at' => now()]);

            return $eligibility;
        });
    }

    private function requireManagedSubject(Subject $subject): void
    {
        if (! $subject->is_active || ! $subject->department?->is_active) {
            throw ValidationException::withMessages(['subject_id' => 'Choose an active subject with an active managing department.']);
        }
    }

    private function requireOwnedSubject(Subject $subject, Department $department): void
    {
        abort_unless((int) $subject->department_id === (int) $department->id, 403);
        $this->requireManagedSubject($subject);
    }
}
