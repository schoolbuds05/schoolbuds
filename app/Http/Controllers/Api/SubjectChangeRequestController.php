<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Section;
use App\Models\SectionSubject;
use App\Models\Student;
use App\Models\StudentSubject;
use App\Models\Subject;
use App\Models\SubjectChangeRequest;
use Illuminate\Http\Request;

class SubjectChangeRequestController extends Controller
{
    public function mine(Request $request)
    {
        return response()->json(
            SubjectChangeRequest::query()
                ->where('user_id', $request->user()->id)
                ->with(['subject:id,code,name,units_lec,units_lab', 'section:id,name'])
                ->latest()
                ->get()
        );
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'action' => ['required', 'in:add,drop'],
            'subject_id' => ['required', 'integer', 'exists:subjects,id'],
            'section_id' => ['nullable', 'integer', 'exists:sections,id'],
            'reason' => ['required', 'string', 'min:5', 'max:1000'],
        ]);

        $userId = $request->user()->id;

        if ($data['action'] === 'add') {
            if (empty($data['section_id'])) {
                return response()->json(['message' => 'Select the section offering for the subject you want to add.'], 422);
            }

            $offeringExists = SectionSubject::query()
                ->where('section_id', $data['section_id'])
                ->where('subject_id', $data['subject_id'])
                ->exists();

            if (!$offeringExists) {
                return response()->json(['message' => 'That subject is not offered in the selected section.'], 422);
            }

            $alreadyEnrolled = StudentSubject::query()
                ->where('user_id', $userId)
                ->where('subject_id', $data['subject_id'])
                ->where('status', 'enrolled')
                ->exists();

            if ($alreadyEnrolled) {
                return response()->json(['message' => 'You are already enrolled in this subject.'], 422);
            }
        }

        if ($data['action'] === 'drop') {
            $enrolled = StudentSubject::query()
                ->where('user_id', $userId)
                ->where('subject_id', $data['subject_id'])
                ->where('section_id', $data['section_id'] ?? null)
                ->where('status', 'enrolled')
                ->exists();

            if (!$enrolled && !empty($data['section_id'])) {
                $enrolled = Section::query()
                    ->where('id', $data['section_id'])
                    ->whereHas('students', fn ($query) => $query->where('users.id', $userId)->where('section_students.status', 'enrolled'))
                    ->whereHas('sectionSubjects', fn ($query) => $query->where('subject_id', $data['subject_id']))
                    ->exists();
            }

            if (!$enrolled) {
                return response()->json(['message' => 'Only enrolled subjects can be requested for dropping.'], 422);
            }
        }

        $pendingExists = SubjectChangeRequest::query()
            ->where('user_id', $userId)
            ->where('action', $data['action'])
            ->where('subject_id', $data['subject_id'])
            ->where('section_id', $data['section_id'] ?? null)
            ->where('status', 'pending')
            ->exists();

        if ($pendingExists) {
            return response()->json(['message' => 'You already have a pending request for this subject.'], 422);
        }

        $changeRequest = SubjectChangeRequest::create([
            ...$data,
            'user_id' => $userId,
            'status' => 'pending',
        ]);

        return response()->json($changeRequest->load(['subject:id,code,name', 'section:id,name']), 201);
    }

    public function index(Request $request)
    {
        $this->authorizeRegistrar($request);

        return response()->json(
            SubjectChangeRequest::query()
                ->with(['student:id,name,email', 'subject:id,code,name,units_lec,units_lab', 'section:id,name', 'reviewer:id,name'])
                ->when($request->status, fn ($query) => $query->where('status', $request->status))
                ->latest()
                ->get()
        );
    }

    public function approve(Request $request, SubjectChangeRequest $subjectChangeRequest)
    {
        $this->authorizeRegistrar($request);
        $data = $request->validate(['registrar_remarks' => ['nullable', 'string', 'max:1000']]);

        if ($subjectChangeRequest->status !== 'pending') {
            return response()->json(['message' => 'This request has already been reviewed.'], 422);
        }

        if ($subjectChangeRequest->action === 'add') {
            $alreadyEnrolled = StudentSubject::query()
                ->where('user_id', $subjectChangeRequest->user_id)
                ->where('subject_id', $subjectChangeRequest->subject_id)
                ->where('status', 'enrolled')
                ->exists();

            if ($alreadyEnrolled) {
                return response()->json(['message' => 'Student is already enrolled in this subject.'], 422);
            }

            StudentSubject::updateOrCreate(
                [
                    'user_id' => $subjectChangeRequest->user_id,
                    'subject_id' => $subjectChangeRequest->subject_id,
                    'section_id' => $subjectChangeRequest->section_id,
                ],
                [
                    'status' => 'enrolled',
                    'drop_reason' => null,
                    'dropped_at' => null,
                    'dropped_by' => null,
                ]
            );
        } else {
            StudentSubject::updateOrCreate(
                [
                    'user_id' => $subjectChangeRequest->user_id,
                    'subject_id' => $subjectChangeRequest->subject_id,
                    'section_id' => $subjectChangeRequest->section_id,
                ],
                [
                    'status' => 'dropped',
                    'drop_reason' => $subjectChangeRequest->reason,
                    'dropped_at' => now(),
                    'dropped_by' => $request->user()->id,
                ]
            );
        }

        $subjectChangeRequest->update([
            'status' => 'approved',
            'registrar_remarks' => $data['registrar_remarks'] ?? null,
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
        ]);

        return response()->json(['message' => 'Subject request approved.']);
    }

    public function reject(Request $request, SubjectChangeRequest $subjectChangeRequest)
    {
        $this->authorizeRegistrar($request);
        $data = $request->validate(['registrar_remarks' => ['required', 'string', 'max:1000']]);

        if ($subjectChangeRequest->status !== 'pending') {
            return response()->json(['message' => 'This request has already been reviewed.'], 422);
        }

        $subjectChangeRequest->update([
            'status' => 'rejected',
            'registrar_remarks' => $data['registrar_remarks'],
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
        ]);

        return response()->json(['message' => 'Subject request rejected.']);
    }

    private function authorizeRegistrar(Request $request): void
    {
        $user = $request->user();
        if (!$user || (!in_array($user->role, ['registrar', 'admin'], true) && !$user->hasAnyRole(['registrar', 'admin']))) {
            abort(response()->json(['message' => 'Registrar access is required.'], 403));
        }
    }
}
