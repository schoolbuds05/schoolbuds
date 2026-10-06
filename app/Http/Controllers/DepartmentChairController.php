<?php

namespace App\Http\Controllers;

use App\Models\Course;
use App\Models\Department;
use App\Models\Grade;
use App\Models\GradeChangeRequest;
use App\Models\GradeSubmission;
use App\Models\SchoolClass;
use App\Models\Section;
use App\Models\Student;
use App\Models\User;
use App\Services\GradeWorkflowService;
use App\Services\GradeChangeRequestService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DepartmentChairController extends Controller
{
    public function teachers()
    {
        return $this->page('teachers');
    }

    public function grades()
    {
        $user = request()->user();
        abort_unless($user?->position === User::POSITION_HEAD_DEPARTMENT, 403);

        $department = Department::query()->with('courses')->find($user->department_id);
        abort_unless($department, 403, 'Assign this Department Chair to a department first.');

        $courses = $department->courses->where('program_type', 'college')->values();
        $sections = $this->departmentSections($courses)->get();
        $classes = $this->schoolClassesForSections($sections);
        $submissions = GradeSubmission::query()
            ->whereIn('school_class_id', $classes->pluck('id'))
            ->whereIn('status', [GradeSubmission::STATUS_CHAIR_REVIEW, GradeSubmission::STATUS_REGISTRAR_RETURNED])
            ->with(['schoolClass.teacher', 'teacher', 'events.actor'])
            ->orderByDesc('submitted_at')
            ->paginate(25);
        $changeRequests = GradeChangeRequest::query()
            ->where('status', GradeChangeRequest::STATUS_CHAIR_REVIEW)
            ->whereHas('submission', fn ($query) => $query->whereIn('school_class_id', $classes->pluck('id')))
            ->with(['submission.schoolClass', 'teacher', 'events.actor'])
            ->orderByDesc('created_at')
            ->paginate(25, ['*'], 'change_page')
            ->withQueryString();

        return view('department-chair.grades', compact('department', 'submissions', 'changeRequests'));
    }

    public function reviewGrades(Request $request, GradeSubmission $submission, GradeWorkflowService $workflow)
    {
        $data = $request->validate([
            'decision' => ['required', 'in:approve,return'],
            'note' => ['nullable', 'required_if:decision,return', 'string', 'max:2000'],
        ]);

        $workflow->chairDecision($request->user(), $submission, $data['decision'], $data['note'] ?? null);

        return redirect()->route('department-chair.grades')->with('status', $data['decision'] === 'approve'
            ? 'Grade sheet approved and sent to the Registrar.'
            : 'Grade sheet returned to the teacher for correction.');
    }

    public function reviewGradeChangeRequest(
        Request $request,
        GradeChangeRequest $changeRequest,
        GradeChangeRequestService $workflow
    ) {
        $data = $request->validate([
            'decision' => ['required', 'in:approve,reject'],
            'note' => ['nullable', 'required_if:decision,reject', 'string', 'max:2000'],
        ]);

        $workflow->chairDecision($request->user(), $changeRequest, $data['decision'], $data['note'] ?? null);

        return redirect()->route('department-chair.grades')->with('status', $data['decision'] === 'approve'
            ? 'Grade change request approved and sent to the Registrar.'
            : 'Grade change request rejected.');
    }

    public function reviewPage(GradeSubmission $submission)
    {
        return redirect()->route('department-chair.grades');
    }

    public function students()
    {
        return $this->page('students');
    }

    public function reports()
    {
        return $this->page('reports');
    }

    private function page(string $page)
    {
        $user = request()->user();
        abort_unless($user?->position === User::POSITION_HEAD_DEPARTMENT, 403);

        $department = Department::query()->with('courses')->find($user->department_id);
        abort_unless($department, 403, 'Assign this Department Chair to a department first.');

        $courses = $department->courses
            ->where('program_type', 'college')
            ->sortBy('name')
            ->values();
        $sections = $this->departmentSections($courses)->get();
        $data = match ($page) {
            'teachers' => [
                'teachers' => $department->teachers()->orderBy('name')->paginate(50),
            ],
            'students' => [
                'students' => $this->departmentStudents($courses),
            ],
            'reports' => [
                'courseReports' => $this->courseReports($courses),
                'summary' => $this->departmentSummary($sections, $courses),
            ],
        };

        $titles = [
            'teachers' => 'Teacher List',
            'students' => 'Enrolled Students',
            'reports' => 'Department Report',
        ];

        return view('department-chair.index', [
            ...$data,
            'page' => $page,
            'title' => $titles[$page],
            'department' => $department,
            'courses' => $courses,
        ]);
    }

    private function departmentSections($courses)
    {
        return Section::query()
            ->where('program_type', 'college')
            ->whereIn('course', $courses->pluck('name'));
    }

    private function departmentStudents($courses)
    {
        $enrollments = $courses->flatMap(function (Course $course) {
            return $this->departmentSections(collect([$course]))
                ->with(['students' => fn ($query) => $query
                    ->wherePivot('status', 'enrolled')
                    ->with('student')
                    ->orderBy('name')])
                ->get()
                ->flatMap(fn (Section $section) => $section->students)
                ->map(fn (User $student) => [
                    'student' => $student,
                    'course' => $course->name,
                ]);
        });

        return $enrollments
            ->groupBy(fn ($enrollment) => $enrollment['student']->id)
            ->map(fn ($studentEnrollments) => [
                'student' => $studentEnrollments->first()['student'],
                'courses' => $studentEnrollments->pluck('course')->unique()->sort()->values(),
            ])
            ->sortBy(fn ($studentRow) => $studentRow['student']->name)
            ->values();
    }

    private function enrolledUserIds($sections)
    {
        if ($sections->isEmpty()) {
            return collect();
        }

        return DB::table('section_students')
            ->whereIn('section_id', $sections->pluck('id'))
            ->where('status', 'enrolled')
            ->distinct()
            ->pluck('user_id');
    }

    private function schoolClassesForSections($sections)
    {
        if ($sections->isEmpty()) {
            return collect();
        }

        return SchoolClass::query()
            ->where(function ($query) use ($sections) {
                foreach ($sections as $section) {
                    $subjectNames = $section->sectionSubjects()
                        ->with('subject:id,name')
                        ->get()
                        ->pluck('subject.name')
                        ->filter()
                        ->unique()
                        ->values();

                    if ($subjectNames->isEmpty()) {
                        continue;
                    }

                    $query->orWhere(function ($classQuery) use ($section, $subjectNames) {
                        $classQuery->where('section', $section->name)
                            ->where('grade_level', $section->year_level)
                            ->where('school_year', $section->school_year)
                            ->whereIn('subject', $subjectNames);
                    });
                }
            })
            ->get();
    }

    private function courseReports($courses)
    {
        return $courses->map(function (Course $course) {
            $sections = $this->departmentSections(collect([$course]))->get();
            $userIds = $this->enrolledUserIds($sections);
            $studentIds = $userIds->isEmpty()
                ? collect()
                : Student::query()->whereIn('user_id', $userIds)->pluck('id');
            $classes = $this->schoolClassesForSections($sections);
            $grades = $studentIds->isEmpty() || $classes->isEmpty()
                ? Grade::query()->whereRaw('1 = 0')
                : Grade::query()
                    ->whereIn('student_id', $studentIds)
                    ->whereIn('school_class_id', $classes->pluck('id'));

            return [
                'course' => $course,
                'sections' => $sections->count(),
                'students' => $userIds->count(),
                'grades' => (clone $grades)->count(),
                'average' => round((float) ((clone $grades)->avg('score') ?? 0), 1),
            ];
        });
    }

    private function departmentSummary($sections, $courses): array
    {
        $userIds = $this->enrolledUserIds($sections);
        $studentIds = $userIds->isEmpty()
            ? collect()
            : Student::query()->whereIn('user_id', $userIds)->pluck('id');
        $classes = $this->schoolClassesForSections($sections);
        $grades = $studentIds->isEmpty() || $classes->isEmpty()
            ? Grade::query()->whereRaw('1 = 0')
            : Grade::query()
                ->whereIn('student_id', $studentIds)
                ->whereIn('school_class_id', $classes->pluck('id'));

        return [
            'teachers' => auth()->user()->academicDepartment->teachers()->count(),
            'courses' => $courses->count(),
            'sections' => $sections->count(),
            'students' => $userIds->count(),
            'grades' => (clone $grades)->count(),
            'average' => round((float) ((clone $grades)->avg('score') ?? 0), 1),
        ];
    }
}
