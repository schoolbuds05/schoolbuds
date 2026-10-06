<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AcademicTerm;
use App\Models\Grade;
use App\Models\SchoolClass;
use App\Models\SchoolNotification;
use App\Models\Student;
use App\Services\GradeWorkflowService;
use App\Services\PointsService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class GradeController extends Controller
{
    public function index()
    {
        return response()->json(Grade::with(['student', 'schoolClass'])->get());
    }

    public function store(Request $request, PointsService $points, GradeWorkflowService $workflow)
    {
        $class = SchoolClass::findOrFail($request->input('school_class_id'));
        $limits = $workflow->scoreLimits($class);
        $request->validate([
            'student_id'      => 'required|exists:students,id',
            'school_class_id' => 'required|exists:school_classes,id',
            'school_year'     => 'required',
            'quarter'         => 'required|in:1,2,3,4',
            'score'           => array_merge(
                ['nullable', 'numeric', 'min:' . $limits['min'], 'max:' . $limits['max']],
                $limits['is_college'] ? ['multiple_of:0.25'] : []
            ),
        ]);

        if ($message = $this->gradeDeadlineMessage($request->school_year, null)) {
            return response()->json(['message' => $message], 422);
        }

        $grade = Grade::updateOrCreate(
            [
                'student_id'      => $request->student_id,
                'school_class_id' => $request->school_class_id,
                'quarter'         => $request->quarter,
                'school_year'     => $request->school_year,
            ],
            [
                'score'   => $request->score,
                'remarks' => $request->remarks,
            ]
        );

        if ($request->score !== null) {
            $student = Student::find($request->student_id);
            if ($student) {
                $points->awardGradePoints(
                    $student,
                    (float) $request->score,
                    "grade:{$student->id}:{$request->school_class_id}:{$request->quarter}:{$request->school_year}",
                    $request->user(),
                    $request->school_year,
                    null,
                    ['grade_id' => $grade->id, 'school_class_id' => $request->school_class_id, 'quarter' => $request->quarter],
                    $limits['is_college']
                );
                $this->notifyParentGradePosted($student, $grade, $limits['is_college']);
            }
        }

        return response()->json($grade, 201);
    }

    public function show(Grade $grade)
    {
        return response()->json($grade->load(['student', 'schoolClass']));
    }

    public function update(Request $request, Grade $grade, PointsService $points, GradeWorkflowService $workflow)
    {
        $limits = $workflow->scoreLimits($grade->schoolClass);
        $data = $request->validate([
            'score' => array_merge(
                ['sometimes', 'nullable', 'numeric', 'min:' . $limits['min'], 'max:' . $limits['max']],
                $limits['is_college'] ? ['multiple_of:0.25'] : []
            ),
            'remarks' => ['sometimes', 'nullable', 'string', 'max:255'],
        ]);
        $grade->update($data);
        if ($grade->score !== null && $grade->student) {
            $points->awardGradePoints(
                $grade->student,
                (float) $grade->score,
                "grade:{$grade->student_id}:{$grade->school_class_id}:{$grade->quarter}:{$grade->school_year}",
                $request->user(),
                $grade->school_year,
                null,
                ['grade_id' => $grade->id, 'school_class_id' => $grade->school_class_id, 'quarter' => $grade->quarter],
                $limits['is_college']
            );
            $this->notifyParentGradePosted($grade->student, $grade, $limits['is_college']);
        }
        return response()->json($grade);
    }

    public function destroy(Grade $grade)
    {
        $grade->delete();
        return response()->json(['message' => 'Grade deleted']);
    }

    public function byStudent(Student $student)
    {
        $grades = Grade::where('student_id', $student->id)
            ->with('schoolClass')
            ->orderBy('quarter')
            ->get();

        return response()->json($grades);
    }

    public function mine(Request $request)
    {
        $student = Student::query()->where('user_id', $request->user()->id)->first();
        if (!$student) {
            return response()->json(['active_term' => null, 'view' => 'current', 'grades' => (object) []]);
        }

        $activeTerm = AcademicTerm::query()->latest('updated_at')->first();
        $view = $request->query('view') === 'past' ? 'past' : 'current';
        $grades = Grade::query()
            ->with('schoolClass')
            ->where('student_id', $student->id)
            ->whereHas('schoolClass', function ($classQuery) use ($activeTerm, $view) {
                $classQuery->whereExists(function ($sectionQuery) use ($activeTerm, $view) {
                    $sectionQuery->selectRaw('1')
                        ->from('sections')
                        ->join('section_subjects', 'section_subjects.section_id', '=', 'sections.id')
                        ->join('subjects', 'subjects.id', '=', 'section_subjects.subject_id')
                        ->whereColumn('sections.name', 'school_classes.section')
                        ->whereColumn('sections.year_level', 'school_classes.grade_level')
                        ->whereColumn('sections.school_year', 'school_classes.school_year')
                        ->whereColumn('sections.program_type', 'subjects.program_type')
                        ->whereColumn('section_subjects.section_id', 'sections.id')
                        ->whereColumn('section_subjects.subject_id', 'subjects.id')
                        ->where(function ($semesterQuery) {
                            $semesterQuery->whereColumn('sections.semester', 'subjects.semester')
                                ->orWhereNull('subjects.semester')
                                ->orWhere('subjects.semester', '');
                        })
                        ->where(function ($subjectQuery) {
                            $subjectQuery->whereColumn('subjects.name', 'school_classes.subject')
                                ->orWhereColumn('subjects.code', 'school_classes.subject');
                        })
                        ->when($activeTerm, fn ($query) => $query->where(function ($termQuery) use ($activeTerm, $view) {
                            if ($view === 'past') {
                                $termQuery->where('sections.school_year', '!=', $activeTerm->school_year)
                                    ->orWhere('sections.semester', '!=', $activeTerm->semester);
                            } else {
                                $termQuery->where('sections.school_year', $activeTerm->school_year)
                                    ->where('sections.semester', $activeTerm->semester);
                            }
                        }))
                        ->when(!$activeTerm && $view === 'current', fn ($query) => $query->whereRaw('1 = 0'));
                });
            })
            ->orderBy('quarter')
            ->get();

        $classIds = $grades->pluck('school_class_id')->unique()->values();
        $semesterByClass = DB::table('school_classes')
            ->join('sections', function ($join) {
                $join->on('sections.name', '=', 'school_classes.section')
                    ->on('sections.year_level', '=', 'school_classes.grade_level')
                    ->on('sections.school_year', '=', 'school_classes.school_year');
            })
            ->join('section_subjects', 'section_subjects.section_id', '=', 'sections.id')
            ->join('subjects', 'subjects.id', '=', 'section_subjects.subject_id')
            ->whereIn('school_classes.id', $classIds)
            ->where(function ($semesterQuery) {
                $semesterQuery->whereColumn('sections.semester', 'subjects.semester')
                    ->orWhereNull('subjects.semester')
                    ->orWhere('subjects.semester', '');
            })
            ->where(function ($subjectQuery) {
                $subjectQuery->whereColumn('subjects.name', 'school_classes.subject')
                    ->orWhereColumn('subjects.code', 'school_classes.subject');
            })
            ->select('school_classes.id as school_class_id', 'sections.semester')
            ->get()
            ->groupBy('school_class_id')
            ->map(fn ($rows) => $rows->first()->semester);

        $grades->each(function (Grade $grade) use ($semesterByClass) {
            $grade->schoolClass?->setAttribute('semester', $semesterByClass->get($grade->school_class_id));
        });

        return response()->json([
            'view' => $view,
            'active_term' => $activeTerm,
            'grades' => $grades->groupBy('quarter')->map(fn ($quarterGrades) => $quarterGrades->values()),
        ]);
    }

    private function gradeDeadlineMessage(string $schoolYear, ?string $semester): ?string
    {
        $query = AcademicTerm::where('school_year', $schoolYear);
        if ($semester) {
            $query->where('semester', $semester);
        }

        $term = $query->first();
        if ($term?->grade_finalization_deadline && now()->gt($term->grade_finalization_deadline)) {
            return 'Grade entry is closed for this term. Finalization deadline was ' . $term->grade_finalization_deadline->toDateTimeString() . '.';
        }

        return null;
    }

    private function notifyParentGradePosted(Student $student, Grade $grade, bool $isCollege): void
    {
        if (!$student->parent_user_id) {
            return;
        }

        SchoolNotification::create([
            'user_id' => $student->parent_user_id,
            'type' => ((float) $grade->score > ($isCollege ? 3 : 74)) ? 'low_grade_alert' : 'grade_posted_parent',
            'title' => ((float) $grade->score > ($isCollege ? 3 : 74)) ? 'Low grade alert' : 'Grade posted',
            'body' => "{$student->first_name} {$student->last_name} received {$grade->score} for Q{$grade->quarter}.",
            'channels' => ['in_app'],
            'data' => ['student_id' => $student->id, 'grade_id' => $grade->id],
        ]);
    }
}
