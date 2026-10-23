<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use App\Models\AcademicTerm;
use App\Models\Attendance;
use App\Models\SchoolClass;
use App\Models\SectionSubject;
use App\Models\Student;
use App\Services\GradeWorkflowService;
use App\Services\PointsService;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class AttendanceController extends Controller
{
    public function index(Request $request, SchoolClass $class, GradeWorkflowService $workflow)
    {
        abort_unless((int) $class->teacher_id === (int) auth()->id(), 403);
        $today = today()->toDateString();
        $isCurrentClass = $this->isCurrentClass($class);
        $isPastView = $request->query('view') === 'past' || !$isCurrentClass;
        $students = $isPastView ? collect() : $workflow->classStudents($class);
        $attendanceDates = collect();
        $date = $today;

        if ($isPastView) {
            $attendanceDates = Attendance::query()
                ->where('school_class_id', $class->id)
                ->whereDate('date', '<', $today)
                ->distinct()
                ->orderByDesc('date')
                ->pluck('date')
                ->map(fn ($attendanceDate) => \Illuminate\Support\Carbon::parse($attendanceDate)->toDateString());

            $date = $request->query('date');
            if (!$date || !$attendanceDates->contains($date)) {
                $date = $attendanceDates->first();
            }
        }

        $existing = $date
            ? Attendance::query()
                ->where('school_class_id', $class->id)
                ->whereDate('date', $date)
                ->when($isPastView, fn ($query) => $query->with('student'))
                ->get()
                ->keyBy('student_id')
            : collect();

        if ($isPastView) {
            $students = $existing->pluck('student')->filter()->values();
        }

        return view('teacher.attendance', compact(
            'class',
            'students',
            'existing',
            'date',
            'today',
            'isCurrentClass',
            'isPastView',
            'attendanceDates',
        ));
    }

    public function store(
        Request $request,
        SchoolClass $class,
        GradeWorkflowService $workflow,
        PointsService $points
    ) {
        abort_unless((int) $class->teacher_id === (int) $request->user()->id, 403);
        abort_if($request->query('view') === 'past', 403);
        abort_unless($this->isCurrentClass($class), 403);

        $request->validate([
            'date'               => 'required|date',
            'attendance'         => 'required|array',
            'attendance.*.student_id' => 'required|exists:students,id',
            'attendance.*.status'     => 'required|in:present,absent,late,excused',
        ]);

        $roster = $workflow->classStudents($class)->keyBy('id');
        $submittedStudentIds = collect($request->input('attendance'))
            ->pluck('student_id')
            ->map(fn ($id) => (int) $id);
        if ($submittedStudentIds->diff($roster->keys())->isNotEmpty()) {
            throw ValidationException::withMessages([
                'attendance' => 'Attendance can only be recorded for students enrolled in this class.',
            ]);
        }

        $sectionSubject = SectionSubject::query()
            ->where('teacher_id', $class->teacher_id)
            ->whereHas('section', fn ($query) => $query
                ->where('name', $class->section)
                ->where('year_level', $class->grade_level)
                ->where('school_year', $class->school_year))
            ->whereHas('subject', fn ($query) => $query->where('name', $class->subject))
            ->first();

        foreach ($request->attendance as $record) {
            $attendance = Attendance::updateOrCreate(
                [
                    'student_id'      => $record['student_id'],
                    'school_class_id' => $class->id,
                    'date'            => $request->date,
                ],
                ['status' => $record['status']]
            );

            $student = Student::findOrFail($record['student_id']);
            $points->awardDailyAttendancePoints(
                $student,
                $record['status'],
                "attendance-daily:{$student->id}:{$class->id}:{$request->date}",
                $request->user(),
                $class->school_year,
                $sectionSubject?->section?->semester,
                ['attendance_id' => $attendance->id, 'school_class_id' => $class->id, 'date' => $request->date]
            );
            $points->syncMonthlyPerfectAttendance(
                $student,
                $request->date,
                $request->user(),
                $class->school_year,
                $sectionSubject?->section?->semester
            );
        }

        return back()->with('success', 'Attendance saved for ' . $request->date);
    }

    private function isCurrentClass(SchoolClass $class): bool
    {
        $activeTerm = AcademicTerm::query()->latest('updated_at')->first();
        if (!$activeTerm) {
            return false;
        }

        return SectionSubject::query()
            ->where('teacher_id', $class->teacher_id)
            ->whereHas('section', fn ($query) => $query
                ->where('name', $class->section)
                ->where('year_level', $class->grade_level)
                ->where('school_year', $class->school_year)
                ->where('school_year', $activeTerm->school_year)
                ->where('semester', $activeTerm->semester))
            ->whereHas('subject', fn ($query) => $query->where('name', $class->subject))
            ->exists();
    }
}