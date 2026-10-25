<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AcademicTerm;
use App\Models\ActivityLog;
use App\Models\Course;
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
use App\Services\SectionDepartmentAccess;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
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
            ->when($request->filled('scope'), function ($query) use ($request) {
                $scopeParts = explode('|', (string) $request->query('scope'), 2);
                if (count($scopeParts) !== 2 || !in_array($scopeParts[0], ['college', 'shs'], true)) {
                    return;
                }

                [$programType, $scopeValue] = $scopeParts;
                $scopeColumn = $programType === 'college' ? 'course' : 'strand';
                $query->where('program_type', $programType)
                    ->where(function ($scopeQuery) use ($scopeColumn, $scopeValue, $programType) {
                        if ($scopeValue === '__general__') {
                            $scopeQuery->whereNull($scopeColumn)->orWhere($scopeColumn, '');
                        } else {
                            $scopeQuery->where($scopeColumn, $scopeValue)
                                ->orWhereIn($scopeColumn, Course::query()
                                    ->select('name')
                                    ->where('program_type', $programType)
                                    ->where('acronym', $scopeValue));
                        }
                    });
            })
            ->when(!$request->filled('scope') && $request->course, fn($q) => $q->where(function ($q2) use ($request) {
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
            ->when($request->search, function ($query) use ($request) {
                $search = trim((string) $request->search);
                $matchingCourses = Course::query()
                    ->where(function ($courseQuery) use ($search) {
                        $courseQuery->where('name', 'like', "%{$search}%")
                            ->orWhere('acronym', 'like', "%{$search}%");
                    });

                $query->where(function ($searchQuery) use ($search, $matchingCourses) {
                    $searchQuery->where('name', 'like', "%{$search}%")
                        ->orWhere('code', 'like', "%{$search}%")
                        ->orWhere('course', 'like', "%{$search}%")
                        ->orWhere('strand', 'like', "%{$search}%")
                        ->orWhereIn('course', (clone $matchingCourses)->select('name'))
                        ->orWhereIn('course', (clone $matchingCourses)->select('acronym'));
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
            $prerequisitesBefore = [];
            $subject->prerequisites()->sync($request->prerequisite_ids);
            ActivityLog::recordRelationChange(
                $request,
                $subject,
                'prerequisites',
                $prerequisitesBefore,
                $subject->prerequisites()->allRelatedIds()->all()
            );
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

        $prerequisitesBefore = $subject->prerequisites()->allRelatedIds()->all();
        $subject->update($data);

        if ($request->filled('prerequisite_ids')) {
            $prerequisiteIds = array_filter((array) $request->prerequisite_ids, fn($idValue) => (int) $idValue !== (int) $subject->id);
            $subject->prerequisites()->sync($prerequisiteIds);
            ActivityLog::recordRelationChange(
                $request,
                $subject,
                'prerequisites',
                $prerequisitesBefore,
                $subject->prerequisites()->allRelatedIds()->all()
            );
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
            $subject->sectionSubjects()->get()->each(fn (SectionSubject $sectionSubject) => $sectionSubject->delete());
        }

        $prerequisitesBefore = $subject->prerequisites()->allRelatedIds()->all();
        $requiredByBefore = $subject->requiredBy()->allRelatedIds()->all();
        $subject->prerequisites()->detach();
        $subject->requiredBy()->detach();
        ActivityLog::recordRelationChange($request, $subject, 'prerequisites', $prerequisitesBefore, []);
        ActivityLog::recordRelationChange($request, $subject, 'required_by', $requiredByBefore, []);
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
        $prerequisitesBefore = $subject->prerequisites()->allRelatedIds()->all();
        $subject->prerequisites()->syncWithoutDetaching([$request->prerequisite_id]);
        ActivityLog::recordRelationChange(
            $request,
            $subject,
            'prerequisites',
            $prerequisitesBefore,
            $subject->prerequisites()->allRelatedIds()->all()
        );

        return response()->json($subject->prerequisites()->get(['id', 'code', 'name']), 201);
    }

    // DELETE /api/subjects/{id}/prerequisites/{prerequisiteId}
    public function removeSubjectPrerequisite(Request $request, $id, $prerequisiteId)
    {
        $this->authorizeRegistrar($request);

        $subject = Subject::findOrFail($id);
        $prerequisitesBefore = $subject->prerequisites()->allRelatedIds()->all();
        $subject->prerequisites()->detach($prerequisiteId);
        ActivityLog::recordRelationChange(
            $request,
            $subject,
            'prerequisites',
            $prerequisitesBefore,
            $subject->prerequisites()->allRelatedIds()->all()
        );

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

    // GET /api/registrar/sections — include closed and awaiting-review sections for the registrar portal.
    public function registrarSectionIndex(Request $request)
    {
        $this->authorizeRegistrar($request);
        SectionDepartmentAccess::authorize($request->user());
        $user = $request->user();
        $sections = Section::with([
            'sectionSubjects.subject',
            'sectionSubjects.teacher',
            'sectionSubjects.schedules',
        ])
            ->when(SectionDepartmentAccess::isChair($user), fn ($query) => $query->where('department_id', $user->department_id))
            ->when($request->filled('search'), function ($query) use ($request) {
                $term = '%' . trim($request->search) . '%';
                $query->where(function ($inner) use ($term) {
                    $inner->where('name', 'like', $term)
                        ->orWhere('course', 'like', $term)
                        ->orWhere('strand', 'like', $term)
                        ->orWhere('school_year', 'like', $term);
                });
            })
            ->orderByDesc('school_year')
            ->orderBy('name')
            ->get()
            ->map(function (Section $section) {
                $section->setAttribute('student_count', $section->students()->wherePivot('status', 'enrolled')->count());
                return $section;
            });

        return response()->json($sections);
    }

    // POST /api/sections
    public function sectionStore(Request $request)
    {
        $this->authorizeRegistrar($request);
        $department = SectionDepartmentAccess::authorize($request->user());

        $data = $request->validate([
            'name'         => 'required|string|max:100',
            'course'       => 'nullable|string|max:100',
            'year_level'   => 'nullable|string|max:5',
            'program_type' => 'required|in:shs,college',
            'strand'       => 'nullable|string|max:20',
            'school_year'  => 'required|string|max:20',
            'semester'     => 'required|in:1st,2nd,summer',
            'max_students' => 'nullable|integer|min:1',
            'is_active'    => 'nullable|boolean',
        ]);

        $user = $request->user();
        $isDepartmentChair = SectionDepartmentAccess::isChair($user);
        SectionDepartmentAccess::validateCourse($department, $data);
        $data['created_by'] = $user->id;
        if ($isDepartmentChair) {
            $data['department_id'] = $user->department_id;
            $data['workflow_status'] = 'draft';
            $data['is_active'] = false;
        } else {
            $data['is_active'] = (bool) ($data['is_active'] ?? false);
            $data['workflow_status'] = $data['is_active'] ? 'approved' : 'draft';
        }

        $section = Section::create($data);
        return response()->json($section, 201);
    }

    // GET /api/sections/{id}
    public function sectionShow(Request $request, $id)
    {
        $this->authorizeRegistrar($request);

        $section = Section::with([
            'sectionSubjects.subject',
            'sectionSubjects.teacher',
            'sectionSubjects.schedules',
            'students',
        ])->findOrFail($id);
        SectionDepartmentAccess::authorize($request->user(), $section);

        return response()->json($section);
    }

    public function submitSection(Request $request, $id)
    {
        $this->authorizeSectionWorkflow($request, ['head_department']);
        $section = Section::findOrFail($id);
        SectionDepartmentAccess::authorize($request->user(), $section);
        abort_unless((int) $section->department_id === (int) $request->user()->department_id, 403, 'You can only submit sections from your department.');
        abort_unless(in_array($section->workflow_status, ['draft', 'rejected'], true), 422, 'Only draft or rejected sections can be submitted.');

        $section->update([
            'workflow_status' => 'pending',
            'workflow_remarks' => null,
            'submitted_at' => now(),
            'is_active' => false,
        ]);
        ActivityLog::record($request, 'section_submitted', 'Submitted section ' . $section->name . ' for Registrar review.', ['subject_type' => Section::class, 'subject_id' => $section->id]);

        return response()->json(['message' => 'Section submitted for Registrar review.', 'section' => $section->fresh()]);
    }

    public function reviewSection(Request $request, $id)
    {
        $this->authorizeSectionWorkflow($request, ['admin', 'registrar']);
        $section = Section::findOrFail($id);
        SectionDepartmentAccess::authorize($request->user(), $section);
        abort_unless($section->workflow_status === 'pending', 422, 'Only sections awaiting review can be approved or rejected.');
        $data = $request->validate([
            'decision' => ['required', Rule::in(['approve', 'reject'])],
            'remarks' => ['nullable', 'string', 'max:2000'],
        ]);
        if ($data['decision'] === 'reject' && blank($data['remarks'] ?? null)) {
            return response()->json(['message' => 'Remarks are required when rejecting a section.'], 422);
        }
        if ($data['decision'] === 'approve' && ($conflict = app(\App\Services\SectionScheduleService::class)->approvalConflict($section))) {
            return response()->json(['message' => $conflict], 422);
        }

        $approved = $data['decision'] === 'approve';
        $section->update([
            'workflow_status' => $approved ? 'approved' : 'rejected',
            'workflow_remarks' => $data['remarks'] ?? null,
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
            'is_active' => $approved,
        ]);
        ActivityLog::record($request, 'section_reviewed', ucfirst($data['decision']) . ' section ' . $section->name . '.', ['subject_type' => Section::class, 'subject_id' => $section->id, 'meta' => ['remarks' => $data['remarks'] ?? null]]);

        return response()->json(['message' => $approved ? 'Section approved and opened for enrollment.' : 'Section returned to the Chair.', 'section' => $section->fresh()]);
    }

    public function closeSection(Request $request, $id)
    {
        $this->authorizeSectionWorkflow($request, ['admin', 'registrar']);
        $section = Section::findOrFail($id);
        SectionDepartmentAccess::authorize($request->user(), $section);
        abort_unless($section->workflow_status === 'approved', 422, 'Only approved sections can be closed.');
        $section->update(['workflow_status' => 'closed', 'is_active' => false]);
        ActivityLog::record($request, 'section_closed', 'Closed section ' . $section->name . '.', ['subject_type' => Section::class, 'subject_id' => $section->id]);

        return response()->json(['message' => 'Section closed.', 'section' => $section->fresh()]);
    }

    public function reopenSection(Request $request, $id)
    {
        $this->authorizeSectionWorkflow($request, ['admin', 'registrar']);
        $section = Section::findOrFail($id);
        SectionDepartmentAccess::authorize($request->user(), $section);
        abort_unless(in_array($section->workflow_status, ['closed', 'approved'], true), 422, 'Only approved or closed sections can be reopened.');
        $section->update(['workflow_status' => 'approved', 'is_active' => true, 'workflow_remarks' => null]);
        ActivityLog::record($request, 'section_reopened', 'Reopened section ' . $section->name . '.', ['subject_type' => Section::class, 'subject_id' => $section->id]);

        return response()->json(['message' => 'Section reopened for enrollment.', 'section' => $section->fresh()]);
    }

    // PUT /api/sections/{id}
    public function sectionUpdate(Request $request, $id)
    {
        $this->authorizeRegistrar($request);
        $section = Section::findOrFail($id);
        $department = SectionDepartmentAccess::authorize($request->user(), $section);
        $data = $request->all();
        if ($department) {
            abort_unless(in_array($section->workflow_status, ['draft', 'rejected'], true), 403, 'Only draft or rejected sections can be edited.');
            $data = $request->validate([
                'name' => 'sometimes|required|string|max:100',
                'course' => 'nullable|string|max:100',
                'year_level' => 'nullable|string|max:5',
                'program_type' => 'sometimes|required|in:shs,college',
                'strand' => 'nullable|string|max:20',
                'school_year' => 'sometimes|required|string|max:20',
                'semester' => 'sometimes|required|in:1st,2nd,summer',
                'max_students' => 'sometimes|required|integer|min:1',
            ]);
            SectionDepartmentAccess::validateCourse($department, array_merge($section->toArray(), $data));
            $data['workflow_status'] = 'draft';
            $data['is_active'] = false;
        }
        $section->update($data);
        return response()->json($section);
    }

    // POST /api/sections/{id}/subjects — assign subject to section
    public function assignSubject(Request $request, $id)
    {
        $this->authorizeRegistrar($request);
        SectionDepartmentAccess::authorize($request->user(), Section::findOrFail($id));

        $request->validate([
            'subject_id' => 'required_without:subject_ids|nullable|integer|exists:subjects,id',
            'subject_ids' => 'required_without:subject_id|array|min:1',
            'subject_ids.*' => 'required|integer|distinct|exists:subjects,id',
            'teacher_id' => 'nullable|exists:users,id',
            'day'        => 'nullable|string|max:100',
            'days'       => 'nullable|array',
            'days.*'     => 'string|in:Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday',
            'time_start' => 'nullable|string|max:10',
            'time_end'   => 'nullable|string|max:10',
            'room'       => 'nullable|string|max:50',
            'schedules' => 'nullable|array',
            'schedules.*.day' => 'required|string|max:30',
            'schedules.*.time_start' => 'nullable|string|max:10',
            'schedules.*.time_end' => 'nullable|string|max:10',
            'schedules.*.room' => 'nullable|string|max:50',
        ]);

        $data = $request->only(['teacher_id', 'day', 'time_start', 'time_end', 'room']);
        if ($request->filled('days')) {
            $data['day'] = implode(', ', $request->days);
        }

        $subjectIds = $request->input('subject_ids', [$request->input('subject_id')]);

        $schedules = $request->input('schedules', []);
        $sectionSubjects = DB::transaction(function () use ($id, $subjectIds, $data, $schedules) {
            return collect($subjectIds)->map(function ($subjectId) use ($id, $data) {
                return SectionSubject::updateOrCreate(
                    ['section_id' => $id, 'subject_id' => $subjectId],
                    $data
                )->load('subject', 'teacher');
            });
        });

        if ($request->has('schedules')) {
            $sectionSubjects->each(function (SectionSubject $sectionSubject) use ($schedules, $data) {
                $hasStoredMeetings = $sectionSubject->schedules()->exists();
                $sectionSubject->schedules()->delete();
                $meetingSchedules = [];
                if (!$hasStoredMeetings && !empty($data['day'])) {
                    $meetingSchedules[] = [
                        'day' => $data['day'],
                        'time_start' => $data['time_start'] ?? null,
                        'time_end' => $data['time_end'] ?? null,
                        'room' => $data['room'] ?? null,
                    ];
                }
                $meetingSchedules = array_merge($meetingSchedules, $schedules);
                $meetingSchedules = collect($meetingSchedules)
                    ->filter(fn ($meeting) => !empty($meeting['day']))
                    ->unique(fn ($meeting) => implode('|', [$meeting['day'], $meeting['time_start'] ?? '', $meeting['time_end'] ?? '', $meeting['room'] ?? '']))
                    ->values()
                    ->all();
                if ($meetingSchedules) {
                    $sectionSubject->schedules()->createMany($meetingSchedules);
                }
            });
        }

        return count($subjectIds) === 1
            ? response()->json($sectionSubjects->first(), 201)
            : response()->json($sectionSubjects->values(), 201);
    }

    // DELETE /api/sections/{id}/subjects/{subjectId} — remove subject from section
    public function removeSubject(Request $request, $id, $subjectId)
    {
        $this->authorizeRegistrar($request);
        SectionDepartmentAccess::authorize($request->user(), Section::findOrFail($id));
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
        SectionDepartmentAccess::authorize($request->user(), $section);
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
        SectionDepartmentAccess::authorize($request->user(), $section);
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

        $studentsBefore = $section->students()->get()
            ->mapWithKeys(fn (User $student) => [$student->getKey() => ['status' => $student->pivot->status]])
            ->all();
        $section->students()->syncWithoutDetaching([
            $request->user_id => ['status' => 'enrolled']
        ]);
        ActivityLog::recordRelationChange(
            $request,
            $section,
            'students',
            $studentsBefore,
            $section->students()->get()
                ->mapWithKeys(fn (User $student) => [$student->getKey() => ['status' => $student->pivot->status]])
                ->all()
        );

        Student::where('user_id', $request->user_id)->get()
            ->each(fn (Student $student) => $student->update(['section' => $section->name]));

        return response()->json(['message' => 'Student enrolled in section.']);
    }

    // DELETE /api/sections/{id}/students/{userId} — remove student from section
    public function removeStudent(Request $request, $id, $userId)
    {
        $this->authorizeRegistrar($request);
        $section = Section::findOrFail($id);
        SectionDepartmentAccess::authorize($request->user(), $section);
        $studentsBefore = $section->students()->get()
            ->mapWithKeys(fn (User $student) => [$student->getKey() => ['status' => $student->pivot->status]])
            ->all();
        $section->students()->detach($userId);
        ActivityLog::recordRelationChange(
            $request,
            $section,
            'students',
            $studentsBefore,
            $section->students()->get()
                ->mapWithKeys(fn (User $student) => [$student->getKey() => ['status' => $student->pivot->status]])
                ->all()
        );
        Student::where('user_id', $userId)->get()
            ->each(fn (Student $student) => $student->update(['section' => 'TBA']));
        return response()->json(['message' => 'Student removed from section.']);
    }

    // ── STUDENT VIEW ─────────────────────────────────────────

    // GET /api/my-subjects — student sees their enrolled subjects
    public function mySubjects(Request $request)
    {
        $user = $request->user();
        $activeTerm = AcademicTerm::query()->where('is_active', true)->latest('updated_at')->first();
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
                        $q->with(['subject', 'teacher:id,name', 'schedules'])
                    ])
                    ->get();

        $subjects = $sections->flatMap(fn($section) =>
            $section->sectionSubjects
            ->filter(fn($ss) => ($overrides->get($this->subjectOverrideKey($section->id, $ss->subject->id))?->status ?? 'enrolled') !== 'dropped'
                && ($overrides->get($this->subjectOverrideKey(null, $ss->subject->id))?->status ?? 'enrolled') !== 'dropped')
            ->flatMap(function ($ss) use ($section) {
                $meetings = collect([$ss])
                    ->concat($ss->schedules)
                    ->filter(fn ($meeting) => $meeting->day || $meeting->time_start || $meeting->time_end || $meeting->room)
                    ->unique(fn ($meeting) => implode('|', [
                        strtolower(trim((string) $meeting->day)),
                        trim((string) $meeting->time_start),
                        trim((string) $meeting->time_end),
                        strtolower(trim((string) $meeting->room)),
                    ]));

                if ($meetings->isEmpty()) {
                    $meetings = collect([null]);
                }

                return $meetings->map(fn($schedule) => [
                    'section_id'   => $section->id,
                    'section_name' => $section->name,
                    'school_year'  => $section->school_year,
                    'semester'     => $section->semester,
                    'subject_id'   => $ss->subject->id,
                    'code'         => $ss->subject->code,
                    'name'         => $ss->subject->name,
                    'units_lec'    => $ss->subject->units_lec,
                    'units_lab'    => $ss->subject->units_lab,
                    'day'          => $schedule ? $schedule->day : $ss->day,
                    'time_start'   => $schedule ? $schedule->time_start : $ss->time_start,
                    'time_end'     => $schedule ? $schedule->time_end : $ss->time_end,
                    'room'         => $schedule ? $schedule->room : $ss->room,
                    'teacher'      => $ss->teacher?->name,
                ]);
            })
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
            ->with(['subject', 'section.sectionSubjects.teacher:id,name', 'section.sectionSubjects.schedules'])
            ->get()
            ->reject(fn (StudentSubject $record) => in_array((int) $record->subject_id, $sectionSubjectIds, true))
            ->filter(fn (StudentSubject $record) => $record->status !== 'dropped')
            ->flatMap(function (StudentSubject $record) {
                $offering = $record->section?->sectionSubjects
                    ->first(fn ($sectionSubject) => (int) $sectionSubject->subject_id === (int) $record->subject_id);

                $meetings = $offering
                    ? collect([$offering])
                        ->concat($offering->schedules)
                        ->filter(fn ($meeting) => $meeting->day || $meeting->time_start || $meeting->time_end || $meeting->room)
                        ->unique(fn ($meeting) => implode('|', [
                            strtolower(trim((string) $meeting->day)),
                            trim((string) $meeting->time_start),
                            trim((string) $meeting->time_end),
                            strtolower(trim((string) $meeting->room)),
                        ]))
                    : collect();

                if ($meetings->isEmpty()) {
                    $meetings = collect([null]);
                }

                return $meetings->map(fn ($meeting) => [
                    'section_id'   => $record->section_id,
                    'section_name' => $record->section?->name ?? 'Irregular enrollment',
                    'school_year'  => $record->section?->school_year,
                    'semester'     => $record->section?->semester,
                    'subject_id'   => $record->subject?->id,
                    'code'         => $record->subject?->code,
                    'name'         => $record->subject?->name,
                    'units_lec'    => $record->subject?->units_lec,
                    'units_lab'    => $record->subject?->units_lab,
                    'day'          => $meeting ? $meeting->day : null,
                    'time_start'   => $meeting ? $meeting->time_start : null,
                    'time_end'     => $meeting ? $meeting->time_end : null,
                    'room'         => $meeting ? $meeting->room : null,
                    'teacher'      => $offering?->teacher?->name,
                ]);
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
        if (!$user || (!in_array($user->role, ['registrar', 'admin', 'head_department']) && $user->position !== 'head_department' && !$user->hasAnyRole(['registrar', 'admin', 'head_department']))) {
            abort(403, 'Unauthorized.');
        }
    }

    private function authorizeSectionWorkflow(Request $request, array $roles): void
    {
        $user = $request->user();
        if (!$user || (!in_array($user->role, $roles, true) && !in_array($user->position, $roles, true) && !$user->hasAnyRole($roles))) {
            abort(403, 'Unauthorized.');
        }
    }

    private function subjectOverrideKey(?int $sectionId, ?int $subjectId): string
    {
        return ($sectionId ?? 'direct') . ':' . ($subjectId ?? 'none');
    }
}
