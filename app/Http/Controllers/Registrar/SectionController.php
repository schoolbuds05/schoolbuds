<?php

namespace App\Http\Controllers\Registrar;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Web\Concerns\AuthorizesPortal;
use App\Models\ActivityLog;
use App\Models\Course;
use App\Models\Section;
use App\Models\SectionEditRequest;
use App\Models\SectionTransferRequest;
use App\Models\SectionSubject;
use App\Models\Student;
use App\Models\Subject;
use App\Models\User;
use App\Services\ArchiveService;
use App\Services\SectionEditAccess;
use App\Services\SectionDepartmentAccess;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SectionController extends Controller
{
    use AuthorizesPortal;

    public function index(Request $request)
    {
        $this->requireAnyRole($request, ['admin', 'registrar', 'head_department']);
        SectionDepartmentAccess::authorize($request->user());

        $user = $request->user();
        $sections = Section::query()
            ->with([
                'editRequests.requester',
                'transferRequests' => fn ($query) => $query->whereIn('status', ['pending', 'rejected'])->with('student'),
                'sectionSubjects.subject',
                'sectionSubjects.teacher',
                'sectionSubjects.schedules',
                'students' => fn ($query) => $query
                    ->wherePivot('status', 'enrolled')
                    ->orderBy('name')
                    ->select('users.id', 'users.name', 'users.email'),
            ])
            ->when($request->program_type, fn ($query) => $query->where('program_type', $request->program_type))
            ->when($request->filled('course'), fn ($query) => $query->where('course', $request->course))
            ->when($request->filled('semester'), fn ($query) => $query->where('semester', $request->semester))
            ->when($request->filled('school_year'), fn ($query) => $query->where('school_year', $request->school_year))
            ->when($request->has('is_active'), fn ($query) => $query->where('is_active', (bool) $request->boolean('is_active')))
            ->when(SectionDepartmentAccess::isChair($user), fn ($query) => $query->where('department_id', $user->department_id))
            ->when($request->search, function ($query) use ($request) {
                $term = "%{$request->search}%";
                $query->where(function ($innerQuery) use ($term, $request) {
                    $innerQuery->where('name', 'like', $term)
                        ->orWhere('course', 'like', $term)
                        ->orWhere('strand', 'like', $term)
                        ->orWhere('school_year', 'like', $term);
                });
            })
            ->orderByDesc('school_year')
            ->orderBy('name')
            ->paginate(15)
            ->withQueryString();
        $transferTargets = Section::query()
            ->where('workflow_status', 'approved')
            ->where('is_active', true)
            ->when(SectionDepartmentAccess::isChair($user), fn ($query) => $query->where('department_id', $user->department_id))
            ->orderBy('name')
            ->get();
        $pendingTransferRequests = SectionTransferRequest::query()
            ->with(['student', 'sourceSection', 'destinationSection', 'requester'])
            ->where('status', 'pending')
            ->when(SectionDepartmentAccess::isChair($user), fn ($query) => $query->whereHas('sourceSection', fn ($sectionQuery) => $sectionQuery->where('department_id', $user->department_id)))
            ->latest()
            ->get();
        $courses = Course::query()
            ->where('is_active', true)
            ->where('program_type', 'college')
            ->when(SectionDepartmentAccess::isChair($user), fn ($query) => $query->where('department_id', $user->department_id))
            ->orderBy('name')
            ->get();
        $defaultCourse = SectionDepartmentAccess::isChair($user) ? $courses->first()?->name : null;
        $subjects = Subject::query()
            ->where('is_active', true)
            ->orderBy('code')
            ->get();
        $teachers = User::query()
            ->whereIn('role', User::FACULTY_ROLES)
            ->orWhereHas('roles', fn ($query) => $query->whereIn('name', User::FACULTY_ROLES))
            ->orderBy('name')
            ->get(['id', 'name', 'email']);
        $students = Student::query()
            ->with('user:id,name,email')
            ->where('status', 'active')
            ->whereNotNull('user_id')
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->get(['id', 'user_id', 'student_id', 'first_name', 'last_name', 'email', 'grade_level', 'section', 'school_year']);
        $schoolYears = Section::query()
            ->whereNotNull('school_year')
            ->where('school_year', '!=', '')
            ->distinct()
            ->orderByDesc('school_year')
            ->pluck('school_year');

        return view('registrar.sections.index', compact('sections', 'courses', 'subjects', 'teachers', 'students', 'schoolYears', 'defaultCourse', 'transferTargets', 'pendingTransferRequests'));
    }

    public function store(Request $request)
    {
        $this->requireAnyRole($request, ['admin', 'registrar', 'head_department']);
        $department = SectionDepartmentAccess::authorize($request->user());
        $data = $this->validated($request);
        SectionDepartmentAccess::validateCourse($department, $data);
        if ($this->isChair($request)) {
            app(SectionEditAccess::class)->prepareChairEdit($request->user(), $section);
            $data['department_id'] = $request->user()->department_id;
            $data['created_by'] = $request->user()->id;
            $data['workflow_status'] = 'draft';
            $data['is_active'] = false;
        } else {
            $data['workflow_status'] = $data['is_active'] ? 'approved' : 'draft';
            $data['created_by'] = $request->user()->id;
        }
        $section = Section::create($data);
        ActivityLog::record($request, 'section_created', 'Created section '.$section->name.'.', ['subject_type' => Section::class, 'subject_id' => $section->id]);

        return back()->with('status', 'Section created.');
    }

    public function update(Request $request, Section $section)
    {
        $this->requireAnyRole($request, ['admin', 'registrar', 'head_department']);
        $department = SectionDepartmentAccess::authorize($request->user(), $section);
        abort_if($this->isChair($request) && !$this->ownsSection($request, $section), 403);
        $data = $this->validated($request);
        SectionDepartmentAccess::validateCourse($department, $data);
        if ($this->isChair($request)) {
            app(SectionEditAccess::class)->prepareChairEdit($request->user(), $section);
            $data['workflow_status'] = 'draft';
            $data['is_active'] = false;
        }
        $section->update($data);
        ActivityLog::record($request, 'section_updated', 'Updated section '.$section->name.'.', ['subject_type' => Section::class, 'subject_id' => $section->id]);

        return back()->with(['status' => 'Section updated.', 'open_section' => $section->id]);
    }

    public function requestEdit(Request $request, Section $section)
    {
        $this->requireAnyRole($request, ['head_department']);
        SectionDepartmentAccess::authorize($request->user(), $section);
        abort_unless($this->ownsSection($request, $section), 403);
        abort_unless(in_array($section->workflow_status, ['approved', 'closed'], true), 422, 'Edit requests are only available for approved or closed sections.');

        $data = $request->validate(['reason' => ['required', 'string', 'max:2000']]);
        $editRequest = DB::transaction(function () use ($request, $section, $data) {
            $lockedSection = Section::query()->lockForUpdate()->findOrFail($section->id);
            abort_unless(in_array($lockedSection->workflow_status, ['approved', 'closed'], true), 422, 'Edit requests are only available for approved or closed sections.');
            if ($lockedSection->editRequests()->whereIn('status', ['pending', 'approved'])->lockForUpdate()->exists()) {
                return null;
            }

            return $lockedSection->editRequests()->create([
                'requested_by' => $request->user()->id,
                'reason' => $data['reason'],
            ]);
        });
        if (! $editRequest) {
            return back()->withErrors(['edit_request' => 'This section already has a pending or approved edit request.']);
        }
        ActivityLog::record($request, 'section_edit_requested', 'Requested permission to edit section '.$section->name.'.', ['subject_type' => Section::class, 'subject_id' => $section->id, 'meta' => ['edit_request_id' => $editRequest->id]]);

        return back()->with(['status' => 'Edit request sent to the Registrar.', 'open_section' => $section->id]);
    }

    public function reviewEditRequest(Request $request, SectionEditRequest $editRequest)
    {
        $this->requireAnyRole($request, ['admin', 'registrar']);
        $editRequest->loadMissing('section');
        $section = $editRequest->section;
        SectionDepartmentAccess::authorize($request->user(), $section);
        abort_unless($editRequest->status === 'pending', 422, 'Only pending edit requests can be reviewed.');
        abort_unless(in_array($section->workflow_status, ['approved', 'closed'], true), 422, 'This section is no longer eligible for an edit request.');

        $data = $request->validate([
            'decision' => ['required', 'in:approve,reject'],
            'remarks' => ['nullable', 'string', 'max:2000'],
        ]);
        if ($data['decision'] === 'reject' && blank($data['remarks'] ?? null)) {
            return back()->withErrors(['remarks' => 'Remarks are required when rejecting an edit request.']);
        }

        $editRequest->update([
            'status' => $data['decision'] === 'approve' ? 'approved' : 'rejected',
            'registrar_remarks' => $data['remarks'] ?? null,
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
        ]);
        ActivityLog::record($request, 'section_edit_request_reviewed', ucfirst($data['decision']).' the edit request for section '.$section->name.'.', ['subject_type' => Section::class, 'subject_id' => $section->id, 'meta' => ['edit_request_id' => $editRequest->id, 'remarks' => $data['remarks'] ?? null]]);

        return back()->with(['status' => $data['decision'] === 'approve' ? 'Section edit request approved. The Chair can now edit and resubmit the section.' : 'Section edit request rejected.', 'open_section' => $section->id]);
    }

    public function requestTransfer(Request $request, Section $section)
    {
        $this->requireAnyRole($request, ['head_department']);
        SectionDepartmentAccess::authorize($request->user(), $section);
        abort_unless($this->ownsSection($request, $section), 403);
        abort_unless($section->workflow_status === 'approved' && $section->is_active, 422, 'Transfers can only be requested from an approved section.');

        $data = $request->validate([
            'student_id' => ['required', 'integer', 'exists:users,id'],
            'to_section_id' => ['required', 'integer', 'exists:sections,id'],
            'reason' => ['required', 'string', 'max:2000'],
        ]);
        $student = User::query()->whereKey($data['student_id'])->where(function ($query) {
            $query->where('role', User::ROLE_STUDENT)->orWhereHas('roles', fn ($roles) => $roles->where('name', User::ROLE_STUDENT));
        })->firstOrFail();
        $destination = Section::findOrFail($data['to_section_id']);
        abort_unless($this->isSameTransferScope($section, $destination), 422, 'Choose an active approved destination section in the same department, course, year, school year, and semester.');
        abort_unless($section->students()->where('users.id', $student->id)->wherePivot('status', 'enrolled')->exists(), 422, 'The student is not currently enrolled in the source section.');
        if ($destination->students()->where('users.id', $student->id)->wherePivot('status', 'enrolled')->exists()) {
            return back()->withErrors(['student_id' => 'The student is already enrolled in the destination section.']);
        }

        $transferRequest = DB::transaction(function () use ($request, $section, $destination, $student, $data) {
            User::query()->lockForUpdate()->findOrFail($student->id);
            $hasPendingRequest = SectionTransferRequest::query()
                ->where('student_id', $student->id)
                ->where('status', 'pending')
                ->lockForUpdate()
                ->exists();
            if ($hasPendingRequest) {
                return null;
            }

            return SectionTransferRequest::create([
                'student_id' => $student->id,
                'from_section_id' => $section->id,
                'to_section_id' => $destination->id,
                'requested_by' => $request->user()->id,
                'reason' => $data['reason'],
            ]);
        });
        if (! $transferRequest) {
            return back()->withErrors(['student_id' => 'This student already has a pending section transfer request.'])
                ->with(['open_section' => $section->id, 'open_students_modal' => $section->id]);
        }

        ActivityLog::record($request, 'section_transfer_requested', "Requested transfer for {$student->name} from {$section->name} to {$destination->name}.", ['subject_type' => Section::class, 'subject_id' => $section->id, 'meta' => ['student_id' => $student->id, 'to_section_id' => $destination->id]]);

        return back()->with(['status' => 'Student transfer request sent to the Registrar.', 'open_section' => $section->id, 'open_students_modal' => $section->id]);
    }

    public function reviewTransfer(Request $request, SectionTransferRequest $transferRequest)
    {
        $this->requireAnyRole($request, ['registrar', 'admin']);
        $transferRequest->loadMissing(['sourceSection', 'destinationSection', 'student']);
        $source = $transferRequest->sourceSection;
        $destination = $transferRequest->destinationSection;
        SectionDepartmentAccess::authorize($request->user(), $source);
        abort_unless($transferRequest->status === 'pending', 422, 'Only pending student transfer requests can be reviewed.');

        $data = $request->validate([
            'decision' => ['required', 'in:approve,reject'],
            'remarks' => ['nullable', 'string', 'max:2000'],
        ]);
        if ($data['decision'] === 'reject' && blank($data['remarks'] ?? null)) {
            return back()->withErrors(['remarks' => 'Remarks are required when rejecting a transfer request.']);
        }

        DB::transaction(function () use ($request, $transferRequest, $source, $destination, $data) {
            $lockedRequest = SectionTransferRequest::query()->lockForUpdate()->findOrFail($transferRequest->id);
            abort_unless($lockedRequest->status === 'pending', 422, 'This transfer request has already been reviewed.');
            $lockedSource = Section::query()->lockForUpdate()->findOrFail($source->id);
            $lockedDestination = Section::query()->lockForUpdate()->findOrFail($destination->id);
            $student = User::query()->lockForUpdate()->findOrFail($lockedRequest->student_id);

            if ($data['decision'] === 'approve') {
                abort_unless($this->isSameTransferScope($lockedSource, $lockedDestination), 422, 'The destination section is no longer eligible for this transfer.');
                $sourceEnrollment = DB::table('section_students')
                    ->where('section_id', $lockedSource->id)
                    ->where('user_id', $student->id)
                    ->where('status', 'enrolled')
                    ->lockForUpdate()
                    ->first();
                abort_unless($sourceEnrollment, 422, 'The student is no longer enrolled in the source section.');
                $otherEnrollmentExists = DB::table('section_students')
                    ->where('user_id', $student->id)
                    ->where('status', 'enrolled')
                    ->where('section_id', '!=', $lockedSource->id)
                    ->exists();
                abort_if($otherEnrollmentExists, 422, 'The student is also enrolled in another section. Resolve the other enrollment before transferring.');
                $destinationEnrollment = DB::table('section_students')
                    ->where('section_id', $lockedDestination->id)
                    ->where('user_id', $student->id)
                    ->lockForUpdate()
                    ->first();
                abort_if($destinationEnrollment && $destinationEnrollment->status === 'enrolled', 422, 'The student is already enrolled in the destination section.');
                $enrolledCount = DB::table('section_students')
                    ->where('section_id', $lockedDestination->id)
                    ->where('status', 'enrolled')
                    ->count();
                abort_if($enrolledCount >= $lockedDestination->max_students, 422, 'The destination section has reached its capacity.');

                DB::table('section_students')->where('id', $sourceEnrollment->id)->update(['status' => 'dropped', 'updated_at' => now()]);
                if ($destinationEnrollment) {
                    DB::table('section_students')->where('id', $destinationEnrollment->id)->update(['status' => 'enrolled', 'updated_at' => now()]);
                } else {
                    $lockedDestination->students()->attach($student->id, ['status' => 'enrolled']);
                }
                $student->student()->update(['section' => $lockedDestination->name, 'school_year' => $lockedDestination->school_year]);
            }

            $lockedRequest->update([
                'status' => $data['decision'] === 'approve' ? 'approved' : 'rejected',
                'registrar_remarks' => $data['remarks'] ?? null,
                'reviewed_by' => $request->user()->id,
                'reviewed_at' => now(),
            ]);
        });

        ActivityLog::record($request, 'section_transfer_reviewed', ucfirst($data['decision'])." transfer request for {$transferRequest->student->name} from {$source->name} to {$destination->name}.", ['subject_type' => Section::class, 'subject_id' => $source->id, 'meta' => ['student_id' => $transferRequest->student_id, 'to_section_id' => $destination->id, 'remarks' => $data['remarks'] ?? null]]);

        return back()->with('status', $data['decision'] === 'approve' ? 'Student transfer approved.' : 'Student transfer rejected.');
    }

    public function submit(Request $request, Section $section)
    {
        $this->requireAnyRole($request, ['head_department']);
        SectionDepartmentAccess::authorize($request->user(), $section);
        abort_unless($this->ownsSection($request, $section), 403);
        abort_unless(in_array($section->workflow_status, ['draft', 'rejected']), 422, 'Only draft or rejected sections can be submitted.');
        $section->update(['workflow_status' => 'pending', 'workflow_remarks' => null, 'submitted_at' => now(), 'is_active' => false]);
        ActivityLog::record($request, 'section_submitted', 'Submitted section '.$section->name.' for Registrar review.', ['subject_type' => Section::class, 'subject_id' => $section->id]);
        return back()->with('status', 'Section submitted for Registrar review.');
    }

    public function review(Request $request, Section $section)
    {
        $this->requireAnyRole($request, ['admin', 'registrar']);
        $data = $request->validate(['decision' => ['required', 'in:approve,reject'], 'remarks' => ['nullable', 'string', 'max:2000']]);
        if ($data['decision'] === 'reject' && blank($data['remarks'] ?? null)) return back()->withErrors(['remarks' => 'Remarks are required when rejecting a section.']);
        if ($data['decision'] === 'approve' && ($conflict = $this->scheduleConflict($section))) {
            return back()->withErrors(['section' => $conflict]);
        }
        $section->update(['workflow_status' => $data['decision'] === 'approve' ? 'approved' : 'rejected', 'workflow_remarks' => $data['remarks'] ?? null, 'reviewed_by' => $request->user()->id, 'reviewed_at' => now(), 'is_active' => $data['decision'] === 'approve']);
        ActivityLog::record($request, 'section_reviewed', ucfirst($data['decision']).' section '.$section->name.'.', ['subject_type' => Section::class, 'subject_id' => $section->id, 'meta' => ['remarks' => $data['remarks'] ?? null]]);
        return back()->with('status', $data['decision'] === 'approve' ? 'Section approved and opened for enrollment.' : 'Section returned to the Chair.');
    }

    public function close(Request $request, Section $section)
    {
        $this->requireAnyRole($request, ['admin', 'registrar']);
        $section->update(['workflow_status' => 'closed', 'is_active' => false]);
        return back()->with('status', 'Section closed.');
    }

    public function reopen(Request $request, Section $section)
    {
        $this->requireAnyRole($request, ['admin', 'registrar']);
        abort_unless(in_array($section->workflow_status, ['closed', 'approved']), 422, 'Only approved or closed sections can be reopened.');
        $section->update(['workflow_status' => 'approved', 'is_active' => true, 'workflow_remarks' => null]);
        ActivityLog::record($request, 'section_reopened', 'Reopened section '.$section->name.'.', ['subject_type' => Section::class, 'subject_id' => $section->id]);
        return back()->with('status', 'Section reopened for enrollment.');
    }

    public function assignSubject(Request $request, Section $section)
    {
        $this->requireAnyRole($request, ['admin', 'registrar', 'head_department']);
        SectionDepartmentAccess::authorize($request->user(), $section);

        $data = $request->validate([
            'subject_id' => ['required_without:subject_ids', 'nullable', 'integer', 'exists:subjects,id'],
            'subject_ids' => ['required_without:subject_id', 'array', 'min:1'],
            'subject_ids.*' => ['required', 'integer', 'distinct', 'exists:subjects,id'],
            'teacher_id' => ['nullable', 'integer', 'exists:users,id'],
            'day' => ['nullable', 'string', 'max:100'],
            'days' => ['nullable', 'array'],
            'days.*' => ['string', 'in:Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday'],
            'time_start' => ['nullable', 'string', 'max:10'],
            'time_end' => ['nullable', 'string', 'max:10'],
            'room' => ['nullable', 'string', 'max:50'],
            'schedules' => ['nullable', 'array'],
            'schedules.*.day' => ['required', 'string', 'max:30'],
            'schedules.*.time_start' => ['nullable', 'string', 'max:10'],
            'schedules.*.time_end' => ['nullable', 'string', 'max:10'],
            'schedules.*.room' => ['nullable', 'string', 'max:50'],
        ]);

        $subjectIds = $data['subject_ids'] ?? [$data['subject_id']];
        $section->loadMissing('sectionSubjects');
        $invalid = Subject::whereIn('id', $subjectIds)->get()->first(function ($subject) use ($section) {
            if ($section->program_type === 'college') {
                return $subject->course && $section->course && trim($subject->course) !== trim($section->course);
            }
            return $subject->strand && $section->strand && trim($subject->strand) !== trim($section->strand);
        });
        if ($invalid) return back()->withErrors(['subject_ids' => 'Only subjects connected to this course/strand or general subjects may be assigned.']);

        app(SectionEditAccess::class)->prepareChairEdit($request->user(), $section);
        DB::transaction(function () use ($section, $subjectIds, $data) {
            foreach ($subjectIds as $subjectId) {
                $assignment = SectionSubject::updateOrCreate(
                    [
                        'section_id' => $section->id,
                        'subject_id' => $subjectId,
                    ],
                    [
                        'teacher_id' => $data['teacher_id'] ?? null,
                        'day' => !empty($data['days']) ? implode(', ', $data['days']) : ($data['day'] ?? null),
                        'time_start' => $data['time_start'] ?? null,
                        'time_end' => $data['time_end'] ?? null,
                        'room' => $data['room'] ?? null,
                    ]
                );
                if (array_key_exists('schedules', $data)) {
                    $hasStoredMeetings = $assignment->schedules()->exists();
                    $assignment->schedules()->delete();
                    $meetingSchedules = [];
                    $primaryDay = !empty($data['days']) ? implode(', ', $data['days']) : ($data['day'] ?? null);
                    if (!$hasStoredMeetings && $primaryDay) {
                        $meetingSchedules[] = [
                            'day' => $primaryDay,
                            'time_start' => $data['time_start'] ?? null,
                            'time_end' => $data['time_end'] ?? null,
                            'room' => $data['room'] ?? null,
                        ];
                    }
                    $meetingSchedules = array_merge($meetingSchedules, $data['schedules'] ?? []);
                    $meetingSchedules = collect($meetingSchedules)
                        ->filter(fn ($meeting) => !empty($meeting['day']))
                        ->unique(fn ($meeting) => implode('|', [$meeting['day'], $meeting['time_start'] ?? '', $meeting['time_end'] ?? '', $meeting['room'] ?? '']))
                        ->values()
                        ->all();
                    $assignment->schedules()->createMany($meetingSchedules);
                }
            }
        });

        return back()->with([
            'status' => count($subjectIds) === 1 ? 'Subject assigned to section.' : count($subjectIds).' subjects assigned to section.',
            'open_section' => $section->id,
            'open_subjects_modal' => $section->id,
        ]);
    }

    public function removeSubject(Request $request, Section $section, SectionSubject $sectionSubject)
    {
        $this->requireAnyRole($request, ['admin', 'registrar', 'head_department']);
        SectionDepartmentAccess::authorize($request->user(), $section);
        abort_unless((int) $sectionSubject->section_id === (int) $section->id, 404);

        app(SectionEditAccess::class)->prepareChairEdit($request->user(), $section);
        ArchiveService::record($sectionSubject, $request->user()?->id, 'web.sections.subjects');
        $sectionSubject->delete();

        return back()->with(['status' => 'Subject removed from section.', 'open_section' => $section->id, 'open_subjects_modal' => $section->id]);
    }

    public function destroy(Request $request, Section $section)
    {
        $this->requireAnyRole($request, ['admin', 'registrar', 'head_department']);
        SectionDepartmentAccess::authorize($request->user(), $section);

        app(SectionEditAccess::class)->prepareChairEdit($request->user(), $section);
        ArchiveService::record($section, $request->user()?->id, 'web.sections');
        $section->delete();

        return back()->with('status', 'Section archived and removed.');
    }

    public function enrollStudent(Request $request, Section $section)
    {
        $this->requireAnyRole($request, ['admin', 'registrar', 'head_department']);
        SectionDepartmentAccess::authorize($request->user(), $section);
        if ($this->isChair($request) && ! in_array($section->workflow_status, ['draft', 'rejected'], true)) {
            return back()->withErrors(['section' => 'Use the transfer request next to a student in the approved source section. The Registrar must approve it before the student moves.'])
                ->with(['open_section' => $section->id, 'open_students_modal' => $section->id]);
        }

        $data = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
        ]);

        if ($section->students()->wherePivot('status', 'enrolled')->count() >= $section->max_students) {
            return back()->withErrors(['section' => 'This section has reached its maximum students.']);
        }

        $studentUser = User::findOrFail($data['user_id']);
        if ($studentUser->role !== User::ROLE_STUDENT && !$studentUser->hasRole(User::ROLE_STUDENT)) {
            return back()->withErrors(['student' => 'Only student accounts can be enrolled in a section.']);
        }

        $studentsBefore = $section->students()->get()
            ->mapWithKeys(fn (User $student) => [$student->getKey() => ['status' => $student->pivot->status]])
            ->all();
        $section->students()->syncWithoutDetaching([
            $studentUser->id => ['status' => 'enrolled'],
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

        Student::where('user_id', $studentUser->id)->get()
            ->each(fn (Student $student) => $student->update(['section' => $section->name]));

        return back()->with(['status' => 'Student added to section.', 'open_section' => $section->id, 'open_students_modal' => $section->id]);
    }

    public function removeStudent(Request $request, Section $section, User $student)
    {
        $this->requireAnyRole($request, ['admin', 'registrar', 'head_department']);
        SectionDepartmentAccess::authorize($request->user(), $section);
        if ($this->isChair($request) && ! in_array($section->workflow_status, ['draft', 'rejected'], true)) {
            return back()->withErrors(['section' => 'Students in approved sections can only be moved through a Registrar-approved transfer request.'])
                ->with(['open_section' => $section->id, 'open_students_modal' => $section->id]);
        }

        $studentsBefore = $section->students()->get()
            ->mapWithKeys(fn (User $student) => [$student->getKey() => ['status' => $student->pivot->status]])
            ->all();
        $section->students()->detach($student->id);
        ActivityLog::recordRelationChange(
            $request,
            $section,
            'students',
            $studentsBefore,
            $section->students()->get()
                ->mapWithKeys(fn (User $student) => [$student->getKey() => ['status' => $student->pivot->status]])
                ->all()
        );
        Student::where('user_id', $student->id)->get()
            ->each(fn (Student $record) => $record->update(['section' => 'TBA']));

        return back()->with(['status' => 'Student removed from section.', 'open_section' => $section->id, 'open_students_modal' => $section->id]);
    }

    private function validated(Request $request): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'course' => ['nullable', 'string', 'max:100'],
            'year_level' => ['nullable', 'string', 'max:5'],
            'program_type' => ['required', 'in:shs,college'],
            'strand' => ['nullable', 'string', 'max:20'],
            'school_year' => ['required', 'string', 'max:20'],
            'semester' => ['required', 'in:1st,2nd,summer'],
            'max_students' => ['required', 'integer', 'min:1'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        return [
            ...$data,
            'course' => $data['program_type'] === 'college' ? ($data['course'] ?: null) : null,
            'strand' => $data['program_type'] === 'shs' ? ($data['strand'] ?: null) : null,
            'is_active' => (bool) ($data['is_active'] ?? false),
        ];
    }

    private function isChair(Request $request): bool { return SectionDepartmentAccess::isChair($request->user()); }
    private function ownsSection(Request $request, Section $section): bool { return $this->isChair($request) && (int) $section->department_id === (int) $request->user()->department_id; }

    private function isSameTransferScope(Section $source, Section $destination): bool
    {
        return $source->id !== $destination->id
            && $destination->workflow_status === 'approved'
            && $destination->is_active
            && $source->department_id !== null
            && (int) $source->department_id === (int) $destination->department_id
            && $source->program_type === $destination->program_type
            && $source->course === $destination->course
            && $source->strand === $destination->strand
            && $source->year_level === $destination->year_level
            && $source->school_year === $destination->school_year
            && $source->semester === $destination->semester;
    }

    private function scheduleConflict(Section $section): ?string
    {
        return app(\App\Services\SectionScheduleService::class)->approvalConflict($section);
    }
}
