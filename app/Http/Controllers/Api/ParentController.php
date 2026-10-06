<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\Fee;
use App\Models\Grade;
use App\Models\Student;
use App\Services\PointsService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ParentController extends Controller
{
    public function dashboard(Request $request, PointsService $points)
    {
        if (!$request->user()->hasRole('parent') && $request->user()->role !== 'parent') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $children = Student::query()
            ->where('parent_user_id', $request->user()->id)
            ->orderBy('last_name')
            ->get()
            ->map(function (Student $student) use ($points) {
                $this->applyDisplaySection($student);

                $grades = Grade::where('student_id', $student->id)
                    ->with('schoolClass')
                    ->get()
                    ->groupBy('quarter');

                $attendance = Attendance::where('student_id', $student->id)->get();
                $totalDays = $attendance->count();
                $presentDays = $attendance->where('status', 'present')->count();

                $fees = Fee::where('student_id', $student->id)->get();

                return [
                    'student' => $student,
                    'grades' => $grades,
                    'attendance_pct' => $totalDays > 0 ? round(($presentDays / $totalDays) * 100, 1) : 0,
                    'fees' => $fees,
                    'fee_summary' => [
                        'total' => (float) $fees->sum('amount'),
                        'paid' => (float) $fees->sum('paid_amount'),
                        'balance' => (float) $fees->sum(fn (Fee $fee) => max(0, $fee->amount - $fee->paid_amount)),
                    ],
                    'reward_summary' => $points->summaryFor($student, $student->school_year),
                ];
            });

        return response()->json([
            'children' => $children,
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
}
