<?php

namespace App\Services;

use App\Models\Course;
use App\Models\Department;
use App\Models\Grade;
use App\Models\GradeChangeRequest;
use App\Models\GradeChangeRequestEvent;
use App\Models\GradeSubmission;
use App\Models\GradeSubmissionEvent;
use App\Models\SchoolClass;
use App\Models\SchoolNotification;
use App\Models\Section;
use App\Models\Student;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class GradeChangeRequestService
{
    public function submit(
        User $teacher,
        GradeSubmission $submission,
        array $input,
        GradeWorkflowService $workflow
    ): GradeChangeRequest {
        abort_unless((int) $submission->teacher_id === (int) $teacher->id, 403);

        return DB::transaction(function () use ($teacher, $submission, $input, $workflow) {
            $lockedSubmission = GradeSubmission::query()
                ->with('schoolClass')
                ->lockForUpdate()
                ->findOrFail($submission->id);

            if ($lockedSubmission->status !== GradeSubmission::STATUS_FINALIZED) {
                throw ValidationException::withMessages(['submission' => 'Only finalized grade sheets can have a change request.']);
            }

            if (!$workflow->isCollegeClass($lockedSubmission->schoolClass)) {
                throw ValidationException::withMessages(['submission' => 'Grade change requests are currently available for college grade sheets only.']);
            }

            $hasOpenRequest = GradeChangeRequest::query()
                ->where('grade_submission_id', $lockedSubmission->id)
                ->whereIn('status', [GradeChangeRequest::STATUS_CHAIR_REVIEW, GradeChangeRequest::STATUS_REGISTRAR_REVIEW])
                ->exists();
            if ($hasOpenRequest) {
                throw ValidationException::withMessages(['submission' => 'A grade change request is already under review for this quarter.']);
            }

            $class = $lockedSubmission->schoolClass;
            $isCollege = $workflow->isCollegeClass($class);
            $publishedGrades = Grade::query()
                ->where('school_class_id', $class->id)
                ->where('school_year', $lockedSubmission->school_year)
                ->where('quarter', $lockedSubmission->quarter)
                ->lockForUpdate()
                ->get()
                ->keyBy('student_id');

            $changes = collect($lockedSubmission->grades ?? [])->map(function (array $line) use ($input, $publishedGrades, $workflow, $isCollege) {
                $studentId = (int) ($line['student_id'] ?? 0);
                $grade = $publishedGrades->get($studentId);
                if (!$grade || (float) $grade->score !== (float) ($line['score'] ?? -1)) {
                    throw ValidationException::withMessages(['submission' => 'Published grades changed since this sheet was finalized. Refresh the page before requesting a change.']);
                }

                $requestedScore = $input['changes'][$studentId] ?? null;
                if ($requestedScore === null || $requestedScore === '') {
                    return null;
                }

                $requestedScore = (float) $requestedScore;
                if ($requestedScore === (float) $grade->score) {
                    return null;
                }

                return [
                    'student_id' => $studentId,
                    'student_name' => $line['student_name'] ?? $grade->student?->name ?? 'Student',
                    'student_code' => $line['student_code'] ?? $grade->student?->student_id,
                    'old_score' => (float) $grade->score,
                    'new_score' => $requestedScore,
                    'old_remarks' => $grade->remarks,
                    'new_remarks' => $workflow->remarkForScore($requestedScore, $isCollege),
                ];
            })->filter()->values();

            if ($changes->isEmpty()) {
                throw ValidationException::withMessages(['changes' => 'Enter at least one score that differs from the published grade.']);
            }

            $request = GradeChangeRequest::create([
                'grade_submission_id' => $lockedSubmission->id,
                'teacher_id' => $teacher->id,
                'status' => GradeChangeRequest::STATUS_CHAIR_REVIEW,
                'reason' => $input['reason'],
                'changes' => $changes->all(),
            ]);

            $this->recordEvent($request, $teacher, 'submitted_to_chair', null, $request->status, $request->reason);
            $this->notifyChair($request, $class);

            return $request->fresh();
        });
    }

    public function chairDecision(User $chair, GradeChangeRequest $request, string $decision, ?string $note): GradeChangeRequest
    {
        abort_unless($chair->position === User::POSITION_HEAD_DEPARTMENT, 403);
        $request->loadMissing('submission.schoolClass');
        abort_unless($this->classBelongsToDepartment($request->submission->schoolClass, $chair->academicDepartment()->first()), 403);
        $this->requireNoteForRejection($decision, $note);

        return DB::transaction(function () use ($chair, $request, $decision, $note) {
            $locked = GradeChangeRequest::query()->lockForUpdate()->findOrFail($request->id);
            if ($locked->status !== GradeChangeRequest::STATUS_CHAIR_REVIEW) {
                throw ValidationException::withMessages(['request' => 'This grade change request is no longer waiting for chair review.']);
            }

            $fromStatus = $locked->status;
            $toStatus = $decision === 'approve'
                ? GradeChangeRequest::STATUS_REGISTRAR_REVIEW
                : GradeChangeRequest::STATUS_REJECTED;
            $locked->update([
                'status' => $toStatus,
                'chair_reviewed_by' => $chair->id,
                'chair_reviewed_at' => now(),
                'chair_note' => $note,
            ]);

            $this->recordEvent($locked, $chair, $decision === 'approve' ? 'chair_approved' : 'chair_rejected', $fromStatus, $toStatus, $note);
            if ($decision === 'approve') {
                $this->notifyRegistrars($locked);
            } else {
                $this->notifyTeacher($locked, 'Grade change request rejected', 'The Department Chair rejected the request: ' . $note);
            }

            return $locked->fresh();
        });
    }

    public function registrarDecision(
        User $registrar,
        GradeChangeRequest $request,
        string $decision,
        ?string $note,
        GradeWorkflowService $workflow,
        PointsService $points
    ): GradeChangeRequest {
        abort_unless(in_array($registrar->role, [User::ROLE_REGISTRAR, User::ROLE_ADMIN], true), 403);
        $this->requireNoteForRejection($decision, $note);

        return DB::transaction(function () use ($registrar, $request, $decision, $note, $workflow, $points) {
            $locked = GradeChangeRequest::query()
                ->with('submission.schoolClass')
                ->lockForUpdate()
                ->findOrFail($request->id);
            if ($locked->status !== GradeChangeRequest::STATUS_REGISTRAR_REVIEW) {
                throw ValidationException::withMessages(['request' => 'This grade change request is no longer waiting for Registrar review.']);
            }

            $fromStatus = $locked->status;
            $submission = $locked->submission;
            $class = $submission->schoolClass;

            if ($decision === 'approve') {
                $isCollege = $workflow->isCollegeClass($class);
                $studentIds = collect($locked->changes)->pluck('student_id')->map(fn ($id) => (int) $id);
                $grades = Grade::query()
                    ->where('school_class_id', $class->id)
                    ->where('school_year', $submission->school_year)
                    ->where('quarter', $submission->quarter)
                    ->whereIn('student_id', $studentIds)
                    ->lockForUpdate()
                    ->get()
                    ->keyBy('student_id');
                $semester = Section::query()
                    ->where('program_type', 'college')
                    ->where('name', $class->section)
                    ->where('year_level', $class->grade_level)
                    ->where('school_year', $class->school_year)
                    ->value('semester');

                foreach ($locked->changes as $change) {
                    $studentId = (int) $change['student_id'];
                    $grade = $grades->get($studentId);
                    if (!$grade || (float) $grade->score !== (float) $change['old_score']) {
                        throw ValidationException::withMessages(['request' => 'A published score changed while this request was under review. Reject this request and submit a new one.']);
                    }

                    $grade->update([
                        'score' => $change['new_score'],
                        'remarks' => $change['new_remarks'],
                    ]);
                    $student = Student::query()->findOrFail($studentId);
                    $points->awardGradePoints(
                        $student,
                        (float) $change['new_score'],
                        "grade:{$studentId}:{$class->id}:{$submission->quarter}:{$submission->school_year}",
                        $registrar,
                        $submission->school_year,
                        $semester,
                        ['grade_id' => $grade->id, 'school_class_id' => $class->id, 'quarter' => $submission->quarter],
                        $isCollege
                    );
                    $this->notifyParent($student, $grade);
                }

                $changeMap = collect($locked->changes)->keyBy('student_id');
                $updatedSnapshot = collect($submission->grades ?? [])->map(function (array $line) use ($changeMap) {
                    $change = $changeMap->get($line['student_id'] ?? null);
                    if ($change) {
                        $line['score'] = $change['new_score'];
                        $line['remarks'] = $change['new_remarks'];
                    }
                    return $line;
                })->all();
                $submission->update(['grades' => $updatedSnapshot]);
                GradeSubmissionEvent::create([
                    'grade_submission_id' => $submission->id,
                    'actor_id' => $registrar->id,
                    'action' => 'grade_change_approved',
                    'from_status' => GradeSubmission::STATUS_FINALIZED,
                    'to_status' => GradeSubmission::STATUS_FINALIZED,
                    'revision' => $submission->revision,
                    'note' => $note ?: $locked->reason,
                    'grade_snapshot' => $updatedSnapshot,
                    'created_at' => now(),
                ]);
            }

            $toStatus = $decision === 'approve'
                ? GradeChangeRequest::STATUS_APPROVED
                : GradeChangeRequest::STATUS_REJECTED;
            $locked->update([
                'status' => $toStatus,
                'registrar_reviewed_by' => $registrar->id,
                'registrar_reviewed_at' => now(),
                'registrar_note' => $note,
                'approved_at' => $decision === 'approve' ? now() : null,
            ]);
            $this->recordEvent($locked, $registrar, $decision === 'approve' ? 'registrar_approved' : 'registrar_rejected', $fromStatus, $toStatus, $note);
            $this->notifyTeacher(
                $locked,
                $decision === 'approve' ? 'Grade change approved' : 'Grade change request rejected',
                $decision === 'approve'
                    ? 'The Registrar approved and published the requested grade corrections.'
                    : 'The Registrar rejected the request: ' . $note
            );

            return $locked->fresh();
        });
    }

    private function requireNoteForRejection(string $decision, ?string $note): void
    {
        if ($decision === 'reject' && trim((string) $note) === '') {
            throw ValidationException::withMessages(['note' => 'Add a reason when rejecting a grade change request.']);
        }
    }

    private function recordEvent(
        GradeChangeRequest $request,
        User $actor,
        string $action,
        ?string $fromStatus,
        string $toStatus,
        ?string $note
    ): void {
        GradeChangeRequestEvent::create([
            'grade_change_request_id' => $request->id,
            'actor_id' => $actor->id,
            'action' => $action,
            'from_status' => $fromStatus,
            'to_status' => $toStatus,
            'note' => $note,
            'changes_snapshot' => $request->changes ?? [],
            'created_at' => now(),
        ]);
    }

    private function notifyChair(GradeChangeRequest $request, SchoolClass $class): void
    {
        $section = $this->sectionForClass($class);
        $departmentId = $section
            ? Course::query()
                ->where('name', $section->course)
                ->where('program_type', 'college')
                ->value('department_id')
            : null;
        $chairId = $departmentId
            ? Department::query()->whereKey($departmentId)->value('chair_user_id')
            : null;

        if (!$chairId) {
            throw ValidationException::withMessages(['submission' => 'Assign a Department Chair before submitting a grade change request.']);
        }

        $this->notify((int) $chairId, 'Grade change request awaiting review', 'A teacher submitted a finalized-grade correction request.', $request);
    }

    private function notifyRegistrars(GradeChangeRequest $request): void
    {
        foreach (User::query()->where('role', User::ROLE_REGISTRAR)->pluck('id') as $registrarId) {
            $this->notify((int) $registrarId, 'Grade change request awaiting Registrar review', 'The Department Chair approved a grade change request.', $request);
        }
    }

    private function notifyTeacher(GradeChangeRequest $request, string $title, string $body): void
    {
        if ($request->teacher_id) {
            $this->notify($request->teacher_id, $title, $body, $request);
        }
    }

    private function notify(int $userId, string $title, string $body, GradeChangeRequest $request): void
    {
        SchoolNotification::create([
            'user_id' => $userId,
            'type' => 'grade_change_request',
            'title' => $title,
            'body' => $body,
            'channels' => ['in_app'],
            'data' => ['grade_change_request_id' => $request->id, 'grade_submission_id' => $request->grade_submission_id],
        ]);
    }

    private function notifyParent(Student $student, Grade $grade): void
    {
        if (!$student->parent_user_id) {
            return;
        }

        SchoolNotification::create([
            'user_id' => $student->parent_user_id,
            'type' => 'grade_change_request',
            'title' => 'Grade corrected',
            'body' => "{$student->first_name} {$student->last_name}'s Q{$grade->quarter} grade was corrected to {$grade->score}.",
            'channels' => ['in_app'],
            'data' => ['student_id' => $student->id, 'grade_id' => $grade->id],
        ]);
    }

    private function sectionForClass(SchoolClass $class): ?Section
    {
        return Section::query()
            ->where('program_type', 'college')
            ->where('name', $class->section)
            ->where('year_level', $class->grade_level)
            ->where('school_year', $class->school_year)
            ->first();
    }

    private function classBelongsToDepartment(SchoolClass $class, ?Department $department): bool
    {
        if (!$department) {
            return false;
        }

        $courseNames = $department->courses()->where('program_type', 'college')->pluck('name');
        if ($courseNames->isEmpty()) {
            return false;
        }

        return Section::query()
            ->where('program_type', 'college')
            ->whereIn('course', $courseNames)
            ->where('name', $class->section)
            ->where('year_level', $class->grade_level)
            ->where('school_year', $class->school_year)
            ->whereHas('sectionSubjects', fn ($query) => $query
                ->whereHas('subject', fn ($subjectQuery) => $subjectQuery->where('name', $class->subject)))
            ->exists();
    }
}