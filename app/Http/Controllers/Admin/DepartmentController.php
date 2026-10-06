<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Web\Concerns\AuthorizesPortal;
use App\Models\Course;
use App\Models\Department;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class DepartmentController extends Controller
{
    use AuthorizesPortal;

    public function index(Request $request)
    {
        $this->requireAnyRole($request, ['admin']);

        $search = trim((string) $request->query('search', ''));
        $programType = $request->query('program_type');
        $departments = Department::query()
            ->with(['chair:id,name', 'courses:id,department_id,name,acronym', 'teachers:id,name,email,department_id,position'])
            ->withCount(['teachers as faculty_count'])
            ->when(in_array($programType, ['college', 'shs'], true), function ($query) use ($programType) {
                $query->whereHas('courses', fn ($courseQuery) => $courseQuery->where('program_type', $programType));
            })
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($departmentQuery) use ($search) {
                    $departmentQuery->where('name', 'like', "%{$search}%")
                        ->orWhere('code', 'like', "%{$search}%")
                        ->orWhereHas('chair', fn ($chairQuery) => $chairQuery->where('name', 'like', "%{$search}%"));
                });
            })
            ->orderBy('name')
            ->get();
        $courses = Course::query()->where('program_type', 'college')->where('is_active', true)->orderBy('name')->get(['id', 'name', 'acronym', 'department_id']);
        $chairs = User::query()
            ->where('role', User::ROLE_FACULTY)
            ->where('position', User::POSITION_HEAD_DEPARTMENT)
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'department_id']);

        $availableTeachers = User::query()
            ->where('role', User::ROLE_FACULTY)
            ->where(function ($query) {
                $query->whereNull('position')
                    ->orWhere('position', User::POSITION_TEACHER);
            })
            ->whereNull('department_id')
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'department_id']);

        return view('admin.departments.index', compact('departments', 'courses', 'chairs', 'availableTeachers'));
    }

    public function store(Request $request)
    {
        $this->requireAnyRole($request, ['admin']);
        $data = $this->validated($request);
        $department = Department::create($this->departmentData($data));
        $this->syncProgramsAndChair($department, $data);

        return back()->with('status', 'Department created.');
    }

    public function update(Request $request, Department $department)
    {
        $this->requireAnyRole($request, ['admin']);
        $data = $this->validated($request, $department);
        $department->update($this->departmentData($data));
        $this->syncProgramsAndChair($department, $data);

        return back()->with('status', 'Department updated.');
    }

    public function removeTeacher(Request $request, Department $department, User $user)
    {
        $this->requireAnyRole($request, ['admin']);

        if ($user->department_id !== $department->id) {
            return back()->withErrors(['teacher' => 'This teacher is not assigned to this department.']);
        }

        $user->update([
            'department_id' => null,
            'department' => null,
        ]);

        return back()->with('status', $user->name . ' removed from the department.');
    }

    private function validated(Request $request, ?Department $department = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique('departments', 'name')->ignore($department?->id)],
            'code' => ['required', 'string', 'max:20', Rule::unique('departments', 'code')->ignore($department?->id)],
            'chair_user_id' => ['nullable', 'exists:users,id'],
            'teacher_ids' => ['nullable', 'array'],
            'teacher_ids.*' => ['integer', 'exists:users,id'],
            'course_ids' => ['nullable', 'array'],
            'course_ids.*' => ['integer', Rule::exists('courses', 'id')->where('program_type', 'college')],
            'is_active' => ['nullable', 'boolean'],
        ]);
    }

    private function departmentData(array $data): array
    {
        return [
            'name' => trim($data['name']),
            'code' => strtoupper(trim($data['code'])),
            'chair_user_id' => $data['chair_user_id'] ?? null,
            'is_active' => (bool) ($data['is_active'] ?? false),
        ];
    }

    private function syncProgramsAndChair(Department $department, array $data): void
    {
        Course::query()->where('department_id', $department->id)->update(['department_id' => null]);
        Course::query()->whereIn('id', $data['course_ids'] ?? [])->update(['department_id' => $department->id]);

        $teacherIds = array_values(array_filter(array_map('intval', $data['teacher_ids'] ?? [])));

        if ($teacherIds) {
            User::query()
                ->where('role', User::ROLE_FACULTY)
                ->whereIn('id', $teacherIds)
                ->update([
                    'department_id' => $department->id,
                    'department' => $department->name,
                ]);
        }

        if ($department->chair_user_id) {
            Department::query()->where('chair_user_id', $department->chair_user_id)->whereKeyNot($department->id)->update(['chair_user_id' => null]);
            User::query()->whereKey($department->chair_user_id)->update([
                'position' => User::POSITION_HEAD_DEPARTMENT,
                'department_id' => $department->id,
                'department' => $department->name,
            ]);
        }
    }
}
