<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use App\Models\AcademicTerm;
use App\Models\Attendance;
use App\Models\SectionSubject;
use App\Models\SchoolClass;
use App\Services\GradeWorkflowService;
use Illuminate\Http\Request;

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
            'isPastView',
            'attendanceDates',
        ));
    }

    public function store(Request $request, SchoolClass $class)
    {
        abort_unless((int) $class->teacher_id === (int) $request->user()->id, 403);
        abort_if($request->query('view') === 'past', 403);
        abort_unless($this->isCurrentClass($class), 403);

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