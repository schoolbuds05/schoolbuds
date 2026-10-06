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

    public function index(Request $request)
    {
        $this->requireAnyRole($request, ['admin', 'registrar']);

        $students = Student::orderBy('last_name')->orderBy('first_name')->limit(200)->get();
        $rewards = StudentReward::with(['student', 'awardedBy'])
            ->when($request->source, fn ($query) => $query->where('source', $request->source))
            ->latest()
            ->paginate(20)
            ->withQueryString();

        return view('registrar.points.index', compact('students', 'rewards'));
    }

    public function store(Request $request, PointsService $points)
    {
        $this->requireAnyRole($request, ['admin', 'registrar']);

        $data = $request->validate([
            'student_id' => ['required', 'exists:students,id'],
            'source' => ['required', Rule::in(['donations', 'events', 'early_enrollment', 'early_payment', 'manual_adjustment'])],
            'points' => ['required', 'integer', 'min:1', 'max:100'],
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
            $data['points'] = 30;
        }

        if ($data['source'] === 'early_payment' && !in_array((int) $data['points'], [25, 40], true)) {
            return back()->withErrors(['points' => 'Early payment points must be 25 or 40.'])->withInput();
        }

        if ($data['source'] === 'events' && $data['points'] > 25) {
            return back()->withErrors(['points' => 'Event participation points cannot exceed 25 per event.'])->withInput();
        }

        $points->awardVerifiedPoints($student, [
            ...$data,
            'source_key' => implode(':', array_filter([
                $data['source'],
                $student->id,
                $data['reference_no'] ?? null,
                now()->timestamp,
            ])),
            'meta' => ['reference_no' => $data['reference_no'] ?? null],
        ], $request->user());

        return redirect()->route('registrar.points.index')->with('status', 'Verified points recorded.');
    }
}
