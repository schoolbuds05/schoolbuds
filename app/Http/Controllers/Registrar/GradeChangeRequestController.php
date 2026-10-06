<?php

namespace App\Http\Controllers\Registrar;

use App\Http\Controllers\Controller;
use App\Models\GradeChangeRequest;
use App\Services\GradeChangeRequestService;
use App\Services\GradeWorkflowService;
use App\Services\PointsService;
use Illuminate\Http\Request;

class GradeChangeRequestController extends Controller
{
    public function review(
        Request $request,
        GradeChangeRequest $changeRequest,
        GradeChangeRequestService $workflow,
        GradeWorkflowService $gradeWorkflow,
        PointsService $points
    ) {
        $data = $request->validate([
            'decision' => ['required', 'in:approve,reject'],
            'note' => ['nullable', 'required_if:decision,reject', 'string', 'max:2000'],
        ]);

        $workflow->registrarDecision(
            $request->user(),
            $changeRequest,
            $data['decision'],
            $data['note'] ?? null,
            $gradeWorkflow,
            $points
        );

        return redirect()->route('registrar.grades.index')->with('status', $data['decision'] === 'approve'
            ? 'Grade corrections approved and published.'
            : 'Grade change request rejected.');
    }
}