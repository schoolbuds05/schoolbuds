<?php

namespace App\Http\Controllers\Registrar;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Web\Concerns\AuthorizesPortal;
use App\Models\AcademicTerm;
use App\Models\Student;
use App\Models\StudentReward;
use App\Services\PointsService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PointsController extends Controller
{
    use AuthorizesPortal;

    public function index(Request $request, PointsService $points)
    {
        $this->requireAnyRole($request, ['admin', 'registrar']);

        $students = Student::orderBy('last_name')->orderBy('first_name')->limit(200)->get();
        $terms = AcademicTerm::query()->orderByDesc('updated_at')->get();
        $latestTerm = $terms->first();
        $termsBySchoolYear = $terms->unique('school_year')->keyBy('school_year');
        $periodsByStudent = $students->mapWithKeys(function (Student $student) use ($termsBySchoolYear, $latestTerm) {
            $term = $termsBySchoolYear->get($student->school_year) ?? $latestTerm;
            $schoolYear = $student->school_year ?: $term?->school_year;

            return [$student->id => [
                'school_year' => $schoolYear,
                'semester' => $term?->semester,
            ]];
        });
        $rewardTotals = StudentReward::query()
            ->whereIn('student_id', $students->pluck('id'))
            ->where('points', '>', 0)
            ->whereNotIn('category', ['redemption'])
            ->selectRaw('student_id, school_year, semester, source, SUM(points) as total')
            ->groupBy('student_id', 'school_year', 'semester', 'source')
            ->get();
        $pointsPreview = $students->mapWithKeys(function (Student $student) use ($periodsByStudent, $rewardTotals) {
            $period = $periodsByStudent->get($student->id);
            $matchingTotals = $rewardTotals->filter(fn ($row) =>
                (int) $row->student_id === (int) $student->id
                && (!$period['school_year'] || $row->school_year === $period['school_year'])
                && (!$period['semester'] || $row->semester === $period['semester'])
            );

            return [$student->id => [
                'earned' => (int) $matchingTotals->sum('total'),
                'events' => (int) $matchingTotals->where('source', 'events')->sum('total'),
            ]];
        });
        $rewards = StudentReward::with(['student', 'awardedBy'])
            ->when($request->source, fn ($query) => $query->where('source', $request->source))
            ->latest()
            ->paginate(20)
            ->withQueryString();

        $defaultPoints = (int) $points->rule('event_default_points');
        $pointsCaps = [
            'semester' => (int) $points->rule('semester_cap'),
            'events' => (int) $points->rule('event_cap'),
        ];

        return view('registrar.points.index', compact('students', 'rewards', 'defaultPoints', 'pointsPreview', 'pointsCaps'));
    }

    public function store(Request $request, PointsService $points)
    {
        $this->requireAnyRole($request, ['admin', 'registrar']);

        $data = $request->validate([
            'student_id' => ['required', 'exists:students,id'],
            'source' => ['required', Rule::in(['donations', 'events', 'early_enrollment', 'early_payment', 'manual_adjustment'])],
            'points' => ['required', 'integer', 'min:1', 'max:100000'],
            'title' => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:500'],
            'reference_no' => ['nullable', 'string', 'max:120'],
        ]);

        $student = Student::findOrFail($data['student_id']);
        $term = AcademicTerm::query()
            ->where('school_year', $student->school_year)
            ->latest('updated_at')
            ->first() ?? AcademicTerm::query()->latest('updated_at')->first();
        $data['school_year'] = $student->school_year ?: $term?->school_year;
        $data['semester'] = $term?->semester;

        if ($data['source'] === 'early_enrollment') {
            $data['points'] = (int) $points->rule('early_enrollment_points');
        }

        if ($data['source'] === 'early_payment' && !in_array((int) $data['points'], [
            (int) $points->rule('early_payment_regular_points'),
            (int) $points->rule('early_payment_early_points'),
        ], true)) {
            return back()->withErrors(['points' => 'Early payment points must match one of the configured payment bonuses.'])->withInput();
        }

        if ($data['source'] === 'events' && $data['points'] > $points->rule('event_points_per_event_max')) {
            return back()->withErrors(['points' => 'Event points cannot exceed the configured per-event maximum.'])->withInput();
        }

        $requestedPoints = (int) $data['points'];
        $reward = $points->awardVerifiedPoints($student, [
            ...$data,
            'source_key' => implode(':', array_filter([
                $data['source'],
                $student->id,
                $data['reference_no'] ?? null,
                now()->timestamp,
            ])),
            'meta' => ['reference_no' => $data['reference_no'] ?? null],
        ], $request->user());

        $redirect = redirect()->route('registrar.points.index')->with('status', 'Verified points recorded.');
        if ($reward->points < $requestedPoints) {
            $redirect->with('points_cap_warning', "The award was capped: {$requestedPoints} requested, {$reward->points} awarded, " . ($requestedPoints - $reward->points) . ' not awarded because the student reached a points limit.');
        }

        return $redirect;
    }
}
