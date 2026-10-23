<?php

namespace App\Http\Controllers\Registrar;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Web\Concerns\AuthorizesPortal;
use App\Models\AcademicTerm;
use App\Models\Fee;
use App\Models\Student;
use App\Models\Section;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class TuitionFeeController extends Controller
{
    use AuthorizesPortal;

    public function index(Request $request)
    {
        $this->requireAnyRole($request, ['registrar']);

        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'grade_level' => ['nullable', 'string', 'max:30'],
            'section' => ['nullable', 'string', 'max:255'],
        ]);

        $activeStudents = Student::query()->where('status', 'active');
        $gradeLevels = (clone $activeStudents)
            ->whereNotNull('grade_level')
            ->where('grade_level', '!=', '')
            ->distinct()
            ->orderByRaw('CAST(grade_level AS UNSIGNED), grade_level')
            ->pluck('grade_level');
        $sections = (clone $activeStudents)
            ->when($request->filled('grade_level'), fn ($query) => $query->where('grade_level', $request->grade_level))
            ->whereNotNull('section')
            ->where('section', '!=', '')
            ->distinct()
            ->orderBy('section')
            ->pluck('section');

        $students = (clone $activeStudents)
            ->with('user:id,name')
            ->when($request->filled('grade_level'), fn ($query) => $query->where('grade_level', $request->grade_level))
            ->when($request->filled('section'), fn ($query) => $query->where('section', $request->section))
            ->when($request->filled('search'), function ($query) use ($request) {
                $search = trim($request->search);
                $query->where(function ($searchQuery) use ($search) {
                    $searchQuery->where('first_name', 'like', "%{$search}%")
                        ->orWhere('last_name', 'like', "%{$search}%")
                        ->orWhere('student_id', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%");
                });
            })
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->get();

        $activeTerm = AcademicTerm::query()->where('is_active', true)->latest('updated_at')->first();
        $schoolYear = $activeTerm?->school_year
            ?? Student::query()->whereNotNull('school_year')->orderByDesc('school_year')->value('school_year')
            ?? now()->year . '-' . (now()->year + 1);

        return view('registrar.tuition.index', compact(
            'students',
            'gradeLevels',
            'sections',
            'schoolYear'
        ));
    }

    public function store(Request $request)
    {
        $this->requireAnyRole($request, ['registrar']);

        $data = $request->validate([
            'student_ids' => ['required', 'array', 'min:1', 'max:500'],
            'student_ids.*' => ['required', 'integer', 'distinct', 'exists:students,id'],
            'type' => ['required', 'string', 'max:255'],
            'amount' => ['required', 'numeric', 'min:1', 'max:10000000'],
            'due_date' => ['required', 'date'],
            'school_year' => ['required', 'string', 'max:255'],
            'semester' => ['nullable', Rule::in(['1st', '2nd', 'summer'])],
            'quarter' => ['nullable', Rule::in(['1', '2', '3', '4'])],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $studentIds = array_map('intval', $data['student_ids']);
        $result = DB::transaction(function () use ($data, $studentIds) {
            $students = Student::query()
                ->whereIn('id', $studentIds)
                ->where('status', 'active')
                ->orderBy('id')
                ->lockForUpdate()
                ->get();

            if ($students->count() !== count($studentIds)) {
                throw ValidationException::withMessages([
                    'student_ids' => 'One or more selected students are no longer active. Refresh the list and try again.',
                ]);
            }

            $existingFees = Fee::query()
                ->whereIn('student_id', $studentIds)
                ->where('type', $data['type'])
                ->where('school_year', $data['school_year'])
                ->when(
                    filled($data['semester'] ?? null),
                    fn ($query) => $query->where('semester', $data['semester']),
                    fn ($query) => $query->whereNull('semester')
                )
                ->when(
                    filled($data['quarter'] ?? null),
                    fn ($query) => $query->where('quarter', $data['quarter']),
                    fn ($query) => $query->whereNull('quarter')
                )
                ->pluck('student_id')
                ->map(fn ($id) => (int) $id)
                ->all();

            $existingStudentIds = array_fill_keys($existingFees, true);
            $feeAttributes = [
                'type' => $data['type'],
                'amount' => $data['amount'],
                'paid_amount' => 0,
                'status' => 'unpaid',
                'due_date' => $data['due_date'],
                'school_year' => $data['school_year'],
                'semester' => $data['semester'] ?? null,
                'quarter' => $data['quarter'] ?? null,
                'notes' => $data['notes'] ?? null,
            ];
            $created = 0;
            $skipped = 0;

            foreach ($students as $student) {
                if (isset($existingStudentIds[$student->id])) {
                    $skipped++;
                    continue;
                }

                $student->fees()->create($feeAttributes);
                $created++;
            }

            return compact('created', 'skipped');
        });

        $message = $result['created'] > 0
            ? "Posted tuition for {$result['created']} student(s)." . ($result['skipped'] ? " Skipped {$result['skipped']} duplicate fee(s)." : '')
            : "No fees were posted. All {$result['skipped']} selected student(s) already have this fee for the selected period.";

        return redirect()
            ->route('registrar.tuition.index', $request->only(['search', 'grade_level', 'section']))
            ->with('status', $message);
    }

    public function mobileSections(Request $request)
    {
        $this->requireAnyRole($request, ['registrar']);

        $sections = Section::query()
            ->with(['students.student'])
            ->where('is_active', true)
            ->orderBy('name')
            ->get()
            ->map(function (Section $section) {
                $activeStudents = $section->students
                    ->filter(fn ($user) => $user->pivot?->status === 'enrolled'
                        && $user->student?->status === 'active');

                return [
                    'id' => $section->id,
                    'name' => $section->name,
                    'course' => $section->course,
                    'year_level' => $section->year_level,
                    'program_type' => $section->program_type,
                    'school_year' => $section->school_year,
                    'semester' => $section->semester,
                    'student_count' => $activeStudents->count(),
                ];
            })
            ->filter(fn ($section) => $section['student_count'] > 0)
            ->values();

        return response()->json($sections);
    }

    public function storeMobile(Request $request)
    {
        $this->requireAnyRole($request, ['registrar']);

        $data = $request->validate([
            'section_id' => ['required', 'integer', 'exists:sections,id'],
            'amount' => ['required', 'numeric', 'min:1', 'max:10000000'],
            'due_date' => ['required', 'date'],
        ]);

        $section = Section::query()->where('is_active', true)->findOrFail($data['section_id']);
        $result = DB::transaction(function () use ($section, $data) {
            $userIds = $section->students()
                ->wherePivot('status', 'enrolled')
                ->pluck('users.id')
                ->all();
            $studentIds = Student::query()
                ->whereIn('user_id', $userIds)
                ->where('status', 'active')
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
                ->all();

            if (!$studentIds) {
                throw ValidationException::withMessages([
                    'section_id' => 'This section has no active enrolled students.',
                ]);
            }

            $type = 'Tuition';
            $existingStudentIds = Fee::query()
                ->whereIn('student_id', $studentIds)
                ->where('type', $type)
                ->where('school_year', $section->school_year)
                ->when($section->semester, fn ($query) => $query->where('semester', $section->semester), fn ($query) => $query->whereNull('semester'))
                ->pluck('student_id')
                ->map(fn ($id) => (int) $id)
                ->all();
            $existing = array_fill_keys($existingStudentIds, true);
            $created = 0;
            $skipped = 0;

            foreach ($studentIds as $studentId) {
                if (isset($existing[$studentId])) {
                    $skipped++;
                    continue;
                }

                Fee::create([
                    'student_id' => $studentId,
                    'type' => $type,
                    'amount' => $data['amount'],
                    'paid_amount' => 0,
                    'status' => 'unpaid',
                    'due_date' => $data['due_date'],
                    'school_year' => $section->school_year,
                    'semester' => $section->semester,
                ]);
                $created++;
            }

            return compact('created', 'skipped');
        });

        return response()->json([
            ...$result,
            'message' => $result['created'] > 0
                ? "Tuition posted to {$result['created']} student(s)." . ($result['skipped'] ? " {$result['skipped']} already had tuition for this term." : '')
                : 'All students in this section already have tuition posted for this term.',
        ]);
    }
}
