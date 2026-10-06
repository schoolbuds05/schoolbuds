<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\EventParticipation;
use App\Models\SchoolNotification;
use App\Models\Student;
use App\Models\StudentReward;
use App\Services\PointsService;
use Illuminate\Http\Request;

class RewardController extends Controller
{
    public function mine(Request $request, PointsService $points)
    {
        $student = Student::where('user_id', $request->user()->id)->first();

        if (!$student) {
            return response()->json([
                'summary' => $this->emptyRewardSummary(),
                'rewards' => [],
                'rules' => $this->rewardRules(),
            ]);
        }

        return response()->json($this->rewardPayload($student, $points));
    }

    public function award(Request $request, Student $student, PointsService $points)
    {
        $this->authorizePointsManager($request, $student);

        $data = $request->validate([
            'source' => ['required', 'in:donations,events,early_enrollment,early_payment,manual_adjustment'],
            'source_key' => ['nullable', 'string', 'max:160'],
            'points' => ['required', 'integer', 'min:1', 'max:100'],
            'title' => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:500'],
            'school_year' => ['nullable', 'string', 'max:20'],
            'semester' => ['nullable', 'string', 'max:20'],
            'reference_no' => ['nullable', 'string', 'max:120'],
        ]);

        if ($data['source'] === 'early_enrollment') {
            $data['points'] = 30;
        }

        if ($data['source'] === 'early_payment' && !in_array((int) $data['points'], [25, 40], true)) {
            return response()->json(['message' => 'Early payment points must be 25 or 40.'], 422);
        }

        if ($data['source'] === 'events' && $data['points'] > 25) {
            return response()->json(['message' => 'Event participation points cannot exceed 25 per event.'], 422);
        }

        $sourceKey = $data['source_key'] ?? implode(':', array_filter([
            $data['source'],
            $student->id,
            $data['reference_no'] ?? null,
            now()->timestamp,
        ]));

        $reward = $points->awardVerifiedPoints($student, [
            ...$data,
            'source_key' => $sourceKey,
            'meta' => ['reference_no' => $data['reference_no'] ?? null],
        ], $request->user());

        return response()->json([
            'message' => 'Verified points recorded.',
            'reward' => $reward->load('awardedBy:id,name'),
            'summary' => $points->summaryFor($student, $data['school_year'] ?? null, $data['semester'] ?? null),
        ], 201);
    }

    public function eventIndex(Request $request)
    {
        $this->authorizePointsManagerRole($request);

        return response()->json(
            EventParticipation::with(['student', 'verifier:id,name', 'approver:id,name'])
                ->latest()
                ->get()
        );
    }

    public function verifyEvent(Request $request)
    {
        $user = $request->user();
        if (!$user || (!$user->hasAnyRole(['faculty', 'teacher', 'head_teacher', 'dean']) && !in_array($user->role, ['faculty', 'teacher', 'head_teacher', 'dean'], true))) {
            return response()->json(['message' => 'Faculty access is required.'], 403);
        }

        $data = $request->validate([
            'student_id' => ['required', 'exists:students,id'],
            'event_name' => ['required', 'string', 'max:160'],
            'event_date' => ['nullable', 'date'],
            'points' => ['nullable', 'integer', 'min:1', 'max:25'],
            'school_year' => ['nullable', 'string', 'max:20'],
            'semester' => ['nullable', 'string', 'max:20'],
            'remarks' => ['nullable', 'string', 'max:500'],
        ]);

        $participation = EventParticipation::create([
            ...$data,
            'points' => $data['points'] ?? 10,
            'verified_by' => $user->id,
            'status' => 'pending',
        ]);

        return response()->json([
            'message' => 'Event participation sent to registrar for approval.',
            'participation' => $participation->load(['student', 'verifier:id,name']),
        ], 201);
    }

    public function approveEvent(Request $request, EventParticipation $participation, PointsService $points)
    {
        $this->authorizePointsManagerRole($request);

        if ($participation->status !== 'pending') {
            return response()->json(['message' => 'This participation record was already reviewed.'], 422);
        }

        $participation->update([
            'status' => 'approved',
            'approved_by' => $request->user()->id,
            'approved_at' => now(),
        ]);

        $reward = $points->awardVerifiedPoints($participation->student, [
            'source' => 'events',
            'source_key' => "event-participation:{$participation->id}",
            'title' => 'Event participation points',
            'description' => $participation->event_name,
            'points' => $participation->points,
            'school_year' => $participation->school_year,
            'semester' => $participation->semester,
            'meta' => ['event_participation_id' => $participation->id],
        ], $request->user());

        if ($participation->student?->user_id) {
            SchoolNotification::create([
                'user_id' => $participation->student->user_id,
                'type' => 'points_earned',
                'title' => 'Event points approved',
                'body' => "You earned {$reward->points} points for {$participation->event_name}.",
                'channels' => ['in_app'],
                'data' => ['event_participation_id' => $participation->id, 'reward_id' => $reward->id],
            ]);
        }

        return response()->json([
            'message' => 'Event participation approved and points awarded.',
            'participation' => $participation->fresh()->load(['student', 'verifier:id,name', 'approver:id,name']),
            'reward' => $reward,
        ]);
    }

    public function rejectEvent(Request $request, EventParticipation $participation)
    {
        $this->authorizePointsManagerRole($request);

        $data = $request->validate([
            'remarks' => ['nullable', 'string', 'max:500'],
        ]);

        if ($participation->status !== 'pending') {
            return response()->json(['message' => 'This participation record was already reviewed.'], 422);
        }

        $participation->update([
            'status' => 'rejected',
            'approved_by' => $request->user()->id,
            'approved_at' => now(),
            'remarks' => $data['remarks'] ?? $participation->remarks,
        ]);

        return response()->json([
            'message' => 'Event participation rejected.',
            'participation' => $participation->fresh()->load(['student', 'verifier:id,name', 'approver:id,name']),
        ]);
    }

    private function rewardPayload(Student $student, PointsService $points): array
    {
        return [
            'summary' => $points->summaryFor($student),
            'rewards' => StudentReward::where('student_id', $student->id)
                ->with('awardedBy:id,name')
                ->latest()
                ->limit(100)
                ->get(),
            'rules' => $this->rewardRules(),
        ];
    }

    private function rewardRules(): array
    {
        return [
            'redemption_rate' => '1 point = PHP 0.50',
            'semester_cap' => PointsService::SEMESTER_CAP,
            'redemption_cap' => PointsService::REDEMPTION_CAP,
            'grade_cap' => PointsService::GRADE_CAP,
            'attendance_cap' => PointsService::ATTENDANCE_CAP,
            'event_cap' => PointsService::EVENT_CAP,
            'allowed_sources' => [
                'grades',
                'attendance',
                'donations',
                'events',
                'early_enrollment',
                'early_payment',
            ],
        ];
    }

    private function emptyRewardSummary(): array
    {
        return [
            'points' => 0,
            'earned_points' => 0,
            'redeemable_points' => 0,
            'redemption_cap' => PointsService::REDEMPTION_CAP,
            'peso_value' => 0,
            'level' => 1,
            'current_level_points' => 0,
            'next_level_at' => 100,
            'points_to_next_level' => 100,
            'semester_cap' => PointsService::SEMESTER_CAP,
            'semester_cap_remaining' => PointsService::SEMESTER_CAP,
            'redemption_cap_remaining' => PointsService::REDEMPTION_CAP,
            'rewards_count' => 0,
            'by_source' => [],
        ];
    }

    private function authorizePointsManager(Request $request, Student $student): void
    {
        $this->authorizePointsManagerRole($request);

        if (!$student->user_id) {
            abort(response()->json(['message' => 'Student user account not found.'], 422));
        }
    }

    private function authorizePointsManagerRole(Request $request): void
    {
        $user = $request->user();

        if (!$user || (
            !in_array($user->role, ['admin', 'registrar'], true)
            && !$user->hasAnyRole(['admin', 'registrar'])
        )) {
            abort(response()->json(['message' => 'Admin or registrar access is required.'], 403));
        }
    }
}
