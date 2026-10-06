<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\SchoolNotification;
use App\Models\Student;
use App\Services\PointsService;
use Illuminate\Http\Request;

class AttendanceController extends Controller
{
    public function index()
    {
        return response()->json(Attendance::with(['student', 'schoolClass'])->get());
    }

    public function store(Request $request, PointsService $points)
    {
        $request->validate([
            'student_id'      => 'required|exists:students,id',
            'school_class_id' => 'required',
            'date'            => 'required|date',
            'status'          => 'required|in:present,absent,late,excused',
        ]);

        $attendance = Attendance::updateOrCreate(
            [
                'student_id'      => $request->student_id,
                'school_class_id' => $request->school_class_id,
                'date'            => $request->date,
            ],
            ['status' => $request->status, 'remarks' => $request->remarks]
        );

        $student = Student::find($request->student_id);
        if ($student) {
            $points->awardDailyAttendancePoints(
                $student,
                $request->status,
                "attendance-daily:{$student->id}:{$request->school_class_id}:{$request->date}",
                $request->user(),
                null,
                null,
                ['attendance_id' => $attendance->id, 'school_class_id' => $request->school_class_id, 'date' => $request->date]
            );
            $points->syncMonthlyPerfectAttendance($student, $request->date, $request->user());
            $this->notifyParentAttendance($student, $attendance);
        }

        return response()->json($attendance, 201);
    }

    public function show(Attendance $attendance)
    {
        return response()->json($attendance->load(['student', 'schoolClass']));
    }

    public function update(Request $request, Attendance $attendance, PointsService $points)
    {
        $attendance->update($request->all());
        if ($attendance->student) {
            $points->awardDailyAttendancePoints(
                $attendance->student,
                $attendance->status,
                "attendance-daily:{$attendance->student_id}:{$attendance->school_class_id}:{$attendance->date}",
                $request->user(),
                null,
                null,
                ['attendance_id' => $attendance->id, 'school_class_id' => $attendance->school_class_id, 'date' => $attendance->date]
            );
            $points->syncMonthlyPerfectAttendance($attendance->student, $attendance->date, $request->user());
            $this->notifyParentAttendance($attendance->student, $attendance);
        }
        return response()->json($attendance);
    }

    public function destroy(Attendance $attendance)
    {
        $attendance->delete();
        return response()->json(['message' => 'Attendance deleted']);
    }

    public function byStudent(Student $student)
    {
        $attendance = Attendance::where('student_id', $student->id)
            ->orderBy('date', 'desc')
            ->get();

        $total   = $attendance->count();
        $present = $attendance->where('status', 'present')->count();

        return response()->json([
            'records'        => $attendance,
            'total_days'     => $total,
            'present_days'   => $present,
            'attendance_pct' => $total > 0 ? round(($present / $total) * 100, 1) : 0,
        ]);
    }

    private function notifyParentAttendance(Student $student, Attendance $attendance): void
    {
        if (!$student->parent_user_id || $attendance->status === 'present') {
            return;
        }

        SchoolNotification::create([
            'user_id' => $student->parent_user_id,
            'type' => 'attendance_alert_parent',
            'title' => 'Attendance alert',
            'body' => "{$student->first_name} {$student->last_name} was marked {$attendance->status} on {$attendance->date}.",
            'channels' => ['in_app'],
            'data' => ['student_id' => $student->id, 'attendance_id' => $attendance->id],
        ]);
    }
}
