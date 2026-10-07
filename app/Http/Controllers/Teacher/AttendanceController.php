<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\Attendance;
use App\Services\GradeWorkflowService;
use Illuminate\Http\Request;

class AttendanceController extends Controller
{
    public function index(SchoolClass $class, GradeWorkflowService $workflow)
    {
        abort_unless((int) $class->teacher_id === (int) auth()->id(), 403);
        $students = $workflow->classStudents($class);

        $today = today()->toDateString();

        $attendance = Attendance::where('school_class_id', $class->id)
            ->whereDate('date', $today)
            ->get()
            ->keyBy('student_id');

        return view('teacher.attendance', compact('class', 'students', 'attendance', 'today'));
    }

    public function store(Request $request, SchoolClass $class)
    {
        abort_unless((int) $class->teacher_id === (int) $request->user()->id, 403);

        $request->validate([
            'date'               => 'required|date',
            'attendance'         => 'required|array',
            'attendance.*.student_id' => 'required|exists:students,id',
            'attendance.*.status'     => 'required|in:present,absent,late,excused',
        ]);

        foreach ($request->attendance as $record) {
            Attendance::updateOrCreate(
                [
                    'student_id'      => $record['student_id'],
                    'school_class_id' => $class->id,
                    'date'            => $request->date,
                ],
                ['status' => $record['status']]
            );
        }

        return back()->with('success', 'Attendance saved for ' . $request->date);
    }
}