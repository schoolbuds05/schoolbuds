<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Web\Concerns\AuthorizesPortal;
use App\Models\Department;
use App\Models\Subject;
use App\Models\TeacherSubjectEligibility;
use App\Models\User;
use App\Services\TeachingEligibilityService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TeachingEligibilityController extends Controller
{
    use AuthorizesPortal;

    public function mine(Request $request, TeachingEligibilityService $workflow)
    {
        $workflow->requireTeacher($request->user());
        $rows = TeacherSubjectEligibility::query()->where('teacher_id', $request->user()->id)
            ->with(['subject.department:id,name', 'reviewer:id,name'])->latest('updated_at')->paginate(25);
        $subjects = $this->availableSubjects()->whereDoesntHave('teachingEligibilities', fn ($query) => $query
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
            ->orderBy('name')->get(['id', 'name', 'email']);

        return $this->page($request, compact('department', 'rows', 'subjects', 'teachers') + ['mode' => 'chair']);
    }

    public function owners(Request $request)
    {
        $this->requireAnyRole($request, ['admin', 'registrar']);
        $rows = Subject::query()->with('department:id,name')->orderBy('code')->paginate(25);
        $departments = Department::query()->orderBy('name')->get(['id', 'name', 'is_active']);

        return $this->page($request, compact('rows', 'departments') + ['mode' => 'ownership']);
    }

    public function assignOwner(Request $request, Subject $subject)
    {
        $this->requireAnyRole($request, ['admin', 'registrar']);
        $data = $request->validate(['department_id' => ['nullable', 'integer', 'exists:departments,id']]);
        DB::transaction(function () use ($subject, $data) {
            $subject = Subject::query()->lockForUpdate()->findOrFail($subject->id);
            $subject->update(['department_id' => $data['department_id'] ?? null]);
        });

        return $this->saved($request, $subject->fresh(), 'Managing department updated.');
    }

    public function store(Request $request, TeachingEligibilityService $workflow)
    {
        $workflow->requireTeacher($request->user());
        $data = $request->validate([
            'subject_id' => ['required', 'integer', 'exists:subjects,id'],
            'qualification' => ['required', 'string', 'max:4000'],
        ]);
        $eligibility = $workflow->request($request->user(), $data['subject_id'], $data['qualification']);

        return $this->saved($request, $eligibility, 'Subject request sent to the managing department chair.', 201);
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
