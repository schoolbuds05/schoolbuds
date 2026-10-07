<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AcademicTerm;
use App\Models\SchoolClass;
use App\Models\SchoolNotification;
use App\Models\SectionSubject;
use App\Models\Student;
use App\Models\StudentSubject;
use App\Models\StudentReward;
use App\Models\Grade;
use App\Models\GradeSubmission;
use App\Models\Attendance;
use App\Services\GradeWorkflowService;
use App\Services\PointsService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TeacherController extends Controller
{
    public function dashboard(Request $request)
    {
        $teacher = $request->user();
        $sectionSubjects = SectionSubject::where('teacher_id', $teacher->id)
            ->with(['section.students', 'subject'])
            ->get();
        $sectionSchoolClassIds = $sectionSubjects
            ->map(fn($sectionSubject) => $this->schoolClassForSectionSubject($sectionSubject)->id)
            ->values();

        $classes = $sectionSubjects
            ->map(fn($sectionSubject) => $this->sectionSubjectClassPayload($sectionSubject))
            ->concat($this->legacyClasses($teacher->id, $sectionSchoolClassIds->all()));

        $totalStudents = Student::query()
            ->whereIn('user_id', $classes->flatMap(fn($class) => $this->userIdsForClassPayload($class))->unique())
            ->count();

        $schoolClassIds = $sectionSchoolClassIds
            ->concat($this->legacyClasses($teacher->id, $sectionSchoolClassIds->all())->pluck('school_class_id'))
            ->unique()
            ->values();

        $todayAttendance = Attendance::whereIn('school_class_id', $schoolClassIds)
            ->whereDate('date', today())
            ->count();

        $recentGrades = Grade::whereIn('school_class_id', $schoolClassIds)
            ->with(['student', 'schoolClass'])
            ->latest()
            ->take(5)
            ->get();

        return response()->json([
            'teacher'          => $teacher->name,
            'total_classes'    => $classes->count(),
            'total_students'   => $totalStudents,
            'today_attendance' => $todayAttendance,
            'recent_grades'    => $recentGrades,
            'classes'          => $classes,
        ]);
    }

    public function classes(Request $request)
    {
        $classes = SectionSubject::where('teacher_id', $request->user()->id)
            ->with(['section.students', 'subject'])
            ->get();
        $sectionSchoolClassIds = $classes
            ->map(fn($sectionSubject) => $this->schoolClassForSectionSubject($sectionSubject)->id)
            ->values();

        $classes = $classes
            ->map(fn($sectionSubject) => $this->sectionSubjectClassPayload($sectionSubject))
            ->concat($this->legacyClasses($request->user()->id, $sectionSchoolClassIds->all()));

        return response()->json($classes);
    }

    public function classStudents(Request $request, $class)
    {
        [$sectionSubject, $schoolClass] = $this->resolveTeacherClass($request, $class);
        $userIds = $sectionSubject
            ? $this->enrolledUserIdsForSectionSubject($sectionSubject)
            : $this->enrolledUserIdsForSchoolClass($schoolClass);

        $students = Student::whereIn('user_id', $userIds)
            ->orderBy('last_name')
            ->get()
            ->map(function (Student $student) {
                $student->reward_points = (int) StudentReward::where('student_id', $student->id)->sum('points');
                return $student;
            });
        if ($sectionSubject) {
            $sectionUserIds = $sectionSubject->section->students()
                ->wherePivot('status', 'enrolled')
                ->pluck('users.id');
            $students->each(fn (Student $student) => $student->setAttribute(
                'is_irregular',
                strcasecmp((string) $student->academic_status, 'Irregular') === 0
                    || !$sectionUserIds->contains($student->user_id)
            ));
        }

        $grades = Grade::where('school_class_id', $schoolClass->id)
            ->get()
            ->groupBy('student_id');
        $gradeSubmissions = GradeSubmission::query()
            ->where('school_class_id', $schoolClass->id)
            ->where('school_year', $schoolClass->school_year)
            ->get()
            ->keyBy('quarter');

        return response()->json([
            'class'    => $sectionSubject ? $this->sectionSubjectClassPayload($sectionSubject) : $this->legacyClassPayload($schoolClass),
            'students' => $students,
            'grades'   => $grades,
            'grade_submissions' => $gradeSubmissions,
        ]);
    }

    public function saveGrades(Request $request, $class, GradeWorkflowService $workflow)
    {
        [$sectionSubject, $schoolClass] = $this->resolveTeacherClass($request, $class);

        $limits = $workflow->scoreLimits($schoolClass);
        $data = $request->validate([
            'grades'              => 'required|array',
            'grades.*.student_id' => 'required|exists:students,id',
            'grades.*.quarter'    => 'required|in:1,2,3,4',
                'grades.*.score'      => array_merge(
                ['required', 'numeric', 'min:' . $limits['min'], 'max:' . $limits['max']],
                $limits['is_college'] ? ['multiple_of:0.25'] : []
            ),
        ]);

        if ($message = $this->gradeDeadlineMessage($schoolClass->school_year, $sectionSubject?->section?->semester)) {
            return response()->json(['message' => $message], 422);
        }

        DB::transaction(function () use ($data, $workflow, $request, $schoolClass) {
            foreach (collect($data['grades'])->groupBy('quarter') as $quarter => $gradeRows) {
                $workflow->saveTeacherGrades(
                    $request->user(),
                    $schoolClass,
                    (string) $quarter,
                    $gradeRows->all(),
                    true
                );
            }
        });

        return response()->json(['message' => 'Grade sheet submitted to the Department Chair for review.']);
    }

    public function saveAttendance(Request $request, $class, PointsService $points)
    {
        [$sectionSubject, $schoolClass] = $this->resolveTeacherClass($request, $class);

        $request->validate([
            'date'                       => 'required|date',
            'attendance'                 => 'required|array',
            'attendance.*.student_id'    => 'required|exists:students,id',
            'attendance.*.status'        => 'required|in:present,absent,late,excused',
        ]);

        foreach ($request->attendance as $a) {
            $attendance = Attendance::updateOrCreate(
                [
                    'student_id'      => $a['student_id'],
                    'school_class_id' => $schoolClass->id,
                    'date'            => $request->date,
                ],
                ['status' => $a['status']]
            );

            $student = Student::find($a['student_id']);
            if ($student) {
                $points->awardDailyAttendancePoints(
                    $student,
                    $a['status'],
                    "attendance-daily:{$student->id}:{$schoolClass->id}:{$request->date}",
                    $request->user(),
                    $schoolClass->school_year,
                    $sectionSubject?->section?->semester,
                    ['attendance_id' => $attendance->id, 'school_class_id' => $schoolClass->id, 'date' => $request->date]
                );
                $points->syncMonthlyPerfectAttendance(
                    $student,
                    $request->date,
                    $request->user(),
                    $schoolClass->school_year,
                    $sectionSubject?->section?->semester
                );
                $this->notifyParentAttendance($student, $attendance);
            }
        }

        return response()->json(['message' => 'Attendance saved!']);
    }

    public function getAttendance(Request $request, $class)
    {
        [, $schoolClass] = $this->resolveTeacherClass($request, $class);
        $date = $request->date ?? today()->toDateString();

        $attendance = Attendance::where('school_class_id', $schoolClass->id)
            ->whereDate('date', $date)
            ->with('student')
            ->get();

        return response()->json([
            'date'       => $date,
            'attendance' => $attendance,
        ]);
    }

    public function classPerformance(Request $request, $class)
    {
        [$sectionSubject, $schoolClass] = $this->resolveTeacherClass($request, $class);
        $userIds = $sectionSubject
            ? $this->enrolledUserIdsForSectionSubject($sectionSubject)
            : $this->enrolledUserIdsForSchoolClass($schoolClass);

        $students = Student::whereIn('user_id', $userIds)->orderBy('last_name')->get();

        $performance = $students->map(function ($student) use ($schoolClass) {
            $grades = Grade::where('student_id', $student->id)
                ->where('school_class_id', $schoolClass->id)
                ->get();

            $avg = $grades->count() > 0
                ? round($grades->avg('score'), 1)
                : null;

            $attendance = Attendance::where('student_id', $student->id)
                ->where('school_class_id', $schoolClass->id)
                ->get();

            $attPct = $attendance->count() > 0
                ? round(($attendance->where('status','present')->count() / $attendance->count()) * 100, 1)
                : 0;

            return [
                'student'        => $student,
                'average'        => $avg,
                'attendance_pct' => $attPct,
                'grades'         => $grades,
            ];
        });

        return response()->json([
            'class'       => $sectionSubject ? $this->sectionSubjectClassPayload($sectionSubject) : $this->legacyClassPayload($schoolClass),
            'performance' => $performance,
        ]);
    }

    private function resolveTeacherClass(Request $request, $id): array
    {
        if (is_string($id) && str_starts_with($id, 'legacy-')) {
            return [
                null,
                SchoolClass::where('teacher_id', $request->user()->id)
                    ->findOrFail((int) substr($id, 7)),
            ];
        }

        $sectionSubject = $this->teacherSectionSubject($request, $id);

        return [$sectionSubject, $this->schoolClassForSectionSubject($sectionSubject)];
    }

    private function teacherSectionSubject(Request $request, $id): SectionSubject
    {
        return SectionSubject::where('teacher_id', $request->user()->id)
            ->with(['section.students', 'subject'])
            ->findOrFail($id);
    }

    private function sectionSubjectClassPayload(SectionSubject $sectionSubject): array
    {
        $section = $sectionSubject->section;
        $subject = $sectionSubject->subject;

        return [
            'id' => $sectionSubject->id,
            'subject' => trim(($subject?->code ? "{$subject->code} - " : '') . ($subject?->name ?? 'Subject')),
            'section' => $section?->name,
            'section_id' => $section?->id,
            'is_college' => $section?->program_type === 'college',
            'grade_level' => $section?->year_level,
            'course' => $section?->course,
            'strand' => $section?->strand,
            'school_year' => $section?->school_year,
            'semester' => $section?->semester,
            'room' => $sectionSubject->room,
            'schedule' => trim(implode(' ', array_filter([
                $sectionSubject->day,
                ($sectionSubject->time_start && $sectionSubject->time_end)
                    ? "{$sectionSubject->time_start}-{$sectionSubject->time_end}"
                    : null,
            ]))) ?: 'No schedule',
            'students_count' => $this->enrolledUserIdsForSectionSubject($sectionSubject)->count(),
        ];
    }

    private function legacyClasses(int $teacherId, array $excludeIds = [])
    {
        return SchoolClass::where('teacher_id', $teacherId)
            ->when($excludeIds, fn($query) => $query->whereNotIn('id', $excludeIds))
            ->orderBy('subject')
            ->get()
            ->map(fn(SchoolClass $schoolClass) => $this->legacyClassPayload($schoolClass));
    }

    private function legacyClassPayload(SchoolClass $schoolClass): array
    {
        return [
            'id' => 'legacy-' . $schoolClass->id,
            'school_class_id' => $schoolClass->id,
            'source' => 'legacy',
            'subject' => $schoolClass->subject,
            'section' => $schoolClass->section,
            'section_id' => null,
            'is_college' => (bool) $schoolClass->is_college,
            'grade_level' => $schoolClass->grade_level,
            'course' => null,
            'strand' => null,
            'school_year' => $schoolClass->school_year,
            'semester' => null,
            'room' => $schoolClass->room,
            'schedule' => $schoolClass->schedule ?: 'No schedule',
            'students_count' => $this->enrolledUserIdsForSchoolClass($schoolClass)->count(),
        ];
    }

    private function userIdsForClassPayload(array $class)
    {
        if (($class['source'] ?? null) === 'legacy') {
            return $this->enrolledUserIdsForSchoolClass(
                SchoolClass::find($class['school_class_id'])
            );
        }

        return $this->enrolledUserIdsForSectionSubject(
            SectionSubject::with(['section.students', 'subject'])->find($class['id'])
        );
    }

    private function enrolledUserIdsForSectionSubject(SectionSubject $sectionSubject)
    {
        $sectionUserIds = $sectionSubject->section->students()
            ->wherePivot('status', 'enrolled')
            ->pluck('users.id');

        $subjectUserIds = StudentSubject::query()
            ->where('subject_id', $sectionSubject->subject_id)
            ->where('status', 'enrolled')
            ->where(function ($query) use ($sectionSubject) {
                $query->where('section_id', $sectionSubject->section_id)
                    ->orWhereNull('section_id');
            })
            ->pluck('user_id');
        $droppedUserIds = StudentSubject::query()
            ->where('subject_id', $sectionSubject->subject_id)
            ->where('status', 'dropped')
            ->where(function ($query) use ($sectionSubject) {
                $query->where('section_id', $sectionSubject->section_id)
                    ->orWhereNull('section_id');
            })
            ->pluck('user_id');

        return $sectionUserIds
            ->merge($subjectUserIds)
            ->unique()
            ->diff($droppedUserIds)
            ->values();
    }

    private function enrolledUserIdsForSchoolClass(?SchoolClass $schoolClass)
    {
        if (!$schoolClass) {
            return collect();
        }

        return Student::query()
            ->where('grade_level', $schoolClass->grade_level)
            ->where('section', $schoolClass->section)
            ->where('school_year', $schoolClass->school_year)
            ->whereNotNull('user_id')
            ->pluck('user_id')
            ->values();
    }

    private function schoolClassForSectionSubject(SectionSubject $sectionSubject): SchoolClass
    {
        $section = $sectionSubject->section;
        $subject = $sectionSubject->subject;

        $schoolClass = SchoolClass::where('name', "{$section?->name} - {$subject?->code}")
            ->where('subject', $subject?->name ?? 'Subject')
            ->where('grade_level', $section?->year_level ?? '')
            ->where('section', $section?->name ?? '')
            ->where('school_year', $section?->school_year ?? '')
            ->first() ?? new SchoolClass();

        $schoolClass->name = "{$section?->name} - {$subject?->code}";
        $schoolClass->subject = $subject?->name ?? 'Subject';
        $schoolClass->grade_level = $section?->year_level ?? '';
        $schoolClass->section = $section?->name ?? '';
        $schoolClass->school_year = $section?->school_year ?? '';
        $schoolClass->teacher_id = $sectionSubject->teacher_id;
        $schoolClass->room = $sectionSubject->room;
        $schoolClass->schedule = trim(implode(' ', array_filter([
            $sectionSubject->day,
            ($sectionSubject->time_start && $sectionSubject->time_end)
                ? "{$sectionSubject->time_start}-{$sectionSubject->time_end}"
                : null,
        ])));
        $schoolClass->save();

        return $schoolClass;
    }

    private function gradeDeadlineMessage(string $schoolYear, ?string $semester): ?string
    {
        if (!$semester) {
            return null;
        }

        $term = AcademicTerm::where('school_year', $schoolYear)
            ->where('semester', $semester)
            ->first();

        if ($term?->grade_finalization_deadline && now()->gt($term->grade_finalization_deadline)) {
            return 'Grade entry is closed for this term. Finalization deadline was ' . $term->grade_finalization_deadline->toDateTimeString() . '.';
        }

        return null;
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
