<?php

namespace App\Http\Controllers\Registrar;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Web\Concerns\AuthorizesPortal;
use App\Models\StudentSubject;
use App\Models\SubjectChangeRequest;
use Illuminate\Http\Request;

class SubjectChangeRequestController extends Controller
{
    use AuthorizesPortal;

    public function index(Request $request)
    {
        $this->requireAnyRole($request, ['admin', 'registrar']);

        $requests = SubjectChangeRequest::query()
            ->with([
                'student:id,name,email',
                'subject:id,code,name,units_lec,units_lab',
                'section:id,name,course,year_level,semester',
                'reviewer:id,name',
            ])
            ->when($request->status, fn ($query) => $query->where('status', $request->status))
            ->when($request->action, fn ($query) => $query->where('action', $request->action))
            ->latest()
            ->paginate(15)
            ->withQueryString();

        $stats = [
            'pending' => SubjectChangeRequest::where('status', 'pending')->count(),
            'approved' => SubjectChangeRequest::where('status', 'approved')->count(),
            'rejected' => SubjectChangeRequest::where('status', 'rejected')->count(),
        ];

        return view('registrar.subject-requests.index', compact('requests', 'stats'));
    }

    public function approve(Request $request, SubjectChangeRequest $subjectRequest)
    {
        $this->requireAnyRole($request, ['admin', 'registrar']);

        $data = $request->validate([
            'registrar_remarks' => ['nullable', 'string', 'max:1000'],
        ]);

        if ($subjectRequest->status !== 'pending') {
            return back()->withErrors(['request' => 'This request has already been reviewed.']);
        }

        if ($subjectRequest->action === 'add') {
            StudentSubject::updateOrCreate(
                [
                    'user_id' => $subjectRequest->user_id,
                    'subject_id' => $subjectRequest->subject_id,
                    'section_id' => $subjectRequest->section_id,
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
                    'user_id' => $subjectRequest->user_id,
                    'subject_id' => $subjectRequest->subject_id,
                    'section_id' => $subjectRequest->section_id,
                ],
                [
                    'status' => 'dropped',
                    'drop_reason' => $subjectRequest->reason,
                    'dropped_at' => now(),
                    'dropped_by' => $request->user()->id,
                ]
            );
        }

        $subjectRequest->update([
            'status' => 'approved',
            'registrar_remarks' => $data['registrar_remarks'] ?? null,
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
        ]);

        return back()->with('status', 'Subject request approved.');
    }

    public function reject(Request $request, SubjectChangeRequest $subjectRequest)
    {
        $this->requireAnyRole($request, ['admin', 'registrar']);

        $data = $request->validate([
            'registrar_remarks' => ['required', 'string', 'max:1000'],
        ]);

        if ($subjectRequest->status !== 'pending') {
            return back()->withErrors(['request' => 'This request has already been reviewed.']);
        }

        $subjectRequest->update([
            'status' => 'rejected',
            'registrar_remarks' => $data['registrar_remarks'],
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
        ]);

        return back()->with('status', 'Subject request rejected.');
    }
}
