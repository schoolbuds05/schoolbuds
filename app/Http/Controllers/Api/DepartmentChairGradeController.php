<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Models\GradeChangeRequest;
use App\Models\GradeSubmission;
use App\Models\SchoolClass;
use App\Models\Section;
use App\Models\User;
use App\Services\GradeChangeRequestService;
use App\Services\GradeWorkflowService;
use Illuminate\Http\Request;

class DepartmentChairGradeController extends Controller
{
    public function index(Request $request)
    {
        $chair = $this->chair($request);
        $classIds = $this->departmentClassIds($chair);

        $submissions = GradeSubmission::query()
            ->whereIn('school_class_id', $classIds)
            ->whereIn('status', [GradeSubmission::STATUS_CHAIR_REVIEW, GradeSubmission::STATUS_REGISTRAR_RETURNED])
            ->with(['schoolClass', 'teacher:id,name', 'events.actor:id,name'])
            ->orderByDesc('submitted_at')
            ->limit(100)
            ->get()
            ->map(fn (GradeSubmission $submission) => $this->submissionPayload($submission))
            ->values();

        $changeRequests = GradeChangeRequest::query()
            ->whereHas('submission', fn ($query) => $query
                ->whereIn('school_class_id', $classIds)
                ->whereHas('schoolClass'))
            ->where('status', GradeChangeRequest::STATUS_CHAIR_REVIEW)
            ->with(['submission.schoolClass', 'teacher:id,name', 'events.actor:id,name'])
            ->orderByDesc('created_at')
            ->limit(100)
            ->get()
            ->map(fn (GradeChangeRequest $changeRequest) => $this->changeRequestPayload($changeRequest))
            ->values();

        return response()->json([
            'submissions' => $submissions,
            'change_requests' => $changeRequests,
        ]);
    }

    public function reviewSubmission(Request $request, GradeSubmission $submission, GradeWorkflowService $workflow)
    {
        $chair = $this->chair($request);
        $data = $request->validate([
            'decision' => ['required', 'in:approve,return'],
            'note' => ['nullable', 'required_if:decision,return', 'string', 'max:2000'],
        ]);

        $updated = $workflow->chairDecision($chair, $submission, $data['decision'], $data['note'] ?? null);

        return response()->json([
            'message' => $data['decision'] === 'approve'
                ? 'Grade sheet approved and sent to the Registrar.'
                : 'Grade sheet returned to the teacher for correction.',
            'submission_id' => $updated->id,
            'status' => $updated->status,
        ]);
    }

    public function reviewChangeRequest(
        Request $request,
        GradeChangeRequest $changeRequest,
        GradeChangeRequestService $workflow
    ) {
        $chair = $this->chair($request);
        $data = $request->validate([
            'decision' => ['required', 'in:approve,reject'],
            'note' => ['nullable', 'required_if:decision,reject', 'string', 'max:2000'],
        ]);

        $updated = $workflow->chairDecision($chair, $changeRequest, $data['decision'], $data['note'] ?? null);

        return response()->json([
            'message' => $data['decision'] === 'approve'
                ? 'Grade change request approved and sent to the Registrar.'
                : 'Grade change request rejected.',
            'request_id' => $updated->id,
            'status' => $updated->status,
        ]);
    }

    private function chair(Request $request): User
    {
        $chair = $request->user();
        abort_unless($chair?->position === User::POSITION_HEAD_DEPARTMENT, 403);
        abort_unless($chair->department_id, 422, 'Assign this Department Chair to a department first.');

        return $chair;
    }

    private function departmentClassIds(User $chair)
    {
        $department = Department::query()->with('courses')->findOrFail($chair->department_id);
        $sections = Section::query()
            ->where('program_type', 'college')
            ->whereIn('course', $department->courses->pluck('name'))
            ->get();

        if ($sections->isEmpty()) {
            return collect();
        }

        return SchoolClass::query()
            ->where(function ($query) use ($sections) {
                foreach ($sections as $section) {
                    $subjectNames = $section->sectionSubjects()
                        ->with('subject:id,name')
                        ->get()
                        ->pluck('subject.name')
                        ->filter()
                        ->unique()
                        ->values();

                    if ($subjectNames->isEmpty()) {
                        continue;
                    }

                    $query->orWhere(function ($classQuery) use ($section, $subjectNames) {
                        $classQuery->where('section', $section->name)
                            ->where('grade_level', $section->year_level)
                            ->where('school_year', $section->school_year)
                            ->whereIn('subject', $subjectNames);
                    });
                }
            })
            ->pluck('id');
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

    private function changeRequestPayload(GradeChangeRequest $changeRequest): array
    {
        $submission = $changeRequest->submission;

        return [
            'id' => $changeRequest->id,
            'reason' => $changeRequest->reason,
            'changes' => $changeRequest->changes ?? [],
            'status' => $changeRequest->status,
            'teacher' => ['name' => $changeRequest->teacher?->name ?? 'Account unavailable'],
            'chair_note' => $changeRequest->chair_note,
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
    }

    private function classPayload(?SchoolClass $schoolClass): ?array
    {
        if (!$schoolClass) {
            return null;
        }

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
