<?php

namespace App\Http\Controllers\Registrar;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Web\Concerns\AuthorizesPortal;
use App\Models\EnrollmentApplication;
use App\Models\Student;
use App\Models\StudentReward;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    use AuthorizesPortal;

    public function index(Request $request)
    {
        $this->requireAnyRole($request, ['admin', 'registrar']);

        $stats = [
            'pending_enrollments' => EnrollmentApplication::where('status', 'pending')->count(),
            'approved_enrollments' => EnrollmentApplication::where('status', 'approved')->count(),
            'active_students' => Student::where('status', 'active')->count(),
            'points_issued' => (int) StudentReward::sum('points'),
        ];

        $recentApplications = EnrollmentApplication::latest()->take(8)->get();
        $recentPoints = StudentReward::with(['student', 'awardedBy'])->latest()->take(8)->get();

        return view('registrar.dashboard', compact('stats', 'recentApplications', 'recentPoints'));
    }
}
