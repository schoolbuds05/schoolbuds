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

        return redirect()->route('registrar.subjects.index', array_merge(
            ['tab' => 'requests'],
            $request->only(['status', 'action'])
        ));
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
