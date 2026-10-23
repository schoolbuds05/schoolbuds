<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Student;
use App\Models\EnrollmentApplication;
use App\Models\Grade;
use App\Models\Attendance;
use App\Models\Fee;
use App\Models\AcademicTerm;
use App\Models\StudentSubject;
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
                'reward_summary' => $points->emptySummary(),
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

        // Keep the dashboard's next-class card in sync with the student's
        // Class Schedule screen. Only sections in the active academic term
        // and the student's currently enrolled sections are included.
        $activeTerm = AcademicTerm::query()
            ->where('is_active', true)
            ->latest('updated_at')
            ->first();
        $schedule = collect();

        if ($activeTerm) {
            $activeOfferings = fn () => DB::table('section_students')
                ->join('sections', 'sections.id', '=', 'section_students.section_id')
                ->join('section_subjects', 'section_subjects.section_id', '=', 'sections.id')
                ->join('subjects', 'subjects.id', '=', 'section_subjects.subject_id')
                ->leftJoin('users as teachers', 'teachers.id', '=', 'section_subjects.teacher_id')
                ->where('section_students.user_id', $user->id)
                ->where('section_students.status', 'enrolled')
                ->where('sections.school_year', $activeTerm->school_year)
                ->where('sections.semester', $activeTerm->semester)
                ->where('sections.is_active', true);

            $schedule = $activeOfferings()
                ->distinct()
                ->get([
                    'sections.id as section_id',
                    'sections.name as section_name',
                    'section_subjects.id as section_subject_id',
                    'subjects.id as subject_id',
                    'subjects.code',
                    'subjects.name as subject_name',
                    'subjects.units_lec',
                    'subjects.units_lab',
                    'section_subjects.day',
                    'section_subjects.time_start',
                    'section_subjects.time_end',
                    'section_subjects.room',
                    'teachers.name as teacher_name',
                ])
                ->map(fn ($item) => (array) $item);

            $additionalMeetings = $activeOfferings()
                ->join('section_subject_schedules as schedules', 'schedules.section_subject_id', '=', 'section_subjects.id')
                ->orderBy('schedules.time_start')
                ->get([
                    'sections.id as section_id',
                    'sections.name as section_name',
                    'section_subjects.id as section_subject_id',
                    'subjects.id as subject_id',
                    'subjects.code',
                    'subjects.name as subject_name',
                    'subjects.units_lec',
                    'subjects.units_lab',
                    'schedules.day',
                    'schedules.time_start',
                    'schedules.time_end',
                    'schedules.room',
                    'teachers.name as teacher_name',
                ])
                ->map(fn ($item) => (array) $item);

            $schedule = $schedule->concat($additionalMeetings)->values();

            $subjectOverrides = StudentSubject::query()
                ->where('user_id', $user->id)
                ->get(['section_id', 'subject_id', 'status']);
            $isDropped = fn (int $sectionId, int $subjectId) => $subjectOverrides->contains(fn (StudentSubject $record) =>
                (int) $record->subject_id === $subjectId
                && $record->status === 'dropped'
                && ($record->section_id === null || (int) $record->section_id === $sectionId)
            );

            $schedule = $schedule
                ->reject(fn (array $item) => $isDropped((int) $item['section_id'], (int) $item['subject_id']))
                ->values();
            $scheduledOfferings = $schedule
                ->map(fn (array $item) => $item['section_id'] . ':' . $item['subject_id'])
                ->unique()
                ->all();

            // Add individually enrolled offerings that do not appear through section membership.
            $individualEnrollments = StudentSubject::query()
                ->where('user_id', $user->id)
                ->where('status', 'enrolled')
                ->whereNotNull('section_id')
                ->whereHas('section', fn ($query) => $query
                    ->where('school_year', $activeTerm->school_year)
                    ->where('semester', $activeTerm->semester)
                    ->where('is_active', true))
                ->with(['subject', 'section.sectionSubjects.teacher:id,name', 'section.sectionSubjects.schedules'])
                ->get();

            foreach ($individualEnrollments as $enrollment) {
                $section = $enrollment->section;
                $subject = $enrollment->subject;
                if (!$section || !$subject || $isDropped((int) $section->id, (int) $subject->id)) {
                    continue;
                }

                $offeringKey = $section->id . ':' . $subject->id;
                if (in_array($offeringKey, $scheduledOfferings, true)) {
                    continue;
                }

                $offering = $section->sectionSubjects->first(fn ($item) => (int) $item->subject_id === (int) $subject->id);
                if (!$offering) {
                    continue;
                }

                $meetings = collect([$offering])
                    ->concat($offering->schedules)
                    ->unique(fn ($meeting) => implode('|', [
                        strtolower(trim((string) $meeting->day)),
                        trim((string) $meeting->time_start),
                        trim((string) $meeting->time_end),
                        strtolower(trim((string) $meeting->room)),
                    ]));
                foreach ($meetings as $meeting) {
                    $schedule->push([
                        'section_id' => $section->id,
                        'section_name' => $section->name,
                        'subject_id' => $subject->id,
                        'code' => $subject->code,
                        'subject_name' => $subject->name,
                        'units_lec' => $subject->units_lec,
                        'units_lab' => $subject->units_lab,
                        'day' => $meeting->day,
                        'time_start' => $meeting->time_start,
                        'time_end' => $meeting->time_end,
                        'room' => $meeting->room,
                        'teacher_name' => $offering->teacher?->name,
                    ]);
                }
                $scheduledOfferings[] = $offeringKey;
            }

            $schedule = $schedule->unique(fn (array $item) => implode('|', [
                $item['section_id'] ?? '',
                $item['subject_id'] ?? '',
                $item['day'] ?? '',
                $item['time_start'] ?? '',
                $item['time_end'] ?? '',
                $item['room'] ?? '',
            ]))->values();
        }

        $schoolNow = now('Asia/Manila');
        $today = $schoolNow->format('D');
        $todayClasses = $schedule->filter(fn (array $item) => $this->scheduleIncludesDay($item['day'] ?? null, $today))->values();
        $unitsTotal = $schedule->unique('subject_id')->sum(fn (array $item) => (float) ($item['units_lec'] ?? 0) + (float) ($item['units_lab'] ?? 0));
        $currentMinutes = $schoolNow->hour * 60 + $schoolNow->minute;
        $currentClass = $todayClasses->first(function (array $item) use ($currentMinutes) {
            $start = $this->scheduleTimeMinutes($item['time_start'] ?? null);
            $end = $this->scheduleTimeMinutes($item['time_end'] ?? null);
            return $start !== null && $end !== null && $start <= $currentMinutes && $currentMinutes < $end;
        });
        $nextClass = $todayClasses->first(fn (array $item) => ($this->scheduleTimeMinutes($item['time_start'] ?? null) ?? -1) > $currentMinutes);

        return response()->json([
            'student'        => $student,
            'user'           => $user,
            'enrollment_application' => $latestApplication,
            'grades'         => $grades,
            'attendance_pct' => $attendancePct,
            'pending_fees'   => $fees,
            'reward_summary' => $points->summaryFor($student, $student->school_year),
            'units_total'    => $unitsTotal,
            'schedule'       => $schedule,
            'today_classes'  => $todayClasses,
            'current_class'  => $currentClass,
            'next_class'     => $nextClass,
        ]);
    }

    private function scheduleIncludesDay(?string $value, string $today): bool
    {
        if (!$value) {
            return false;
        }

        $day = strtoupper(trim($value));
        $today = strtoupper(substr($today, 0, 3));
        $aliases = [
            'SUN' => ['SUN', 'SUNDAY'],
            'MON' => ['MON', 'MONDAY'],
            'TUE' => ['TUE', 'TUES', 'TUESDAY'],
            'WED' => ['WED', 'WEDNESDAY'],
            'THU' => ['THU', 'THUR', 'THURS', 'THURSDAY'],
            'FRI' => ['FRI', 'FRIDAY'],
            'SAT' => ['SAT', 'SATURDAY'],
        ];

        foreach (preg_split('/[\\s,\\/;&-]+/', $day, -1, PREG_SPLIT_NO_EMPTY) as $token) {
            foreach ($aliases[$today] ?? [] as $alias) {
                if ($token === $alias) {
                    return true;
                }
            }

            $compactDays = [
                'M' => 'MON',
                'T' => 'TUE',
                'W' => 'WED',
                'R' => 'THU',
                'F' => 'FRI',
                'S' => 'SAT',
                'U' => 'SUN',
            ];
            if ($token === 'TTH' || $token === 'TR' || $token === 'TUTH' || $token === 'TUETH') {
                if (in_array($today, ['TUE', 'THU'], true)) {
                    return true;
                }
            } elseif (preg_match('/^[MTWRFSU]+$/', $token)) {
                foreach (str_split($token) as $letter) {
                    if (($compactDays[$letter] ?? null) === $today) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    private function scheduleTimeMinutes(?string $value): ?int
    {
        if (!$value || !preg_match('/^(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?\s*(am|pm)?$/i', trim($value), $match)) {
            return null;
        }

        $hour = (int) $match[1];
        $minute = (int) ($match[2] ?? 0);
        $second = (int) ($match[3] ?? 0);
        $suffix = strtolower($match[4] ?? '');
        if ($minute > 59 || $second > 59) {
            return null;
        }
        if ($suffix !== '') {
            if ($hour < 1 || $hour > 12) {
                return null;
            }
            if ($suffix === 'pm' && $hour < 12) $hour += 12;
            if ($suffix === 'am' && $hour === 12) $hour = 0;
        } elseif ($hour > 23) {
            return null;
        }

        return $hour * 60 + $minute;
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
