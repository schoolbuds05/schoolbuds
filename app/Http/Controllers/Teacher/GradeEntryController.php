<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use App\Models\AcademicTerm;
use App\Models\SchoolClass;
use App\Models\SectionSubject;
use App\Models\Grade;
use App\Models\GradeChangeRequest;
use App\Models\GradeSubmission;
use App\Services\GradeWorkflowService;
use Illuminate\Http\Request;

class GradeEntryController extends Controller
{
    public function index(Request $request, SchoolClass $class, GradeWorkflowService $workflow)
    {
        abort_unless((int) $class->teacher_id === (int) auth()->id(), 403);

        $view = $request->query('view') === 'past' || !$this->isCurrentClass($class)
            ? 'past'
            : 'current';
        $students = $workflow->classStudents($class);
        $isCollege = $workflow->isCollegeClass($class);

        $quarters = ['1','2','3','4'];

        $grades = Grade::where('school_class_id', $class->id)
            ->get()
            ->keyBy(fn (Grade $grade) => $grade->student_id . '_' . $grade->quarter);
        $submissions = GradeSubmission::query()
            ->where('school_class_id', $class->id)
            ->where('school_year', $class->school_year)
            ->get()
            ->keyBy('quarter');
        $changeRequests = GradeChangeRequest::query()
            ->whereIn('grade_submission_id', $submissions->pluck('id'))
            ->with('events.actor')
            ->orderByDesc('created_at')
            ->get()
            ->groupBy('grade_submission_id')
            ->map(fn ($requests) => $requests->first());

        return view('teacher.grades', compact('class', 'students', 'grades', 'quarters', 'submissions', 'changeRequests', 'isCollege', 'view'));
    }

    private function isCurrentClass(SchoolClass $class): bool
    {
        $activeTerm = AcademicTerm::query()->latest('updated_at')->first();
        if (!$activeTerm) {
            return false;
        }

        return SectionSubject::query()
            ->where('teacher_id', $class->teacher_id)
            ->whereHas('section', fn ($query) => $query
                ->where('name', $class->section)
                ->where('year_level', $class->grade_level)
                ->where('school_year', $class->school_year)
                ->where('school_year', $activeTerm->school_year)
                ->where('semester', $activeTerm->semester))
            ->whereHas('subject', fn ($query) => $query->where('name', $class->subject))
            ->exists();
    }

    public function store(Request $request, SchoolClass $class, GradeWorkflowService $workflow)
    {
        $limits = $workflow->scoreLimits($class);
        $data = $request->validate([
            'intent' => ['required', 'in:draft,submit'],
            'quarter_display' => ['required', 'in:1,2,3,4'],
            'grades' => ['required', 'array'],
            'grades.*.student_id' => ['required', 'integer', 'exists:students,id'],
            'grades.*.quarter' => ['required', 'in:1,2,3,4'],
                'grades.*.score' => array_merge(
                ['nullable', 'numeric', 'min:' . $limits['min'], 'max:' . $limits['max']],
                $limits['is_college'] ? ['multiple_of:0.25'] : []
            ),
        ]);

        $submission = $workflow->saveTeacherGrades(
            $request->user(),
            $class,
            $data['quarter_display'],
            $data['grades'],
            $data['intent'] === 'submit'
        );

        $message = $submission->status === GradeSubmission::STATUS_CHAIR_REVIEW
            ? 'Grade sheet submitted to the Department Chair.'
            : 'Grade draft saved.';

        return back()->with('status', $message);
    }
}