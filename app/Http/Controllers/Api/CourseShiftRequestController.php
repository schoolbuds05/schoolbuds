<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\CourseShiftRequest;
use App\Models\EnrollmentApplication;
use App\Models\Student;
use Illuminate\Http\Request;

class CourseShiftRequestController extends Controller
{
    public function mine(Request $request)
    {
        return response()->json(
            CourseShiftRequest::query()
                ->where('user_id', $request->user()->id)
                ->with(['currentCourse:id,name', 'requestedCourse:id,name', 'reviewer:id,name'])
                ->latest()
                ->get()
        );
    }

    public function store(Request $request)
    {
        $user = $request->user();
        $data = $request->validate([
            'requested_course_id' => ['required', 'integer', 'exists:courses,id'],
            'reason' => ['required', 'string', 'max:2000'],
            'school_year' => ['required', 'string', 'max:20'],
            'semester' => ['required', 'in:1st,2nd,summer'],
        ]);

        $student = Student::query()->where('user_id', $user->id)->firstOrFail();
        $application = EnrollmentApplication::query()
            ->where('user_id', $user->id)
            ->where('status', 'approved')
            ->latest()
            ->first();
        $requestedCourse = Course::query()
            ->whereKey($data['requested_course_id'])
            ->where('is_active', true)
            ->firstOrFail();

        if ($requestedCourse->program_type !== 'college') {
            return response()->json(['message' => 'Course shifting is available for college courses only.'], 422);
        }

        $currentCourseId = $application?->course_id;
        if ($currentCourseId && (int) $currentCourseId === (int) $requestedCourse->id) {
            return response()->json(['message' => 'The requested course is already your current course.'], 422);
        }

        $hasPending = CourseShiftRequest::query()
            ->where('user_id', $user->id)
            ->where('status', CourseShiftRequest::STATUS_PENDING)
            ->exists();
        if ($hasPending) {
            return response()->json(['message' => 'You already have a pending course-shift request.'], 422);
        }

        $shiftRequest = CourseShiftRequest::create([
            'user_id' => $user->id,
            'current_course_id' => $currentCourseId,
            'requested_course_id' => $requestedCourse->id,
            'reason' => $data['reason'],
            'school_year' => $data['school_year'],
            'semester' => $data['semester'],
            'status' => CourseShiftRequest::STATUS_PENDING,
        ]);

        return response()->json($shiftRequest->load(['currentCourse:id,name', 'requestedCourse:id,name']), 201);
    }

    public function index(Request $request)
    {
        return response()->json(
            CourseShiftRequest::query()
                ->with(['student:id,name,email', 'currentCourse:id,name', 'requestedCourse:id,name', 'reviewer:id,name'])
                ->when($request->filled('status'), fn ($query) => $query->where('status', $request->status))
                ->latest()
                ->paginate(25)
        );
    }

    public function review(Request $request, CourseShiftRequest $courseShiftRequest)
    {
        $data = $request->validate([
            'decision' => ['required', 'in:approve,reject'],
            'remarks' => ['nullable', 'required_if:decision,reject', 'string', 'max:2000'],
        ]);

        if ($courseShiftRequest->status !== CourseShiftRequest::STATUS_PENDING) {
            return response()->json(['message' => 'This course-shift request has already been reviewed.'], 422);
        }

        $courseShiftRequest->update([
            'status' => $data['decision'] === 'approve'
                ? CourseShiftRequest::STATUS_APPROVED
                : CourseShiftRequest::STATUS_REJECTED,
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
            'remarks' => $data['remarks'] ?? null,
        ]);

        return response()->json($courseShiftRequest->fresh()->load(['currentCourse:id,name', 'requestedCourse:id,name', 'reviewer:id,name']));
    }
}