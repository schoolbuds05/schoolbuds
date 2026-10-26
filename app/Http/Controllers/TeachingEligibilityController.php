<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Web\Concerns\AuthorizesPortal;
use App\Models\Course;
use App\Models\Department;
use App\Models\Subject;
use App\Models\TeacherSubjectEligibility;
use App\Models\User;
use App\Services\TeachingEligibilityService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class TeachingEligibilityController extends Controller
{
    use AuthorizesPortal;

    public function mine(Request $request, TeachingEligibilityService $workflow)
    {
        $teacher = $request->user();
        $workflow->requireTeacher($teacher);
        $rows = TeacherSubjectEligibility::query()->where('teacher_id', $request->user()->id)
            ->with(['subject.department:id,name', 'reviewer:id,name'])->latest('updated_at')->paginate(25);
        $subjectsQuery = $this->availableSubjects();
        if ($teacher->position === User::POSITION_HEAD_DEPARTMENT) {
            $department = $workflow->chairDepartment($teacher);
            $subjectsQuery->where('department_id', $department->id);
        }
        $subjects = $subjectsQuery->whereDoesntHave('teachingEligibilities', fn ($query) => $query
            ->where('teacher_id', $request->user()->id)->whereIn('status', ['pending', 'approved']))->get();

        return $this->page($request, ['mode' => 'teacher', 'rows' => $rows, 'subjects' => $subjects]);
    }

    public function chairIndex(Request $request, TeachingEligibilityService $workflow)
    {
        $department = $workflow->chairDepartment($request->user());
        $rows = TeacherSubjectEligibility::query()
            ->whereHas('subject', fn ($query) => $query->where('department_id', $department->id))
            ->with(['subject.department:id,name', 'teacher:id,name,email', 'reviewer:id,name'])
            ->latest('updated_at')->paginate(25);
        $subjects = $this->availableSubjects()->where('department_id', $department->id)->get();
        $teachers = User::query()->teachingFaculty()->whereKeyNot($request->user()->id)
            ->where('department_id', $department->id)
            ->orderBy('name')->get(['id', 'name', 'email']);

        return $this->page($request, compact('department', 'rows', 'subjects', 'teachers') + ['mode' => 'chair']);
    }

    public function registrarIndex(Request $request)
    {
        $this->requireAnyRole($request, ['registrar']);
        $rows = TeacherSubjectEligibility::query()
            ->where('source', 'teacher_request')
            ->whereHas('teacher', fn ($query) => $query->where('position', User::POSITION_HEAD_DEPARTMENT))
            ->with(['subject.department:id,name', 'teacher:id,name,email', 'reviewer:id,name'])
            ->latest('updated_at')->paginate(25);

        return $this->page($request, compact('rows') + ['mode' => 'registrar']);
    }

    public function owners(Request $request)
    {
        $this->requireAnyRole($request, ['admin', 'registrar']);
        $departments = Department::query()->orderBy('name')->get(['id', 'name', 'is_active']);
        $request->validate([
            'subject_type' => ['nullable', Rule::in(['general', 'course'])],
            'department_id' => [
                'nullable',
                'string',
                Rule::in([...$departments->pluck('id')->map(fn ($id) => (string) $id)->all(), 'unassigned']),
            ],
        ]);
        $rows = Subject::query()->with('department:id,name')
            ->when($request->filled('subject_type'), function ($query) use ($request) {
                $query->where(function ($scopeQuery) use ($request) {
                    if ($request->query('subject_type') === 'general') {
                        $scopeQuery->where(function ($generalQuery) {
                            $generalQuery->whereNull('course')->orWhere('course', '');
                        })->where(function ($generalQuery) {
                            $generalQuery->whereNull('strand')->orWhere('strand', '');
                        });

                        return;
                    }

                    $scopeQuery->where(function ($courseQuery) {
                        $courseQuery->whereNotNull('course')->where('course', '!=', '');
                    })->orWhere(function ($strandQuery) {
                        $strandQuery->whereNotNull('strand')->where('strand', '!=', '');
                    });
                });
            })
            ->when($request->filled('department_id'), function ($query) use ($request) {
                if ($request->query('department_id') === 'unassigned') {
                    $query->whereNull('department_id');
                } else {
                    $query->where('department_id', $request->query('department_id'));
                }
            })
            ->orderBy('code')->paginate(25)->withQueryString();
        $courseScopes = $rows->getCollection()
            ->where('program_type', 'college')
            ->pluck('course')
            ->filter()
            ->unique()
            ->values();
        $courseByScope = Course::query()
            ->where('program_type', 'college')
            ->where(function ($query) use ($courseScopes) {
                $query->whereIn('name', $courseScopes)
                    ->orWhereIn('acronym', $courseScopes);
            })
            ->with('department:id,name')
            ->get(['id', 'name', 'acronym', 'department_id'])
            ->reduce(function (array $coursesByScope, Course $course): array {
                if ($course->acronym) {
                    $coursesByScope[$course->acronym] ??= $course;
                }
                $coursesByScope[$course->name] = $course;

                return $coursesByScope;
            }, []);
        $manualOwnerCount = $rows->getCollection()
            ->filter(fn (Subject $subject) => ! (
                $subject->program_type === 'college'
                && filled($subject->course)
                && array_key_exists($subject->course, $courseByScope)
            ))
            ->count();

        return $this->page($request, compact('rows', 'departments', 'courseByScope', 'manualOwnerCount') + ['mode' => 'ownership']);
    }

    public function assignOwner(Request $request, Subject $subject)
    {
        $this->requireAnyRole($request, ['admin', 'registrar']);
        $data = $request->validate([
            'department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'scroll_y' => ['nullable', 'integer', 'min:0'],
        ]);
        DB::transaction(function () use ($subject, $data) {
            $subject = Subject::query()->lockForUpdate()->findOrFail($subject->id);
            $subject->update(['department_id' => $data['department_id'] ?? null]);
        });

        if ($request->is('api/*')) {
            return $this->saved($request, $subject->fresh(), 'Managing department updated.');
        }

        return back()
            ->with('scroll_y', $data['scroll_y'] ?? 0)
            ->with('status', 'Managing department updated.');
    }

    public function updateOwners(Request $request)
    {
        $this->requireAnyRole($request, ['admin', 'registrar']);
        $data = $request->validate([
            'assignments' => ['required', 'array', 'min:1'],
            'assignments.*.subject_id' => ['required', 'integer', 'distinct', 'exists:subjects,id'],
            'assignments.*.department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'scroll_y' => ['nullable', 'integer', 'min:0'],
        ]);

        $updatedCount = DB::transaction(function () use ($data): int {
            $updatedCount = 0;

            foreach ($data['assignments'] as $assignment) {
                $subject = Subject::query()->lockForUpdate()->findOrFail($assignment['subject_id']);
                $subject->department_id = $assignment['department_id'] ?? null;

                if ($subject->isDirty('department_id')) {
                    $subject->save();
                    $updatedCount += $subject->wasChanged('department_id') ? 1 : 0;
                }
            }

            return $updatedCount;
        });

        return back()
            ->with('scroll_y', $data['scroll_y'] ?? 0)
            ->with('status', "Updated {$updatedCount} subject department(s).");
    }

    public function store(Request $request, TeachingEligibilityService $workflow)
    {
        $workflow->requireTeacher($request->user());
        $data = $request->validate([
            'subject_id' => ['required', 'integer', 'exists:subjects,id'],
            'qualification' => ['required', 'string', 'max:4000'],
        ]);
        $eligibility = $workflow->request($request->user(), $data['subject_id'], $data['qualification']);
        $message = $request->user()->position === User::POSITION_HEAD_DEPARTMENT
            ? 'Subject request sent to the Registrar for review.'
            : 'Subject request sent to the managing department chair.';

        return $this->saved($request, $eligibility, $message, 201);
    }

    public function review(Request $request, TeacherSubjectEligibility $eligibility, TeachingEligibilityService $workflow)
    {
        $workflow->chairDepartment($request->user());
        $data = $request->validate([
            'decision' => ['required', 'in:approve,reject'],
            'remarks' => ['nullable', 'required_if:decision,reject', 'string', 'max:2000'],
        ]);
        $eligibility = $workflow->review($request->user(), $eligibility, $data['decision'], $data['remarks'] ?? null);

        return $this->saved($request, $eligibility, 'Subject request reviewed.');
    }

    public function reviewChairRequest(Request $request, TeacherSubjectEligibility $eligibility, TeachingEligibilityService $workflow)
    {
        $this->requireAnyRole($request, ['registrar']);
        $data = $request->validate([
            'decision' => ['required', 'in:approve,reject'],
            'remarks' => ['nullable', 'required_if:decision,reject', 'string', 'max:2000'],
        ]);
        $eligibility = $workflow->reviewChairRequest($request->user(), $eligibility, $data['decision'], $data['remarks'] ?? null);

        return $this->saved($request, $eligibility, 'Department chair request reviewed.');
    }

    public function grant(Request $request, TeachingEligibilityService $workflow)
    {
        $workflow->chairDepartment($request->user());
        $data = $request->validate([
            'subject_id' => ['required', 'integer', 'exists:subjects,id'],
            'teacher_id' => ['required', 'integer', 'exists:users,id'],
            'remarks' => ['required', 'string', 'max:2000'],
        ]);
        $eligibility = $workflow->grant($request->user(), $data['subject_id'], $data['teacher_id'], $data['remarks']);

        return $this->saved($request, $eligibility, 'Teacher approved to teach this subject.', 201);
    }

    public function revoke(Request $request, TeacherSubjectEligibility $eligibility, TeachingEligibilityService $workflow)
    {
        $workflow->chairDepartment($request->user());
        $data = $request->validate(['remarks' => ['required', 'string', 'max:2000']]);
        $eligibility = $workflow->revoke($request->user(), $eligibility, $data['remarks']);

        return $this->saved($request, $eligibility, 'Teaching eligibility revoked.');
    }

    private function availableSubjects()
    {
        return Subject::query()->where('is_active', true)
            ->whereHas('department', fn ($query) => $query->where('is_active', true))
            ->with('department:id,name')->orderBy('code');
    }

    private function page(Request $request, array $data)
    {
        return $request->is('api/*') ? response()->json($data) : view('teaching-eligibility.index', $data);
    }

    private function saved(Request $request, $record, string $message, int $status = 200)
    {
        return $request->is('api/*')
            ? response()->json(['message' => $message, 'data' => $record], $status)
            : back()->with('status', $message);
    }
}
