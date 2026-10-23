<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\GradeChangeRequest;
use App\Models\Grade;
use App\Models\GradeSubmission;
use App\Models\Section;
use App\Models\Student;
use App\Services\GradeChangeRequestService;
use App\Services\GradeCsvTransferService;
use App\Services\GradeWorkflowService;
use App\Services\PointsService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RegistrarGradeController extends Controller
{
    public function index(Request $request)
    {
        abort_unless($request->user()->hasAnyRole(['admin', 'registrar']), 403);

        $approved = $request->query('view') === 'approved';
        $submissions = GradeSubmission::query()
            ->where('status', $approved ? GradeSubmission::STATUS_FINALIZED : GradeSubmission::STATUS_REGISTRAR_REVIEW)
            ->with(['schoolClass', 'teacher:id,name', 'events.actor:id,name'])
            ->orderByDesc($approved ? 'finalized_at' : 'submitted_at')
            ->limit(100)
            ->get()
            ->map(fn (GradeSubmission $submission) => $this->submissionPayload($submission))
            ->values();

        $changeRequests = GradeChangeRequest::query()
            ->whereIn('status', $approved
                ? [GradeChangeRequest::STATUS_APPROVED, GradeChangeRequest::STATUS_REJECTED]
                : [GradeChangeRequest::STATUS_REGISTRAR_REVIEW])
            ->with(['submission.schoolClass', 'teacher:id,name', 'events.actor:id,name'])
            ->orderByDesc('created_at')
            ->limit(100)
            ->get()
            ->map(function (GradeChangeRequest $changeRequest) {
                $submission = $changeRequest->submission;
                return [
                    'id' => $changeRequest->id,
                    'reason' => $changeRequest->reason,
                    'changes' => $changeRequest->changes ?? [],
                    'status' => $changeRequest->status,
                    'teacher' => ['name' => $changeRequest->teacher?->name ?? 'Account unavailable'],
                    'chair_note' => $changeRequest->chair_note,
                    'chair_reviewed_at' => $changeRequest->chair_reviewed_at,
                    'registrar_note' => $changeRequest->registrar_note,
                    'registrar_reviewed_at' => $changeRequest->registrar_reviewed_at,
                    'class' => $this->classPayload($submission?->schoolClass),
                    'quarter' => $submission?->quarter,
                    'school_year' => $submission?->school_year,
                    'events' => $changeRequest->events->map(fn ($event) => [
                        'actor' => $event->actor?->name ?? 'System',
                        'action' => $event->action,
                        'note' => $event->note,
                        'created_at' => $event->created_at,
                    ])->values(),
                ];
            })
            ->values();

        return response()->json([
            'view' => $approved ? 'approved' : 'awaiting',
            'submissions' => $submissions,
            'change_requests' => $changeRequests,
        ]);
    }

    public function studentGrades(Request $request)
    {
        abort_unless($request->user()->hasAnyRole(['admin', 'registrar']), 403);

        $search = trim((string) $request->query('search', ''));
        $searchTerms = preg_split('/\s+/', $search, -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $publishedGrades = function ($query) {
            $query->whereExists(function ($subquery) {
                $subquery->selectRaw('1')
                    ->from('grade_submissions')
                    ->whereColumn('grade_submissions.school_class_id', 'grades.school_class_id')
                    ->whereColumn('grade_submissions.school_year', 'grades.school_year')
                    ->whereColumn('grade_submissions.quarter', 'grades.quarter')
                    ->where('grade_submissions.status', GradeSubmission::STATUS_FINALIZED);
            });
        };

        $students = Student::query()
            ->whereHas('grades', $publishedGrades)
            ->when($searchTerms !== [], function ($query) use ($searchTerms) {
                foreach ($searchTerms as $term) {
                    $query->where(function ($studentQuery) use ($term) {
                        $studentQuery->where('student_id', 'like', "%{$term}%")
                            ->orWhere('first_name', 'like', "%{$term}%")
                            ->orWhere('last_name', 'like', "%{$term}%");
                    });
                }
            })
            ->with(['grades' => function ($query) use ($publishedGrades) {
                $publishedGrades($query);
                $query->with('schoolClass')
                    ->orderByDesc('school_year')
                    ->orderBy('quarter');
            }])
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->paginate(30);

        $students->getCollection()->transform(function (Student $student) {
            return [
                'id' => $student->id,
                'student_id' => $student->student_id,
                'name' => trim($student->first_name . ' ' . $student->last_name),
                'grades' => $student->grades->map(fn (Grade $grade) => [
                    'id' => $grade->id,
                    'school_year' => $grade->school_year,
                    'quarter' => $grade->quarter,
                    'score' => $grade->score,
                    'remarks' => $grade->remarks,
                    'class' => $this->classPayload($grade->schoolClass),
                ])->values(),
            ];
        });

        return response()->json($students);
    }

    public function reviewSubmission(Request $request, GradeSubmission $submission, GradeWorkflowService $workflow, PointsService $points)
    {
        abort_unless($request->user()->hasAnyRole(['admin', 'registrar']), 403);
        $data = $request->validate([
            'decision' => ['required', 'in:approve,return'],
            'note' => ['nullable', 'required_if:decision,return', 'string', 'max:2000'],
        ]);

        $updated = $workflow->registrarDecision($request->user(), $submission, $data['decision'], $data['note'] ?? null, $points);

        return response()->json([
            'message' => $data['decision'] === 'approve' ? 'Grade sheet finalized and published.' : 'Grade sheet returned to the Department Chair.',
            'submission' => $this->submissionPayload($updated->load(['schoolClass', 'teacher:id,name', 'events.actor:id,name'])),
        ]);
    }

    public function reviewChangeRequest(
        Request $request,
        GradeChangeRequest $changeRequest,
        GradeChangeRequestService $workflow,
        GradeWorkflowService $gradeWorkflow,
        PointsService $points
    ) {
        abort_unless($request->user()->hasAnyRole(['admin', 'registrar']), 403);
        $data = $request->validate([
            'decision' => ['required', 'in:approve,reject'],
            'note' => ['nullable', 'required_if:decision,reject', 'string', 'max:2000'],
        ]);

        $workflow->registrarDecision($request->user(), $changeRequest, $data['decision'], $data['note'] ?? null, $gradeWorkflow, $points);

        return response()->json([
            'message' => $data['decision'] === 'approve' ? 'Grade corrections approved and published.' : 'Grade change request rejected.',
        ]);
    }

    public function import(Request $request, GradeCsvTransferService $transfer)
    {
        abort_unless($request->user()->hasAnyRole(['admin', 'registrar']), 403);
        $request->validate(['grades_file' => ['required', 'file', 'mimes:csv,txt', 'max:10240']]);
        $count = $transfer->import($request->file('grades_file'), $request->user());

        return response()->json([
            'imported' => $count,
            'message' => "Imported {$count} finalized grade record(s). Existing grades were not changed.",
        ]);
    }

    private function submissionPayload(GradeSubmission $submission): array
    {
        return [
            'id' => $submission->id,
            'school_year' => $submission->school_year,
            'quarter' => $submission->quarter,
            'revision' => $submission->revision,
            'status' => $submission->status,
            'submitted_at' => $submission->submitted_at,
            'finalized_at' => $submission->finalized_at,
            'grades' => $submission->grades ?? [],
            'teacher' => ['name' => $submission->teacher?->name ?? 'Account unavailable'],
            'class' => $this->classPayload($submission->schoolClass),
            'events' => $submission->events->map(fn ($event) => [
                'actor' => $event->actor?->name ?? 'System',
                'action' => $event->action,
                'note' => $event->note,
                'created_at' => $event->created_at,
            ])->values(),
        ];
    }

    private function classPayload($schoolClass): ?array
    {
        if (!$schoolClass) return null;
        $section = Section::query()
            ->where('name', $schoolClass->section)
            ->where('year_level', $schoolClass->grade_level)
            ->where('school_year', $schoolClass->school_year)
            ->first(['course', 'semester']);

        return [
            'subject' => $schoolClass->subject,
            'section' => $schoolClass->section,
            'grade_level' => $schoolClass->grade_level,
            'is_college' => $schoolClass->is_college,
            'course' => $section?->course,
            'semester' => $section?->semester,
        ];
    }
}
