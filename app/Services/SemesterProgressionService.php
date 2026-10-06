<?php

namespace App\Services;

use App\Models\EnrollmentApplication;
use App\Models\Grade;
use App\Models\GradeSubmission;
use App\Models\Student;
use App\Models\StudentSubject;
use App\Models\Subject;
use App\Models\User;

class SemesterProgressionService
{
    public function evaluateFirstSemester(User $user, string $schoolYear): array
    {
        $subjectIds = EnrollmentApplication::query()
            ->where('user_id', $user->id)
            ->where('status', 'approved')
            ->where('school_year', $schoolYear)
            ->where('semester', '1st')
            ->latest('created_at')
            ->first(['subject_ids'])
            ?->subject_ids ?? [];
        $subjectIds = collect($subjectIds)
            ->map(fn ($id) => (int) $id)
            ->filter()
            ->unique()
            ->values();

        if ($subjectIds->isEmpty()) {
            return ['can_proceed' => true, 'requires_irregular' => false, 'failed_subjects' => [], 'message' => null];
        }

        $student = Student::query()->where('user_id', $user->id)->first();
        if (!$student) {
            return [
                'can_proceed' => false,
                'requires_irregular' => false,
                'failed_subjects' => [],
                'message' => 'Your student record is unavailable. Please contact the Registrar to verify your eligibility.',
            ];
        }

        $subjects = Subject::query()->whereIn('id', $subjectIds)->get()->keyBy('id');
        $missing = [];
        $failed = [];

        foreach ($subjectIds as $subjectId) {
            $subject = $subjects->get($subjectId);
            $label = $subject?->code ?: $subject?->name ?: "Subject #{$subjectId}";

            if (!$subject) {
                $missing[] = $label;
            } elseif (!$this->studentPassedSubject($student, $subject, $schoolYear)) {
                if (!$this->hasFinalizedQ4Grade($student, $subject, $schoolYear)) {
                    $missing[] = $label;
                } else {
                    $failed[] = $label;
                }
            }
        }

        if ($missing) {
            return [
                'can_proceed' => false,
                'requires_irregular' => false,
                'failed_subjects' => $failed,
                'message' => 'Enrollment is paused until finalized Q4 grades are available for: ' . implode(', ', $missing) . '.',
            ];
        }

        return [
            'can_proceed' => true,
            'requires_irregular' => !empty($failed),
            'failed_subjects' => $failed,
            'message' => $failed
                ? 'Failed first-semester subjects: ' . implode(', ', $failed) . '. Your academic status will be Irregular for this enrollment.'
                : null,
        ];
    }

    public function studentPassedSubject(Student $student, Subject $subject, ?string $schoolYear = null): bool
    {
        if (StudentSubject::query()
            ->where('user_id', $student->user_id)
            ->where('subject_id', $subject->id)
            ->where('status', 'completed')
            ->exists()) {
            return true;
        }

        return $this->q4GradesForSubject($student, $subject, $schoolYear)
            ->get(['score'])
            ->contains(fn (Grade $grade) => $subject->program_type === 'college'
                ? (float) $grade->score <= 3.0
                : (float) $grade->score >= 75);
    }

    public function hasFinalizedQ4Grade(Student $student, Subject $subject, ?string $schoolYear = null): bool
    {
        return $this->q4GradesForSubject($student, $subject, $schoolYear)
            ->whereNotNull('grades.score')
            ->exists();
    }

    private function q4GradesForSubject(Student $student, Subject $subject, ?string $schoolYear)
    {
        return Grade::query()
            ->where('grades.student_id', $student->id)
            ->where('grades.quarter', '4')
            ->when($schoolYear, fn ($query) => $query->where('grades.school_year', $schoolYear))
            ->whereHas('schoolClass', function ($query) use ($subject) {
                $query->whereIn('school_classes.subject', array_filter([$subject->name, $subject->code]))
                    ->whereExists(function ($sectionQuery) use ($subject) {
                        $sectionQuery->selectRaw('1')
                            ->from('sections')
                            ->join('section_subjects', 'section_subjects.section_id', '=', 'sections.id')
                            ->whereColumn('sections.name', 'school_classes.section')
                            ->whereColumn('sections.year_level', 'school_classes.grade_level')
                            ->whereColumn('sections.school_year', 'school_classes.school_year')
                            ->where('sections.program_type', $subject->program_type)
                            ->when($subject->semester, fn ($sectionQuery) => $sectionQuery->where('sections.semester', $subject->semester))
                            ->where('section_subjects.subject_id', $subject->id);
                    });
            })
            ->whereExists(function ($query) {
                $query->selectRaw('1')
                    ->from('grade_submissions')
                    ->whereColumn('grade_submissions.school_class_id', 'grades.school_class_id')
                    ->whereColumn('grade_submissions.school_year', 'grades.school_year')
                    ->whereColumn('grade_submissions.quarter', 'grades.quarter')
                    ->where('grade_submissions.status', GradeSubmission::STATUS_FINALIZED);
            });
    }
}