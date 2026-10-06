<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\Grade;
use App\Models\Section;
use App\Models\SectionSubject;
use App\Models\Student;
use App\Models\User;
use Illuminate\Http\Request;

class AcademicLeadershipController extends Controller
{
    /** College-wide dean overview or department-scoped chair overview. */
    public function dashboard(Request $request)
    {
        $user = $request->user();
        $this->authorizeLeadership($request);
        $isDepartmentChair = $user->position === User::POSITION_HEAD_DEPARTMENT;
        $user->loadMissing('academicDepartment.courses');

        if ($isDepartmentChair && !$user->department_id) {
            return response()->json(['message' => 'Assign this Department Chair to a department before opening the portal.'], 422);
        }

        $sectionsQuery = Section::query()->where('program_type', 'college');
        if ($isDepartmentChair) {
            $sectionsQuery->whereIn('course', $user->academicDepartment?->courses->pluck('name') ?? []);
        }

        $sections = $sectionsQuery
            ->withCount(['students as enrolled_students_count' => fn ($query) => $query->wherePivot('status', 'enrolled')])
            ->orderBy('year_level')
            ->orderBy('name')
            ->get(['id', 'name', 'program_type', 'course', 'strand', 'year_level', 'semester', 'school_year']);

        $sectionIds = $sections->pluck('id');
        $studentUserIds = $sectionIds->isEmpty()
            ? collect()
            : Section::query()->whereIn('id', $sectionIds)->with(['students' => fn ($query) => $query->wherePivot('status', 'enrolled')])->get()->pluck('students')->flatten()->pluck('id')->unique();
        $studentIds = Student::query()->whereIn('user_id', $studentUserIds)->pluck('id');
        $classQuery = SectionSubject::query()->whereIn('section_id', $sectionIds);

        $attendanceToday = Attendance::query()->whereIn('student_id', $studentIds)->whereDate('date', today());
        $attendanceCount = (clone $attendanceToday)->count();
        $presentCount = (clone $attendanceToday)->where('status', 'present')->count();

        $recentGrades = Grade::query()
            ->whereIn('student_id', $studentIds)
            ->with(['student:id,first_name,last_name,student_id', 'schoolClass:id,subject,section,grade_level'])
            ->latest()
            ->limit(8)
            ->get();

        $departmentTeachers = collect();
        if ($isDepartmentChair && $user->department_id) {
            $departmentTeachers = User::query()
                ->where('department_id', $user->department_id)
                ->where('role', User::ROLE_FACULTY)
                ->where(function ($query) {
                    $query->whereNull('position')
                        ->orWhere('position', User::POSITION_TEACHER);
                })
                ->orderBy('name')
                ->get(['id', 'name', 'email', 'department_id', 'position']);
        }

        return response()->json([
            'leader' => $user->name,
            'position' => $user->position,
            'department' => $isDepartmentChair ? $user->academicDepartment?->name : null,
            'summary' => [
                'students' => $studentIds->count(),
                'sections' => $sections->count(),
                'classes' => (clone $classQuery)->count(),
                'faculty' => (clone $classQuery)->whereNotNull('teacher_id')->distinct('teacher_id')->count('teacher_id'),
                'average_grade' => round((float) (Grade::query()->whereIn('student_id', $studentIds)->avg('score') ?? 0), 1),
                'attendance_rate' => $attendanceCount > 0 ? round(($presentCount / $attendanceCount) * 100, 1) : null,
                'attendance_records_today' => $attendanceCount,
            ],
            'sections' => $sections,
            'recent_grades' => $recentGrades,
            'department_teachers' => $departmentTeachers,
        ]);
    }

    private function authorizeLeadership(Request $request): void
    {
        $user = $request->user();
        $isLeader = in_array($user?->position, [User::POSITION_HEAD_DEPARTMENT, User::POSITION_DEAN], true)
            || in_array($user?->role, [User::POSITION_HEAD_DEPARTMENT, User::ROLE_DEAN], true);

        abort_unless($isLeader, 403, 'Dean or Department Chair access is required.');
    }
}
