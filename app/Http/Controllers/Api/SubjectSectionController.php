<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AcademicTerm;
use App\Models\EnrollmentApplication;
use App\Models\Fee;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\StudentSubject;
use App\Models\Subject;
use App\Models\Section;
use App\Models\SectionSubject;
use App\Models\User;
use App\Services\ArchiveService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SubjectSectionController extends Controller
{
    // ── SUBJECTS ─────────────────────────────────────────────

    // GET /api/subjects
    public function subjectIndex(Request $request)
    {
        $subjects = Subject::query()
            ->with('prerequisites:id,code,name')
            ->when($request->program_type, fn($q) => $q->where('program_type', $request->program_type))
            ->when($request->course, fn($q) => $q->where(function ($q2) use ($request) {
                $q2->where('course', $request->course)
                   ->orWhereNull('course')
                   ->orWhere('course', '');
            }))
            ->when($request->year_level, fn($q) => $q->where('year_level', $request->year_level))
            ->when($request->strand, fn($q) => $q->where(function ($q2) use ($request) {
                $q2->where('strand', $request->strand)
                   ->orWhereNull('strand')
                   ->orWhere('strand', '');
            }))
            ->when($request->semester, fn($q) => $q->where('semester', $request->semester))
            ->when($request->search, function ($q) use ($request) {
                $search = $request->search;
                $q->where(function ($q2) use ($search) {
                    $q2->where('name', 'like', "%{$search}%")
                        ->orWhere('code', 'like', "%{$search}%");
                });
            })
            ->where('is_active', true)
            ->orderBy('code')
            ->get();

        return response()->json($subjects);
    }

    // POST /api/subjects
    public function subjectStore(Request $request)
    {
        $this->authorizeRegistrar($request);

        $request->validate([
            'code'             => 'required|string|max:20',
            'name'             => 'required|string|max:255',
            'description'      => 'nullable|string',
            'units_lec'        => 'required|numeric|min:0',
            'units_lab'        => 'required|numeric|min:0',
            'program_type'     => 'required|in:shs,college',
            'course'           => 'nullable|string|max:100',
            'year_level'       => 'nullable|string|max:5',
            'strand'           => 'nullable|string|max:20',
            'semester'         => 'nullable|in:1st,2nd,summer',
            'prerequisite_ids' => 'nullable|array',
            'prerequisite_ids.*' => 'distinct|integer|exists:subjects,id',
        ]);

        $data = $request->only([
            'code', 'name', 'description',
            'units_lec', 'units_lab',
            'program_type', 'course', 'year_level', 'strand', 'semester',
            'is_active',
        ]);
        $data['course'] = $data['course'] === '' ? null : $data['course'];
        $data['strand'] = $data['strand'] === '' ? null : $data['strand'];

        $subject = Subject::create($data);

        if ($request->filled('prerequisite_ids')) {
            $subject->prerequisites()->sync($request->prerequisite_ids);
        }

        return response()->json($subject->load('prerequisites:id,code,name'), 201);
    }

    // PUT /api/subjects/{id}
    public function subjectUpdate(Request $request, $id)
    {
        $this->authorizeRegistrar($request);
        $subject = Subject::findOrFail($id);

        $request->validate([
            'code'             => 'nullable|string|max:20',
            'name'             => 'nullable|string|max:255',
            'description'      => 'nullable|string',
            'units_lec'        => 'nullable|numeric|min:0',
            'units_lab'        => 'nullable|numeric|min:0',
            'program_type'     => 'nullable|in:shs,college',
            'course'           => 'nullable|string|max:100',
            'year_level'       => 'nullable|string|max:5',
            'strand'           => 'nullable|string|max:20',
            'semester'         => 'nullable|in:1st,2nd,summer',
            'prerequisite_ids' => 'nullable|array',
            'prerequisite_ids.*' => 'distinct|integer|exists:subjects,id',
        ]);

        $data = $request->only([
            'code', 'name', 'description',
            'units_lec', 'units_lab',
            'program_type', 'course', 'year_level', 'strand', 'semester',
            'is_active',
        ]);
        $data['course'] = $data['course'] === '' ? null : $data['course'];
        $data['strand'] = $data['strand'] === '' ? null : $data['strand'];

        $subject->update($data);

        if ($request->filled('prerequisite_ids')) {
            $prerequisiteIds = array_filter((array) $request->prerequisite_ids, fn($idValue) => (int) $idValue !== (int) $subject->id);
            $subject->prerequisites()->sync($prerequisiteIds);
        }

        return response()->json($subject->load('prerequisites:id,code,name'));
    }

    // DELETE /api/subjects/{id}
    public function subjectDestroy(Request $request, $id)
    {
        $this->authorizeRegistrar($request);
        $subject = Subject::findOrFail($id);
        ArchiveService::record($subject, $request->user()?->id, 'api.subjects');

        if ($subject->sectionSubjects()->exists()) {
            $subject->sectionSubjects()->delete();
        }

        $subject->prerequisites()->detach();
        $subject->requiredBy()->detach();
        $subject->delete();

        return response()->json(['message' => 'Subject removed.']);
    }

    // GET /api/subjects/{id}/prerequisites
    public function subjectPrerequisites(Request $request, $id)
    {
        $this->authorizeRegistrar($request);
        $subject = Subject::with('prerequisites:id,code,name')->findOrFail($id);
        return response()->json($subject->prerequisites);
    }

    // POST /api/subjects/{id}/prerequisites
    public function addSubjectPrerequisite(Request $request, $id)
    {
        $this->authorizeRegistrar($request);

        $request->validate([
            'prerequisite_id' => ['required', 'integer', 'exists:subjects,id'],
        ]);

        if ($request->prerequisite_id == $id) {
            return response()->json(['message' => 'A subject cannot be its own prerequisite.'], 422);
        }

        $subject = Subject::findOrFail($id);
        $subject->prerequisites()->syncWithoutDetaching([$request->prerequisite_id]);

        return response()->json($subject->prerequisites()->get(['id', 'code', 'name']), 201);
    }

    // DELETE /api/subjects/{id}/prerequisites/{prerequisiteId}
    public function removeSubjectPrerequisite(Request $request, $id, $prerequisiteId)
    {
        $this->authorizeRegistrar($request);

        $subject = Subject::findOrFail($id);
        $subject->prerequisites()->detach($prerequisiteId);

        return response()->json(['message' => 'Prerequisite removed.']);
    }

    // ── SECTIONS ─────────────────────────────────────────────

    // GET /api/registrar/teachers
    public function teacherIndex(Request $request)
    {
        $this->authorizeRegistrar($request);

        $teachers = User::query()
            ->whereIn('role', User::FACULTY_ROLES)
            ->orWhereHas('roles', fn($roleQuery) => $roleQuery->whereIn('name', User::FACULTY_ROLES))
            ->orderBy('name')
            ->get(['id', 'name', 'email']);

        return response()->json($teachers);
    }

    // GET /api/registrar/section-students
    public function studentIndex(Request $request)
    {
        $this->authorizeRegistrar($request);

        $students = Student::query()
            ->with('user:id,name,email')
            ->where('status', 'active')
            ->when($request->grade_level, fn($q) => $q->where('grade_level', $request->grade_level))
            ->when($request->school_year, fn($q) => $q->where('school_year', $request->school_year))
            ->when($request->program_type || $request->course || $request->strand, function ($q) use ($request) {
                $approvedUserIds = EnrollmentApplication::query()
                    ->where('status', 'approved')
                    ->pluck('user_id')
                    ->filter()
                    ->unique()
                    ->values();

                $matchingUserIds = EnrollmentApplication::query()
                    ->where('status', 'approved')
                    ->when($request->program_type, fn($appQuery) => $appQuery->where('program_type', $request->program_type))
                    ->when($request->program_type === 'college' && $request->grade_level, fn($appQuery) => $appQuery->where('year_level', $request->grade_level))
                    ->when($request->program_type === 'shs' && $request->grade_level, fn($appQuery) => $appQuery->where('grade_level', $request->grade_level))
                    ->when($request->course, function ($appQuery) use ($request) {
                        $appQuery->where(function ($courseQuery) use ($request) {
                            $courseQuery->where('course', $request->course)
                                ->orWhere('course', 'like', "%{$request->course}%");
                        });
                    })
                    ->when($request->strand, fn($appQuery) => $appQuery->where('strand', $request->strand))
                    ->pluck('user_id')
                    ->filter()
                    ->unique()
                    ->values();

                if ($matchingUserIds->isNotEmpty()) {
                    $q->where(function ($studentQuery) use ($matchingUserIds, $approvedUserIds) {
                        $studentQuery->whereIn('user_id', $matchingUserIds)
                            ->orWhereNotIn('user_id', $approvedUserIds);
                    });
                }
            })
            ->when($request->search, function ($q) use ($request) {
                $search = $request->search;
                $q->where(function ($q2) use ($search) {
                    $q2->where('student_id', 'like', "%{$search}%")
                        ->orWhere('first_name', 'like', "%{$search}%")
                        ->orWhere('last_name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%");
                });
            })
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->get()
            ->map(fn($student) => [
                'id'           => $student->id,
                'user_id'      => $student->user_id,
                'student_id'   => $student->student_id,
                'name'         => trim("{$student->first_name} {$student->last_name}") ?: $student->user?->name,
                'email'        => $student->email ?: $student->user?->email,
                'grade_level'  => $student->grade_level,
                'section'      => $student->section,
                'school_year'  => $student->school_year,
            ]);

        return response()->json($students);
    }

    // GET /api/sections
    public function sectionIndex(Request $request)
    {
        $sections = Section::with(['sectionSubjects.subject', 'sectionSubjects.teacher'])
            ->when($request->school_year, fn($q) => $q->where('school_year', $request->school_year))
            ->when($request->semester,    fn($q) => $q->where('semester', $request->semester))
            ->when($request->course,      fn($q) => $q->where('course', $request->course))
            ->where('is_active', true)
            ->orderBy('name')
            ->get()
            ->map(function ($section) {
                return array_merge($section->toArray(), [
                    'student_count' => $section->students()->wherePivot('status', 'enrolled')->count(),
                ]);
            });

        return response()->json($sections);
    }

    // POST /api/sections
    public function sectionStore(Request $request)
    {
        $this->authorizeRegistrar($request);

        $request->validate([
            'name'         => 'required|string|max:100',
            'course'       => 'nullable|string|max:100',
            'year_level'   => 'nullable|string|max:5',
            'program_type' => 'required|in:shs,college',
            'strand'       => 'nullable|string|max:20',
            'school_year'  => 'required|string|max:20',
            'semester'     => 'required|in:1st,2nd,summer',
            'max_students' => 'nullable|integer|min:1',
        ]);

        $section = Section::create($request->all());
        return response()->json($section, 201);
    }

    // GET /api/sections/{id}
    public function sectionShow(Request $request, $id)
    {
        $section = Section::with([
            'sectionSubjects.subject',
            'sectionSubjects.teacher',
            'students',
        ])->findOrFail($id);

        return response()->json($section);
    }

    // PUT /api/sections/{id}
    public function sectionUpdate(Request $request, $id)
    {
        $this->authorizeRegistrar($request);
        $section = Section::findOrFail($id);
        $section->update($request->all());
        return response()->json($section);
    }

    // POST /api/sections/{id}/subjects — assign subject to section
    public function assignSubject(Request $request, $id)
    {
        $this->authorizeRegistrar($request);

        $request->validate([
            'subject_id' => 'required|exists:subjects,id',
            'teacher_id' => 'nullable|exists:users,id',
            'day'        => 'nullable|string|max:100',
            'days'       => 'nullable|array',
            'days.*'     => 'string|in:Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday',
            'time_start' => 'nullable|string|max:10',
            'time_end'   => 'nullable|string|max:10',
            'room'       => 'nullable|string|max:50',
        ]);

        $data = $request->only(['teacher_id', 'day', 'time_start', 'time_end', 'room']);
        if ($request->filled('days')) {
            $data['day'] = implode(', ', $request->days);
        }

        $sectionSubject = SectionSubject::updateOrCreate(
            ['section_id' => $id, 'subject_id' => $request->subject_id],
            $data
        );

        return response()->json($sectionSubject->load('subject', 'teacher'), 201);
    }

    // DELETE /api/sections/{id}/subjects/{subjectId} — remove subject from section
    public function removeSubject(Request $request, $id, $subjectId)
    {
        $this->authorizeRegistrar($request);
        SectionSubject::where('section_id', $id)
            ->where('subject_id', $subjectId)
            ->get()
            ->each(function (SectionSubject $sectionSubject) use ($request) {
                ArchiveService::record($sectionSubject, $request->user()?->id, 'api.sections.subjects');
                $sectionSubject->delete();
            });
        return response()->json(['message' => 'Subject removed from section.']);
    }

    public function sectionDestroy(Request $request, $id)
    {
        $this->authorizeRegistrar($request);

        $section = Section::findOrFail($id);
        ArchiveService::record($section, $request->user()?->id, 'api.sections');
        $section->delete();

        return response()->json(['message' => 'Section archived and removed.']);
    }

    // POST /api/sections/{id}/students — enroll student in section
    public function enrollStudent(Request $request, $id)
    {
        $this->authorizeRegistrar($request);

        $request->validate([
            'user_id' => 'required|exists:users,id',
        ]);

        $section = Section::findOrFail($id);
        if ($section->students()->wherePivot('status', 'enrolled')->count() >= $section->max_students) {
            return response()->json(['message' => 'This section has reached its maximum students.'], 422);
        }

        $studentUser = User::findOrFail($request->user_id);
        if ($studentUser->role !== 'student' && !$studentUser->hasRole('student')) {
            return response()->json(['message' => 'Only student accounts can be enrolled in a section.'], 422);
        }

        $subjectIds = $section->sectionSubjects()->pluck('subject_id')->toArray();

        if (!empty($subjectIds)) {
            $requiredPrereqIds = Subject::whereIn('id', $subjectIds)
                ->with('prerequisites:id')
                ->get()
                ->flatMap(fn($subject) => $subject->prerequisites->pluck('id'))
                ->unique()
                ->values()
                ->all();

            if (!empty($requiredPrereqIds)) {
                $completedSubjectIds = SectionSubject::query()
                    ->whereHas('section', fn($q) =>
                        $q->whereHas('students', fn($q2) =>
                            $q2->where('user_id', $request->user_id)
                               ->where('status', 'completed')
                        )
                    )
                    ->pluck('subject_id')
                    ->unique()
                    ->toArray();

                $missing = array_diff($requiredPrereqIds, $completedSubjectIds);
                if (!empty($missing)) {
                    $missingSubjects = Subject::whereIn('id', $missing)
                        ->orderBy('code')
                        ->get(['id', 'code', 'name']);

                    return response()->json([
                        'message' => 'Student cannot enroll because prerequisite subjects are not completed.',
                        'missing_prerequisites' => $missingSubjects,
                    ], 422);
                }
            }
        }

        $section->students()->syncWithoutDetaching([
            $request->user_id => ['status' => 'enrolled']
        ]);

        Student::where('user_id', $request->user_id)->update(['section' => $section->name]);

        return response()->json(['message' => 'Student enrolled in section.']);
    }

    // DELETE /api/sections/{id}/students/{userId} — remove student from section
    public function removeStudent(Request $request, $id, $userId)
    {
        $this->authorizeRegistrar($request);
        $section = Section::findOrFail($id);
        $section->students()->detach($userId);
        Student::where('user_id', $userId)->update(['section' => 'TBA']);
        return response()->json(['message' => 'Student removed from section.']);
    }

    // ── STUDENT VIEW ─────────────────────────────────────────

    // GET /api/my-subjects — student sees their enrolled subjects
    public function mySubjects(Request $request)
    {
        $user = $request->user();
        $activeTerm = AcademicTerm::query()->latest('updated_at')->first();
        $view = $request->query('view') === 'past' ? 'past' : 'current';
        $overrides = StudentSubject::query()
            ->where('user_id', $user->id)
            ->get()
            ->keyBy(fn (StudentSubject $record) => $this->subjectOverrideKey($record->section_id, $record->subject_id));
        $droppedSubjectIds = StudentSubject::query()
            ->where('user_id', $user->id)
            ->where('status', 'dropped')
            ->pluck('subject_id')
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        $sections = Section::query()
                    ->whereHas('students', fn($q) => $q
                        ->where('user_id', $user->id)
                        ->whereIn('section_students.status', $view === 'past' ? ['enrolled', 'completed'] : ['enrolled'])
                    )
                    ->when($activeTerm, fn ($query) => $query->where(function ($termQuery) use ($activeTerm, $view) {
                        if ($view === 'past') {
                            $termQuery->where('school_year', '!=', $activeTerm->school_year)
                                ->orWhere('semester', '!=', $activeTerm->semester);
                        } else {
                            $termQuery->where('school_year', $activeTerm->school_year)
                                ->where('semester', $activeTerm->semester);
                        }
                    }))
                    ->when(!$activeTerm && $view === 'current', fn ($query) => $query->whereRaw('1 = 0'))
                    ->with(['sectionSubjects' => fn($q) =>
                        $q->with(['subject', 'teacher:id,name'])
                    ])
                    ->get();

        $subjects = $sections->flatMap(fn($section) =>
            $section->sectionSubjects
            ->filter(fn($ss) => ($overrides->get($this->subjectOverrideKey($section->id, $ss->subject->id))?->status ?? 'enrolled') !== 'dropped'
                && ($overrides->get($this->subjectOverrideKey(null, $ss->subject->id))?->status ?? 'enrolled') !== 'dropped')
            ->map(fn($ss) => [
                'section_id'   => $section->id,
                'section_name' => $section->name,
                'school_year'  => $section->school_year,
                'semester'     => $section->semester,
                'subject_id'   => $ss->subject->id,
                'code'         => $ss->subject->code,
                'name'         => $ss->subject->name,
                'units_lec'    => $ss->subject->units_lec,
                'units_lab'    => $ss->subject->units_lab,
                'day'          => $ss->day,
                'time_start'   => $ss->time_start,
                'time_end'     => $ss->time_end,
                'room'         => $ss->room,
                'teacher'      => $ss->teacher?->name,
            ])
        );

        $sectionSubjectIds = $subjects->pluck('subject_id')->unique()->all();
        $directSectionSubjects = StudentSubject::query()
            ->where('user_id', $user->id)
            ->whereNotNull('section_id')
            ->whereIn('status', $view === 'past' ? ['enrolled', 'completed'] : ['enrolled'])
            ->whereHas('section', fn ($query) => $query
                ->when($activeTerm, fn ($termQuery) => $termQuery->where(function ($semesterQuery) use ($activeTerm, $view) {
                    if ($view === 'past') {
                        $semesterQuery->where('school_year', '!=', $activeTerm->school_year)
                            ->orWhere('semester', '!=', $activeTerm->semester);
                    } else {
                        $semesterQuery->where('school_year', $activeTerm->school_year)
                            ->where('semester', $activeTerm->semester);
                    }
                }))
                ->when(!$activeTerm && $view === 'current', fn ($termQuery) => $termQuery->whereRaw('1 = 0')))
            ->with(['subject', 'section.sectionSubjects.teacher:id,name'])
            ->get()
            ->reject(fn (StudentSubject $record) => in_array((int) $record->subject_id, $sectionSubjectIds, true))
            ->filter(fn (StudentSubject $record) => $record->status !== 'dropped')
            ->map(function (StudentSubject $record) {
                $offering = $record->section?->sectionSubjects
                    ->first(fn ($sectionSubject) => (int) $sectionSubject->subject_id === (int) $record->subject_id);

                return [
                    'section_id'   => $record->section_id,
                    'section_name' => $record->section?->name ?? 'Irregular enrollment',
                    'school_year'  => $record->section?->school_year,
                    'semester'     => $record->section?->semester,
                    'subject_id'   => $record->subject?->id,
                    'code'         => $record->subject?->code,
                    'name'         => $record->subject?->name,
                    'units_lec'    => $record->subject?->units_lec,
                    'units_lab'    => $record->subject?->units_lab,
                    'day'          => $offering?->day,
                    'time_start'   => $offering?->time_start,
                    'time_end'     => $offering?->time_end,
                    'room'         => $offering?->room,
                    'teacher'      => $offering?->teacher?->name,
                ];
            });

        if ($directSectionSubjects->isNotEmpty()) {
            $subjects = $subjects->concat($directSectionSubjects);
            $sectionSubjectIds = $subjects->pluck('subject_id')->unique()->all();
        }

        $applications = EnrollmentApplication::query()
            ->where('user_id', $user->id)
            ->where('status', 'approved')
            ->when($activeTerm, fn ($query) => $query->where(function ($termQuery) use ($activeTerm, $view) {
                if ($view === 'past') {
                    $termQuery->where('school_year', '!=', $activeTerm->school_year)
                        ->orWhere('semester', '!=', $activeTerm->semester);
                } else {
                    $termQuery->where('school_year', $activeTerm->school_year)
                        ->where('semester', $activeTerm->semester);
                }
            }))
            ->when(!$activeTerm && $view === 'current', fn ($query) => $query->whereRaw('1 = 0'))
            ->get(['subject_ids', 'school_year', 'semester']);

        $selectedSubjectEntries = $applications
            ->flatMap(fn (EnrollmentApplication $application) => collect($application->subject_ids ?? [])
                ->map(fn ($id) => [
                    'subject_id' => (int) $id,
                    'school_year' => $application->school_year,
                    'semester' => $application->semester,
                ]))
            ->reject(fn (array $entry) => in_array($entry['subject_id'], $sectionSubjectIds, true)
                || $droppedSubjectIds->contains($entry['subject_id'])
                || ($overrides->get($this->subjectOverrideKey(null, $entry['subject_id']))?->status ?? 'enrolled') === 'dropped')
            ->unique(fn (array $entry) => $entry['subject_id'] . ':' . $entry['school_year'] . ':' . $entry['semester'])
            ->values();

        if ($selectedSubjectEntries->isNotEmpty()) {
            $directSubjectsById = Subject::query()
                ->whereIn('id', $selectedSubjectEntries->pluck('subject_id')->unique())
                ->get()
                ->keyBy('id');
            $directSubjects = $selectedSubjectEntries
                ->map(function (array $entry) use ($directSubjectsById) {
                    $subject = $directSubjectsById->get($entry['subject_id']);
                    if (!$subject) {
                        return null;
                    }

                    return [
                        'section_id'   => null,
                        'section_name' => 'Direct enrollment',
                        'school_year'  => $entry['school_year'],
                        'semester'     => $entry['semester'],
                        'subject_id'   => $subject->id,
                        'code'         => $subject->code,
                        'name'         => $subject->name,
                        'units_lec'    => $subject->units_lec,
                        'units_lab'    => $subject->units_lab,
                        'day'          => null,
                        'time_start'   => null,
                        'time_end'     => null,
                        'room'         => null,
                        'teacher'      => null,
                    ];
                })
                ->filter();

            $subjects = $subjects->concat($directSubjects);
        }

        $student = Student::where('user_id', $user->id)->first();

        $hasCurrentLegacySection = $activeTerm && $student?->section
            ? Section::query()
                ->where('name', $student->section)
                ->where('school_year', $activeTerm->school_year)
                ->where('semester', $activeTerm->semester)
                ->exists()
            : false;

        if ($view === 'current' && $hasCurrentLegacySection && $subjects->isEmpty() && $student && $student->section !== 'TBA') {
            $legacyClasses = SchoolClass::query()
                ->where('grade_level', $student->grade_level)
                ->where('section', $student->section)
                ->where('school_year', $student->school_year)
                ->with('teacher:id,name')
                ->orderBy('subject')
                ->get();

            $subjects = $legacyClasses->map(fn($class) => [
                'section_id'   => null,
                'section_name' => $class->section,
                'subject_id'   => null,
                'code'         => $class->subject,
                'name'         => $class->subject,
                'units_lec'    => 0,
                'units_lab'    => 0,
                'day'          => null,
                'time_start'   => $class->schedule,
                'time_end'     => null,
                'room'         => $class->room,
                'teacher'      => $class->teacher?->name,
            ]);

            if ($legacyClasses->isNotEmpty()) {
                $sections = collect([(object) ['id' => null, 'name' => $student->section]]);
            }
        }

        $fees = $student
            ? Fee::where('student_id', $student->id)->orderBy('due_date')->get()
            : collect();

        return response()->json([
            'view' => $view,
            'active_term' => $activeTerm,
            'sections' => $sections->map(fn($s) => [
                'id' => $s->id,
                'name' => $s->name,
                'school_year' => $s->school_year,
                'semester' => $s->semester,
            ]),
            'subjects' => $subjects->values(),
            'fees' => $fees->values(),
            'fee_summary' => [
                'total' => (float) $fees->sum('amount'),
                'paid' => (float) $fees->sum('paid_amount'),
                'balance' => (float) $fees->sum(fn (Fee $fee) => max(0, $fee->amount - $fee->paid_amount)),
            ],
        ]);
    }

    // ── TEACHER VIEW ─────────────────────────────────────────

    // GET /api/my-classes — teacher sees their assigned sections & subjects
    public function myClasses(Request $request)
    {
        $user = $request->user();

        $sectionSubjects = SectionSubject::where('teacher_id', $user->id)
            ->with(['section', 'subject'])
            ->get()
            ->groupBy('section_id')
            ->map(fn($items) => [
                'section'  => $items->first()->section,
                'subjects' => $items->map(fn($ss) => [
                    'section_subject_id' => $ss->id,
                    'subject_id'         => $ss->subject->id,
                    'code'               => $ss->subject->code,
                    'name'               => $ss->subject->name,
                    'units_lec'          => $ss->subject->units_lec,
                    'units_lab'          => $ss->subject->units_lab,
                    'day'                => $ss->day,
                    'time_start'         => $ss->time_start,
                    'time_end'           => $ss->time_end,
                    'room'               => $ss->room,
                ]),
            ])->values();

        return response()->json($sectionSubjects);
    }

    // ── Helper ───────────────────────────────────────────────
    private function authorizeRegistrar(Request $request)
    {
        $user = $request->user();
        if (!$user || (!in_array($user->role, ['registrar', 'admin']) && !$user->hasAnyRole(['registrar', 'admin']))) {
            abort(403, 'Unauthorized.');
        }
    }

    private function subjectOverrideKey(?int $sectionId, ?int $subjectId): string
    {
        return ($sectionId ?? 'direct') . ':' . ($subjectId ?? 'none');
    }
}
