<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AcademicTerm;
use App\Models\Section;
use App\Models\SchoolNotification;
use App\Models\Student;
use Illuminate\Http\Request;

class AcademicTermController extends Controller
{
    public function current()
    {
        $term = AcademicTerm::query()
            ->latest('updated_at')
            ->first();

        return response()->json([
            'term' => $term,
            'enrollment_open' => $term?->isEnrollmentOpen() ?? false,
            'message' => $this->enrollmentStatusMessage($term),
        ]);
    }

    public function index(Request $request)
    {
        $this->authorizeAdmin($request);

        return response()->json(
            AcademicTerm::query()
                ->orderByDesc('school_year')
                ->orderBy('semester')
                ->get()
        );
    }

    public function upsert(Request $request)
    {
        $this->authorizeAdmin($request);

        $data = $request->validate([
            'school_year' => ['required', 'string', 'max:20'],
            'semester' => ['required', 'in:1st,2nd,summer'],
            'exam_date' => ['nullable', 'date'],
            'grade_finalization_deadline' => ['nullable', 'date'],
            'enrollment_opens_at' => ['nullable', 'date'],
            'enrollment_closes_at' => ['nullable', 'date', 'after_or_equal:enrollment_opens_at'],
            'is_active' => ['nullable', 'boolean'],
        ]);
        $isActive = (bool) ($data['is_active'] ?? false);

        $previouslyOpenTermIds = AcademicTerm::query()
            ->get()
            ->filter(fn (AcademicTerm $term) => $term->isEnrollmentOpen())
            ->pluck('id')
            ->all();

        if ($isActive) {
            AcademicTerm::query()
                ->where(function ($query) use ($data) {
                    $query->where('school_year', '!=', $data['school_year'])
                        ->orWhere('semester', '!=', $data['semester']);
                })
                ->get()
                ->each(fn (AcademicTerm $term) => $term->update(['is_active' => false]));

            Section::query()
                ->where('is_active', true)
                ->where(function ($query) use ($data) {
                    $query->where('school_year', '!=', $data['school_year'])
                        ->orWhere('semester', '!=', $data['semester']);
                })
                ->get()
                ->each(fn (Section $section) => $section->update(['is_active' => false]));
        }

        $term = AcademicTerm::updateOrCreate(
            [
                'school_year' => $data['school_year'],
                'semester' => $data['semester'],
            ],
            [
                ...$data,
                'is_active' => $isActive,
                'updated_by' => $request->user()->id,
            ]
        );

        if ($term->fresh()->isEnrollmentOpen() && !in_array($term->id, $previouslyOpenTermIds, true)) {
            $this->notifyStudentsEnrollmentOpened($term);
        }

        return response()->json($term);
    }

    private function authorizeAdmin(Request $request): void
    {
        $user = $request->user();
        if (!$user || !$user->hasAnyRole(['admin'])) {
            abort(response()->json(['message' => 'Admin access is required.'], 403));
        }
    }

    private function enrollmentStatusMessage(?AcademicTerm $term): string
    {
        if (!$term) {
            return 'Enrollment is closed until an administrator opens an academic term.';
        }

        if (!$term->is_active) {
            return 'Enrollment is closed for this academic term.';
        }

        if ($term->grade_finalization_deadline && now()->lt($term->grade_finalization_deadline)) {
            return 'Enrollment opens after grades are finalized on ' . $term->grade_finalization_deadline->toDateTimeString() . '.';
        }

        if ($term->enrollment_opens_at && now()->lt($term->enrollment_opens_at)) {
            return 'Enrollment opens on ' . $term->enrollment_opens_at->toDateTimeString() . '.';
        }

        if ($term->enrollment_closes_at && now()->gt($term->enrollment_closes_at)) {
            return 'Enrollment closed on ' . $term->enrollment_closes_at->toDateTimeString() . '.';
        }

        return 'Enrollment is open.';
    }

    private function notifyStudentsEnrollmentOpened(AcademicTerm $term): void
    {
        Student::query()
            ->where('status', 'active')
            ->whereNotNull('user_id')
            ->distinct()
            ->pluck('user_id')
            ->each(function (int $userId) use ($term) {
                $alreadyNotified = SchoolNotification::query()
                    ->where('user_id', $userId)
                    ->where('type', 'enrollment_opened')
                    ->where('data->academic_term_id', $term->id)
                    ->exists();

                if ($alreadyNotified) {
                    return;
                }

                SchoolNotification::create([
                    'user_id' => $userId,
                    'type' => 'enrollment_opened',
                    'title' => 'Enrollment is open',
                    'body' => "Enrollment is now open for {$term->semester} Semester, A.Y. {$term->school_year}.",
                    'channels' => ['in_app'],
                    'data' => [
                        'academic_term_id' => $term->id,
                        'school_year' => $term->school_year,
                        'semester' => $term->semester,
                    ],
                ]);
            });
    }
}
