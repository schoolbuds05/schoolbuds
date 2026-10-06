<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Student;
use App\Models\EnrollmentApplication;
use App\Models\Grade;
use App\Models\Attendance;
use App\Models\Fee;
use App\Services\PointsService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StudentController extends Controller
{
    public function index()
    {
        return response()->json(Student::with('user')->get());
    }

    public function store(Request $request)
    {
        $request->validate([
            'student_id'  => 'required|unique:students',
            'first_name'  => 'required',
            'last_name'   => 'required',
            'email'       => 'required|email|unique:students',
            'gender'      => 'required|in:male,female',
            'grade_level' => 'required',
            'section'     => 'required',
            'school_year' => 'required',
            'user_id'     => 'required|exists:users,id',
        ]);

        $student = Student::create($request->all());
        return response()->json($student, 201);
    }

    public function show(Student $student)
    {
        return response()->json($student->load('user'));
    }

    public function update(Request $request, Student $student)
    {
        $student->update($request->all());
        return response()->json($student);
    }

    public function destroy(Student $student)
    {
        $student->delete();
        return response()->json(['message' => 'Student deleted']);
    }

    public function dashboard(Request $request, PointsService $points)
    {
        $user = $request->user();
        $student = Student::where('user_id', $user->id)->first();
        $latestApplication = EnrollmentApplication::query()
            ->where('user_id', $user->id)
            ->latest()
            ->first();

        if (!$student) {
            return response()->json([
                'student' => null,
                'user' => $user,
                'enrollment_application' => $latestApplication,
                'grades' => (object) [],
                'attendance_pct' => 0,
                'pending_fees' => [],
                'reward_summary' => $this->emptyRewardSummary(),
            ]);
        }

        $this->applyDisplaySection($student);
        $student->setAttribute('profile_photo_url', $user->profile_photo_url);

        $application = EnrollmentApplication::query()
            ->where('user_id', $student->user_id)
            ->where('status', 'approved')
            ->latest()
            ->first();

        if ($application) {
            $student->setAttribute('enrollment', [
                'id' => $application->id,
                'program_type' => $application->program_type,
                'course' => $application->course,
                'strand' => $application->strand,
                'year_level' => $application->year_level,
                'grade_level' => $application->grade_level,
                'semester' => $application->semester,
                'academic_status' => $application->academic_status,
            ]);
        }

        $grades = Grade::where('student_id', $student->id)
            ->with('schoolClass')
            ->get()
            ->groupBy('quarter');

        $attendance = Attendance::where('student_id', $student->id)->get();
        $totalDays = $attendance->count();
        $presentDays = $attendance->where('status', 'present')->count();
        $attendancePct = $totalDays > 0
            ? round(($presentDays / $totalDays) * 100, 1)
            : 0;

        $fees = Fee::where('student_id', $student->id)
            ->where('status', '!=', 'paid')
            ->get();

        return response()->json([
            'student'        => $student,
            'user'           => $user,
            'enrollment_application' => $latestApplication,
            'grades'         => $grades,
            'attendance_pct' => $attendancePct,
            'pending_fees'   => $fees,
            'reward_summary' => $points->summaryFor($student, $student->school_year),
        ]);
    }

    private function applyDisplaySection(Student $student): void
    {
        $section = DB::table('section_students')
            ->join('sections', 'sections.id', '=', 'section_students.section_id')
            ->where('section_students.user_id', $student->user_id)
            ->where('section_students.status', 'enrolled')
            ->select('sections.name', 'sections.year_level', 'sections.school_year')
            ->latest('section_students.created_at')
            ->first();

        if (!$section) {
            return;
        }

        $student->setAttribute('section', $section->name ?: $student->section);
        $student->setAttribute('grade_level', $section->year_level ?: $student->grade_level);
        $student->setAttribute('school_year', $section->school_year ?: $student->school_year);
    }

    private function emptyRewardSummary(): array
    {
        return [
            'points' => 0,
            'earned_points' => 0,
            'redeemable_points' => 0,
            'redemption_cap' => PointsService::REDEMPTION_CAP,
            'peso_value' => 0,
            'level' => 1,
            'current_level_points' => 0,
            'next_level_at' => 100,
            'points_to_next_level' => 100,
            'semester_cap' => PointsService::SEMESTER_CAP,
            'semester_cap_remaining' => PointsService::SEMESTER_CAP,
            'redemption_cap_remaining' => PointsService::REDEMPTION_CAP,
            'rewards_count' => 0,
            'by_source' => [],
        ];
    }
}
