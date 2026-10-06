<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Web\Concerns\AuthorizesPortal;
use App\Models\ActivityLog;
use App\Models\Course;
use App\Models\EnrollmentApplication;
use App\Models\Fee;
use App\Models\Section;
use App\Models\Student;
use App\Models\StudentReward;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Http\Request;

class ReportsController extends Controller
{
    use AuthorizesPortal;

    public function admin(Request $request)
    {
        $this->requireAnyRole($request, ['admin']);

        return view('reports.system', $this->reportData('admin'));
    }

    public function registrar(Request $request)
    {
        $this->requireAnyRole($request, ['admin', 'registrar']);

        return view('reports.system', $this->reportData('registrar'));
    }

    private function reportData(string $scope): array
    {
        $isAdmin = $scope === 'admin';

        $summary = [
            'users' => $isAdmin ? User::count() : null,
            'students' => Student::count(),
            'active_students' => Student::where('status', 'active')->count(),
            'enrollments' => EnrollmentApplication::count(),
            'courses' => Course::count(),
            'subjects' => Subject::count(),
            'sections' => Section::count(),
            'points' => (int) StudentReward::sum('points'),
            'unpaid_fees' => (float) Fee::where('status', '!=', 'paid')->sum('amount'),
            'collected_fees' => (float) Fee::where('status', 'paid')->sum('paid_amount'),
        ];

        return [
            'scope' => $scope,
            'title' => $isAdmin ? 'Admin Reports' : 'Registrar Reports',
            'generatedAt' => now(),
            'summary' => $summary,
            'studentStatus' => $this->countsBy(Student::query(), 'status'),
            'enrollmentStatus' => $this->countsBy(EnrollmentApplication::query(), 'status'),
            'programTypes' => $this->countsBy(Course::query(), 'program_type'),
            'subjectPrograms' => $this->countsBy(Subject::query(), 'program_type'),
            'sectionPrograms' => $this->countsBy(Section::query(), 'program_type'),
            'userRoles' => $isAdmin ? $this->countsBy(User::query(), 'role') : collect(),
            'recentActivity' => $isAdmin
                ? ActivityLog::latest()->take(8)->get()
                : collect(),
        ];
    }

    private function countsBy($query, string $column)
    {
        return $query
            ->selectRaw("COALESCE({$column}, 'Unspecified') as label, COUNT(*) as total")
            ->groupBy($column)
            ->orderBy('label')
            ->get();
    }
}
