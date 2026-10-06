<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use App\Models\GradeSubmission;
use App\Models\SchoolClass;
use App\Services\GradeChangeRequestService;
use App\Services\GradeWorkflowService;
use Illuminate\Http\Request;

class GradeChangeRequestController extends Controller
{
    public function store(
        Request $request,
        SchoolClass $class,
        GradeSubmission $submission,
        GradeWorkflowService $workflow,
        GradeChangeRequestService $changeRequests
    ) {
        abort_unless((int) $class->teacher_id === (int) $request->user()->id, 403);
        abort_unless((int) $submission->school_class_id === (int) $class->id, 404);

        $limits = $workflow->scoreLimits($class);
        $scoreRules = ['nullable', 'numeric', 'min:' . $limits['min'], 'max:' . $limits['max']];
        if ($limits['is_college']) {
            $scoreRules[] = 'multiple_of:0.25';
        }

        $data = $request->validate([
            'reason' => ['required', 'string', 'max:2000'],
            'changes' => ['required', 'array'],
            'changes.*' => $scoreRules,
        ]);

        $changeRequests->submit($request->user(), $submission, $data, $workflow);

        return back()->with('status', 'Grade change request sent to the Department Chair.');
    }
}