<?php

namespace App\Services;

use App\Models\Course;
use App\Models\Department;
use App\Models\AcademicTerm;
use App\Models\Grade;
use App\Models\GradeSubmission;
use App\Models\GradeSubmissionEvent;
use App\Models\SchoolClass;
use App\Models\SchoolNotification;
use App\Models\Section;
use App\Models\SectionSubject;
use App\Models\Student;
use App\Models\StudentSubject;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class GradeWorkflowService
{
    public function classStudents(SchoolClass $class): Collection
    {
        $sectionSubject = $this->sectionSubjectForClass($class);

        if ($sectionSubject) {
            $userIds = $sectionSubject->section->students()
                ->wherePivot('status', 'enrolled')
                ->pluck('users.id');
            $droppedIds = StudentSubject::query()
                ->where('section_id', $sectionSubject->section_id)
                ->where('subject_id', $sectionSubject->subject_id)
                ->where('status', 'dropped')
                ->pluck('user_id');

            return Student::query()
                ->whereIn('user_id', $userIds->diff($droppedIds))
                ->orderBy('last_name')
                ->orderBy('first_name')
                ->get();
        }

        return Student::query()
            ->where('grade_level', $class->grade_level)
            ->where('section', $class->section)
            ->where('school_year', $class->school_year)
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->get();
    }

    public function scoreLimits(SchoolClass $class): array
    {
        return $this->isCollegeClass($class)
            ? ['min' => 1, 'max' => 5, 'step' => 0.25, 'is_college' => true]
            : ['min' => 1, 'max' => 100, 'step' => 1, 'is_college' => false];
    }

    public function isCollegeClass(SchoolClass $class): bool
    {
        $sectionSubject = $this->sectionSubjectForClass($class);
        if ($sectionSubject) {
            return $sectionSubject->section?->program_type === 'college';
        }

        return (bool) $class->is_college;
    }

    public function saveTeacherGrades(
        User $teacher,
        SchoolClass $class,
        string $quarter,
        array $gradeRows,
        bool $submit
    ): GradeSubmission {
        abort_unless((int) $class->teacher_id === (int) $teacher->id, 403);

        $sectionSubject = $this->sectionSubjectForClass($class);
        $termQuery = AcademicTerm::query()->where('school_year', $class->school_year);
        if ($sectionSubject?->section?->semester) {
            $termQuery->where('semester', $sectionSubject->section->semester);
        }
        $term = $termQuery->first();
        if ($term?->grade_finalization_deadline && now()->gt($term->grade_finalization_deadline)) {
            throw ValidationException::withMessages([
                'grades' => 'Grade entry is closed for this term. Finalization deadline was ' . $term->grade_finalization_deadline->toDateTimeString() . '.',
            ]);
        }

        $roster = $this->classStudents($class)->keyBy('id');
        $limits = $this->scoreLimits($class);
        $lines = collect($gradeRows)->map(function (array $row) use ($roster, $quarter, $limits) {
            $studentId = (int) ($row['student_id'] ?? 0);
            $student = $roster->get($studentId);
            if (!$student) {
                throw ValidationException::withMessages(['grades' => 'A student is not enrolled in this class. Refresh the roster and try again.']);
            }

            if ((string) ($row['quarter'] ?? '') !== $quarter) {
                throw ValidationException::withMessages(['grades' => 'All grades in a submission must belong to the selected quarter.']);
            }

            $score = ($row['score'] ?? '') === '' ? null : (float) $row['score'];
            if ($score !== null && ($score < $limits['min'] || $score > $limits['max'])) {
                throw ValidationException::withMessages([
                    'grades' => "Scores for this class must be between {$limits['min']} and {$limits['max']}.",
                ]);
            }
            if ($score !== null && $limits['is_college'] && abs(($score * 4) - round($score * 4)) > 0.00001) {
                throw ValidationException::withMessages(['grades' => 'College grades must use quarter-point increments.']);
            }

            return [
                'student_id' => $student->id,
                'student_code' => $student->student_id,
                'student_name' => trim($student->first_name . ' ' . $student->last_name),
                'score' => $score,
                'remarks' => $score === null ? null : $this->remark($score, $limits['is_college']),
            ];
        })->values();

        if ($lines->pluck('student_id')->unique()->count() !== $lines->count()) {
            throw ValidationException::withMessages(['grades' => 'Duplicate students were included in the grade sheet.']);
        }

        if ($submit) {
            $missingStudents = $roster->keys()->diff($lines->pluck('student_id'));
            if ($roster->isEmpty() || $missingStudents->isNotEmpty() || $lines->contains(fn ($line) => $line['score'] === null)) {
                throw ValidationException::withMessages(['grades' => 'Enter a score for every enrolled student before submitting the grade sheet.']);
            }
        }

        return DB::transaction(function () use ($teacher, $class, $quarter, $lines, $submit) {
            $submission = GradeSubmission::query()
                ->where('school_class_id', $class->id)
                ->where('school_year', $class->school_year)
                ->where('quarter', $quarter)
                ->lockForUpdate()
                ->first();

            if ($submission && !in_array($submission->status, [
                GradeSubmission::STATUS_DRAFT,
                GradeSubmission::STATUS_TEACHER_REVISION,
            ], true)) {
                throw ValidationException::withMessages(['grades' => 'This grade sheet is already under review or finalized and cannot be edited.']);
            }

            $fromStatus = $submission?->status;
            $submission ??= new GradeSubmission();
            $submission->fill([
                'school_class_id' => $class->id,
                'teacher_id' => $teacher->id,
                'school_year' => $class->school_year,
                'quarter' => $quarter,
                'status' => $submit ? GradeSubmission::STATUS_CHAIR_REVIEW : ($fromStatus ?? GradeSubmission::STATUS_DRAFT),
                'revision' => ($submission->exists ? $submission->revision : 0) + 1,
                'grades' => $lines->all(),
                'submitted_at' => $submit ? now() : $submission->submitted_at,
                'chair_reviewed_by' => $submit ? null : $submission->chair_reviewed_by,
                'chair_reviewed_at' => $submit ? null : $submission->chair_reviewed_at,
                'chair_note' => $submit ? null : $submission->chair_note,
                'registrar_reviewed_by' => $submit ? null : $submission->registrar_reviewed_by,
                'registrar_reviewed_at' => $submit ? null : $submission->registrar_reviewed_at,
                'registrar_note' => $submit ? null : $submission->registrar_note,
                'finalized_at' => null,
            ]);
            $submission->save();

            $this->recordEvent(
                $submission,
                $teacher,
                $submit ? 'submitted_to_chair' : 'draft_saved',
                $fromStatus,
                $submission->status,
                null
            );

            if ($submit) {
                $this->notifyChair($class, $submission, $teacher->name);
            }

            return $submission->fresh();
        });
    }

    public function saveAssignmentGrade(User $teacher, SchoolClass $class, Student $student, string $quarter, float $score): void
    {
        abort_unless((int) $class->teacher_id === (int) $teacher->id, 403);
        $roster = $this->classStudents($class)->keyBy('id');
        abort_unless($roster->has($student->id), 422, 'This student is not enrolled in the class.');
        $limits = $this->scoreLimits($class);
        $score = $limits['is_college']
            ? $this->collegeGradeFromPercentage($score)
            : max(1, min(100, $score));

        DB::transaction(function () use ($teacher, $class, $student, $quarter, $score, $roster, $limits) {
            $submission = GradeSubmission::query()
                ->where('school_class_id', $class->id)
                ->where('school_year', $class->school_year)
                ->where('quarter', $quarter)
                ->lockForUpdate()
                ->first();

            if ($submission && !in_array($submission->status, [
                GradeSubmission::STATUS_DRAFT,
                GradeSubmission::STATUS_TEACHER_REVISION,
            ], true)) {
                throw ValidationException::withMessages(['grades' => 'This grade sheet is under review or finalized. The assignment score was not synced.']);
            }

            $lines = collect($submission?->grades ?? []);
            if ($lines->isEmpty()) {
                $existingGrades = Grade::query()
                    ->where('school_class_id', $class->id)
                    ->where('school_year', $class->school_year)
                    ->where('quarter', $quarter)
                    ->get()
                    ->keyBy('student_id');
                $lines = $roster->map(fn (Student $rosterStudent) => [
                    'student_id' => $rosterStudent->id,
                    'student_code' => $rosterStudent->student_id,
                    'student_name' => trim($rosterStudent->first_name . ' ' . $rosterStudent->last_name),
                    'score' => $existingGrades->get($rosterStudent->id)?->score,
                    'remarks' => $existingGrades->get($rosterStudent->id)?->remarks,
                ])->values();
            }

            $lines = $lines->map(function (array $line) use ($student, $score) {
                if ((int) $line['student_id'] === (int) $student->id) {
                    $line['score'] = $score;
                    $line['remarks'] = $this->remark($score, $limits['is_college']);
                }
                return $line;
            })->values();

            $fromStatus = $submission?->status;
            $submission ??= new GradeSubmission();
            $submission->fill([
                'school_class_id' => $class->id,
                'teacher_id' => $teacher->id,
                'school_year' => $class->school_year,
                'quarter' => $quarter,
                'status' => $fromStatus ?? GradeSubmission::STATUS_DRAFT,
                'revision' => ($submission->exists ? $submission->revision : 0) + 1,
                'grades' => $lines->all(),
            ]);
            $submission->save();

            $this->recordEvent($submission, $teacher, 'assignment_grade_saved_to_draft', $fromStatus, $submission->status, null);
        });
    }

    public function chairDecision(User $chair, GradeSubmission $submission, string $decision, ?string $note): GradeSubmission
    {
        abort_unless($chair->position === User::POSITION_HEAD_DEPARTMENT, 403);
        $submission->loadMissing('schoolClass');
        abort_unless($this->classBelongsToDepartment($submission->schoolClass, $chair->academicDepartment()->first()), 403);

        if ($decision === 'return' && trim((string) $note) === '') {
            throw ValidationException::withMessages(['note' => 'Add a note explaining what the teacher needs to correct.']);
        }

        return DB::transaction(function () use ($chair, $submission, $decision, $note) {
            $locked = GradeSubmission::query()->lockForUpdate()->findOrFail($submission->id);
            $allowedStatuses = [GradeSubmission::STATUS_CHAIR_REVIEW, GradeSubmission::STATUS_REGISTRAR_RETURNED];
            if (!in_array($locked->status, $allowedStatuses, true)) {
                throw ValidationException::withMessages(['submission' => 'This grade sheet is no longer waiting for your decision.']);
            }

            $fromStatus = $locked->status;
            $toStatus = $decision === 'approve'
                ? GradeSubmission::STATUS_REGISTRAR_REVIEW
                : GradeSubmission::STATUS_TEACHER_REVISION;
            $locked->update([
                'status' => $toStatus,
                'chair_reviewed_by' => $chair->id,
                'chair_reviewed_at' => now(),
                'chair_note' => $note,
            ]);
            $this->recordEvent($locked, $chair, $decision === 'approve' ? 'chair_approved' : 'chair_returned_to_teacher', $fromStatus, $toStatus, $note);

            if ($decision === 'approve') {
                $this->notifyRegistrars($locked, $chair->name);
            } else {
                $this->notifyTeacher($locked, 'Grade sheet returned', 'The Department Chair returned this grade sheet for correction: ' . $note);
            }

            return $locked->fresh();
        });
    }

    public function registrarDecision(User $registrar, GradeSubmission $submission, string $decision, ?string $note, PointsService $points): GradeSubmission
    {
        abort_unless(in_array($registrar->role, [User::ROLE_REGISTRAR, User::ROLE_ADMIN], true), 403);

        if ($decision === 'return' && trim((string) $note) === '') {
            throw ValidationException::withMessages(['note' => 'Add a note explaining why the grade sheet is being returned.']);
        }

        return DB::transaction(function () use ($registrar, $submission, $decision, $note, $points) {
            $locked = GradeSubmission::query()
                ->with('schoolClass')
                ->lockForUpdate()
                ->findOrFail($submission->id);
            if ($locked->status !== GradeSubmission::STATUS_REGISTRAR_REVIEW) {
                throw ValidationException::withMessages(['submission' => 'This grade sheet is no longer waiting for Registrar review.']);
            }

            $fromStatus = $locked->status;
            if ($decision === 'return') {
                $locked->update([
                    'status' => GradeSubmission::STATUS_REGISTRAR_RETURNED,
                    'registrar_reviewed_by' => $registrar->id,
                    'registrar_reviewed_at' => now(),
                    'registrar_note' => $note,
                ]);
                $this->recordEvent($locked, $registrar, 'registrar_returned_to_chair', $fromStatus, $locked->status, $note);
                $this->notifyChair($locked->schoolClass, $locked, 'The Registrar returned a grade sheet: ' . $note);

                return $locked->fresh();
            }

            $class = $locked->schoolClass;
            $roster = $this->classStudents($class)->keyBy('id');
            $grades = collect($locked->grades ?? []);
            $submittedIds = $grades->pluck('student_id')->map(fn ($id) => (int) $id)->sort()->values();
            $currentIds = $roster->keys()->map(fn ($id) => (int) $id)->sort()->values();
            if ($grades->contains(fn ($line) => $line['score'] === null) || $submittedIds->all() !== $currentIds->all()) {
                throw ValidationException::withMessages(['submission' => 'The enrolled roster changed after submission. Return this sheet to the teacher for a fresh grade sheet.']);
            }

            $sectionSubject = $this->sectionSubjectForClass($class);
            $isCollege = $this->isCollegeClass($class);
            foreach ($grades as $line) {
                $student = $roster->get((int) $line['student_id']);
                if (!$student) {
                    throw ValidationException::withMessages(['submission' => 'A submitted student is no longer enrolled in this class.']);
                }

                $grade = Grade::updateOrCreate(
                    [
                        'student_id' => $student->id,
                        'school_class_id' => $class->id,
                        'quarter' => $locked->quarter,
                        'school_year' => $locked->school_year,
                    ],
                    [
                        'score' => $line['score'],
                        'remarks' => $line['remarks'] ?? $this->remark((float) $line['score'], $isCollege),
                    ]
                );

                $points->awardGradePoints(
                    $student,
                    (float) $line['score'],
                    "grade:{$student->id}:{$class->id}:{$locked->quarter}:{$locked->school_year}",
                    $registrar,
                    $locked->school_year,
                    $sectionSubject?->section?->semester,
                    ['grade_id' => $grade->id, 'school_class_id' => $class->id, 'quarter' => $locked->quarter],
                    $isCollege
                );
                $this->notifyParent($student, $grade, $isCollege);
            }

            $locked->update([
                'status' => GradeSubmission::STATUS_FINALIZED,
                'registrar_reviewed_by' => $registrar->id,
                'registrar_reviewed_at' => now(),
                'registrar_note' => $note,
                'finalized_at' => now(),
            ]);
            $this->recordEvent($locked, $registrar, 'registrar_finalized', $fromStatus, $locked->status, $note);
            $this->notifyTeacher($locked, 'Grades finalized', 'The Registrar approved and published this grade sheet.');

            return $locked->fresh();
        });
    }

    private function sectionSubjectForClass(SchoolClass $class): ?SectionSubject
    {
        return SectionSubject::query()
            ->with(['section.students', 'subject'])
            ->whereHas('section', fn ($query) => $query
                ->where('name', $class->section)
                ->where('year_level', $class->grade_level)
                ->where('school_year', $class->school_year))
            ->whereHas('subject', fn ($query) => $query->where('name', $class->subject))
            ->when($class->teacher_id, fn ($query) => $query->where('teacher_id', $class->teacher_id))
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

    private function recordEvent(
        GradeSubmission $submission,
        User $actor,
        string $action,
        ?string $fromStatus,
        string $toStatus,
        ?string $note
    ): void {
        GradeSubmissionEvent::create([
            'grade_submission_id' => $submission->id,
            'actor_id' => $actor->id,
            'action' => $action,
            'from_status' => $fromStatus,
            'to_status' => $toStatus,
            'revision' => $submission->revision,
            'note' => $note,
            'grade_snapshot' => $submission->grades ?? [],
            'created_at' => now(),
        ]);
    }

    private function notifyChair(SchoolClass $class, GradeSubmission $submission, string $body): void
    {
        $sectionSubject = $this->sectionSubjectForClass($class);
        $course = Course::query()
            ->where('name', $sectionSubject?->section?->course)
            ->where('program_type', 'college')
            ->with('department')
            ->first();
        $chairId = $course?->department?->chair_user_id;

        if ($chairId) {
            $this->notify($chairId, 'Grade sheet awaiting review', $body, $submission);
        }
    }

    private function notifyRegistrars(GradeSubmission $submission, string $chairName): void
    {
        foreach (User::query()->where('role', User::ROLE_REGISTRAR)->pluck('id') as $registrarId) {
            $this->notify($registrarId, 'Grade sheet awaiting Registrar review', "{$chairName} approved a grade sheet.", $submission);
        }
    }

    private function notifyTeacher(GradeSubmission $submission, string $title, string $body): void
    {
        if ($submission->teacher_id) {
            $this->notify($submission->teacher_id, $title, $body, $submission);
        }
    }

    private function notify(int $userId, string $title, string $body, GradeSubmission $submission): void
    {
        SchoolNotification::create([
            'user_id' => $userId,
            'type' => 'grade_workflow',
            'title' => $title,
            'body' => $body,
            'channels' => ['in_app'],
            'data' => ['grade_submission_id' => $submission->id],
        ]);
    }

    private function notifyParent(Student $student, Grade $grade, bool $isCollege): void
    {
        if (!$student->parent_user_id) {
            return;
        }

        SchoolNotification::create([
            'user_id' => $student->parent_user_id,
            'type' => (float) $grade->score > ($isCollege ? 3 : 74) ? 'low_grade_alert' : 'grade_posted_parent',
            'title' => (float) $grade->score > ($isCollege ? 3 : 74) ? 'Low grade alert' : 'Grade posted',
            'body' => "{$student->first_name} {$student->last_name} received {$grade->score} for Q{$grade->quarter}.",
            'channels' => ['in_app'],
            'data' => ['student_id' => $student->id, 'grade_id' => $grade->id],
        ]);
    }

    private function remark(float $score, bool $isCollege = false): string
    {
        if ($isCollege) {
            return match (true) {
                $score <= 1.5 => 'Outstanding',
                $score <= 2 => 'Very Satisfactory',
                $score <= 2.5 => 'Satisfactory',
                $score <= 3 => 'Fairly Satisfactory',
                $score <= 4 => 'Conditional',
                default => 'Did Not Meet Expectations',
            };
        }

        return match (true) {
            $score >= 90 => 'Outstanding',
            $score >= 85 => 'Very Satisfactory',
            $score >= 80 => 'Satisfactory',
            $score >= 75 => 'Fairly Satisfactory',
            default => 'Did Not Meet Expectations',
        };
    }

    public function remarkForScore(float $score, bool $isCollege = false): string
    {
        return $this->remark($score, $isCollege);
    }

    private function collegeGradeFromPercentage(float $percentage): float
    {
        return match (true) {
            $percentage >= 97 => 1.00,
            $percentage >= 94 => 1.25,
            $percentage >= 91 => 1.50,
            $percentage >= 88 => 1.75,
            $percentage >= 85 => 2.00,
            $percentage >= 82 => 2.25,
            $percentage >= 79 => 2.50,
            $percentage >= 76 => 2.75,
            $percentage >= 75 => 3.00,
            $percentage >= 70 => 4.00,
            default => 5.00,
        };
    }
}
