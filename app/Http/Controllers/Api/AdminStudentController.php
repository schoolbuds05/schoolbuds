<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\EnrollmentApplication;
use App\Models\Section;
use App\Models\Student;
use App\Models\StudentReward;
use App\Models\StudentSubject;
use App\Models\Subject;
use App\Models\User;
use App\Services\ArchiveService;
use App\Services\PointsConfiguration;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Spatie\Permission\Models\Role;

class AdminStudentController extends Controller
{
    public function index(Request $request, PointsConfiguration $points)
    {
        $this->authorizeStudentManager($request);

        $search = trim((string) $request->query('search', ''));
        $status = $request->query('status');

        $students = Student::query()
            ->with(['user:id,name,email,role,created_at', 'parent:id,name,email,role'])
            ->when(in_array($status, ['active', 'inactive', 'graduated'], true), fn ($query) => $query->where('status', $status))
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($inner) use ($search) {
                    $inner->where('student_id', 'like', "%{$search}%")
                        ->orWhere('first_name', 'like', "%{$search}%")
                        ->orWhere('last_name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%")
                        ->orWhere('grade_level', 'like', "%{$search}%")
                        ->orWhere('section', 'like', "%{$search}%")
                        ->orWhereHas('user', function ($userQuery) use ($search) {
                            $userQuery->where('name', 'like', "%{$search}%")
                                ->orWhere('email', 'like', "%{$search}%");
                        });
                });
            })
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->get();

        return response()->json($students->map(fn (Student $student) => $this->studentPayload($student, $points)));
    }

    public function update(Request $request, Student $student)
    {
        $this->authorizeStudentManager($request);

        $data = $request->validate([
            'student_id'  => ['required', 'string', 'max:255', Rule::unique('students', 'student_id')->ignore($student->id)],
            'first_name'  => ['required', 'string', 'max:255'],
            'last_name'   => ['required', 'string', 'max:255'],
            'email'       => ['nullable', 'email', 'max:255', Rule::unique('students', 'email')->ignore($student->id), Rule::unique('users', 'email')->ignore($student->user_id)],
            'phone'       => ['nullable', 'string', 'max:50'],
            'birthdate'   => ['nullable', 'date'],
            'gender'      => ['required', 'in:male,female'],
            'address'     => ['nullable', 'string', 'max:500'],
            'grade_level' => ['required', 'string', 'max:255'],
            'section'     => ['required', 'string', 'max:255'],
            'school_year' => ['required', 'string', 'max:255'],
            'status'      => ['required', 'in:active,inactive,graduated'],
            'father_name' => ['nullable', 'string', 'max:255'],
            'father_occupation' => ['nullable', 'string', 'max:255'],
            'mother_name' => ['nullable', 'string', 'max:255'],
            'mother_occupation' => ['nullable', 'string', 'max:255'],
            'prev_school' => ['nullable', 'string', 'max:255'],
            'prev_school_address' => ['nullable', 'string', 'max:255'],
            'student_type' => ['nullable', 'in:new_student,old_student,transferee,returnee'],
            'academic_status' => ['nullable', 'in:Regular,Irregular'],
            'parent_email' => ['nullable', 'email', 'exists:users,email'],
        ]);

        $parentId = $student->parent_user_id;
        if (array_key_exists('parent_email', $data)) {
            $parentId = null;
        }

        if (!empty($data['parent_email'])) {
            $parent = User::where('email', $data['parent_email'])->first();
            if (!$parent || ($parent->role !== 'parent' && !$parent->hasRole('parent'))) {
                return response()->json(['message' => 'Parent email must belong to a parent account.'], 422);
            }
            $parentId = $parent->id;
        }

        $student->update(collect($data)->only([
            'student_id', 'first_name', 'last_name', 'email', 'phone', 'birthdate',
            'gender', 'address', 'grade_level', 'section', 'school_year', 'status',
            'father_name', 'father_occupation', 'mother_name', 'mother_occupation',
            'prev_school', 'prev_school_address', 'student_type', 'academic_status',
        ])->merge([
            'parent_user_id' => $parentId,
        ])->all());

        $application = $this->applicationForStudent($student);

        if ($application) {
            $application->update(collect($data)->only([
                'father_name', 'father_occupation', 'mother_name', 'mother_occupation',
                'prev_school', 'prev_school_address', 'student_type', 'academic_status',
            ])->all());
        }

        if ($student->user) {
            $userValues = [
                'name' => trim($data['first_name'] . ' ' . $data['last_name']),
                'role' => 'student',
            ];
            if (!empty($data['email'])) {
                $userValues['email'] = $data['email'];
            }
            $student->user->update($userValues);
            Role::findOrCreate('student', 'web');
            $student->user->syncRoles(['student']);
        }

        return response()->json($this->studentPayload($student->load(['user:id,name,email,role,created_at', 'parent:id,name,email,role'])));
    }

    public function resetPassword(Request $request, Student $student)
    {
        $this->authorizeStudentManager($request);

        $data = $request->validate([
            'password' => ['required', 'string', 'min:6'],
        ]);

        if (!$student->user) {
            return response()->json(['message' => 'Student user account not found.'], 404);
        }

        $student->user->update([
            'password' => Hash::make($data['password']),
        ]);

        return response()->json(['message' => 'Student password updated.']);
    }

    public function dropSubject(Request $request, Student $student, Subject $subject)
    {
        $this->authorizeStudentManager($request);

        $data = $request->validate([
            'section_id'   => ['nullable', 'integer', 'exists:sections,id'],
            'drop_reason' => ['nullable', 'string', 'max:500'],
        ]);

        StudentSubject::query()->updateOrCreate(
            [
                'user_id'    => $student->user_id,
                'subject_id' => $subject->id,
                'section_id' => $data['section_id'] ?? null,
            ],
            [
                'status'      => 'dropped',
                'drop_reason' => $data['drop_reason'] ?? null,
                'dropped_at'  => now(),
                'dropped_by'  => $request->user()->id,
            ]
        );

        return response()->json([
            'message' => 'Subject dropped for this student.',
            'student' => $this->studentPayload($student->load(['user:id,name,email,role,created_at', 'parent:id,name,email,role'])),
        ]);
    }

    public function restoreSubject(Request $request, Student $student, Subject $subject)
    {
        $this->authorizeStudentManager($request);

        $data = $request->validate([
            'section_id' => ['nullable', 'integer', 'exists:sections,id'],
        ]);

        StudentSubject::query()
            ->where('user_id', $student->user_id)
            ->where('subject_id', $subject->id)
            ->where('section_id', $data['section_id'] ?? null)
            ->update([
                'status'      => 'enrolled',
                'drop_reason' => null,
                'dropped_at'  => null,
                'dropped_by'  => null,
            ]);

        return response()->json([
            'message' => 'Subject restored for this student.',
            'student' => $this->studentPayload($student->load(['user:id,name,email,role,created_at', 'parent:id,name,email,role'])),
        ]);
    }

    public function destroy(Request $request, Student $student)
    {
        $this->authorizeAdmin($request);

        $user = $student->user;
        ArchiveService::record($student, $request->user()?->id, 'api.admin.students');

        if ($user) {
            ArchiveService::record($user, $request->user()?->id, 'api.admin.students.linked_user');
            $user->delete();
        } else {
            $student->delete();
        }

        return response()->json(['message' => 'Student account deleted.']);
    }

    private function authorizeAdmin(Request $request): void
    {
        $user = $request->user();

        if (!$user || ($user->role !== 'admin' && !$user->hasRole('admin'))) {
            abort(response()->json(['message' => 'Admin access is required.'], 403));
        }
    }

    private function authorizeStudentManager(Request $request): void
    {
        $user = $request->user();

        if (!$user || (
            !in_array($user->role, ['admin', 'registrar'], true)
            && !$user->hasAnyRole(['admin', 'registrar'])
        )) {
            abort(response()->json(['message' => 'Admin or registrar access is required.'], 403));
        }
    }

    private function studentPayload(Student $student, PointsConfiguration $pointsConfiguration): array
    {
        $application = $this->applicationForStudent($student);

        $payload = $student->toArray();
        $payload['parent'] = $student->parent ? [
            'id' => $student->parent->id,
            'name' => $student->parent->name,
            'email' => $student->parent->email,
        ] : null;
        $payload['reward_summary'] = $this->rewardSummary($student, $pointsConfiguration);
        $payload['enrollment'] = $application ? [
            'id'                  => $application->id,
            'father_name'         => $application->father_name,
            'father_occupation'   => $application->father_occupation,
            'mother_name'         => $application->mother_name,
            'mother_occupation'   => $application->mother_occupation,
            'prev_school'         => $application->prev_school,
            'prev_school_address' => $application->prev_school_address,
            'student_type'        => $application->student_type,
            'academic_status'     => $application->academic_status,
            'program_type'        => $application->program_type,
            'course'              => $application->course,
            'strand'              => $application->strand,
            'semester'            => $application->semester,
            'subject_ids'         => $application->subject_ids ?? [],
        ] : null;
        $payload['subjects'] = $this->subjectsForStudent($student, $application);

        return $payload;
    }

    private function applicationForStudent(Student $student): ?EnrollmentApplication
    {
        return EnrollmentApplication::query()
            ->when($student->user_id, fn ($query, $userId) => $query->where('user_id', $userId))
            ->when(!$student->user_id, fn ($query) => $query->where('id_no', $student->student_id))
            ->latest()
            ->first();
    }

    private function subjectsForStudent(Student $student, ?EnrollmentApplication $application): array
    {
        $overrides = StudentSubject::query()
            ->where('user_id', $student->user_id)
            ->get()
            ->keyBy(fn (StudentSubject $record) => $this->subjectOverrideKey($record->section_id, $record->subject_id));

        $sectionSubjects = Section::query()
            ->whereHas('students', function ($query) use ($student) {
                $query->where('users.id', $student->user_id)
                    ->where('section_students.status', 'enrolled');
            })
            ->with(['sectionSubjects.subject', 'sectionSubjects.teacher:id,name'])
            ->get()
            ->flatMap(fn (Section $section) => $section->sectionSubjects->map(function ($sectionSubject) use ($section, $overrides) {
                $override = $overrides->get($this->subjectOverrideKey($section->id, $sectionSubject->subject?->id));

                return [
                    'id'          => $sectionSubject->subject?->id,
                    'section_id'  => $section->id,
                    'code'        => $sectionSubject->subject?->code,
                    'name'        => $sectionSubject->subject?->name,
                    'units_lec'   => $sectionSubject->subject?->units_lec,
                    'units_lab'   => $sectionSubject->subject?->units_lab,
                    'teacher'     => $sectionSubject->teacher?->name,
                    'day'         => $sectionSubject->day,
                    'time_start'  => $sectionSubject->time_start,
                    'time_end'    => $sectionSubject->time_end,
                    'room'        => $sectionSubject->room,
                    'source'      => 'section',
                    'status'      => $override?->status ?? 'enrolled',
                    'drop_reason' => $override?->drop_reason,
                    'dropped_at'  => $override?->dropped_at,
                ];
            }));

        $sectionSubjectIds = $sectionSubjects->pluck('id')->filter()->unique()->all();
        $directSectionSubjects = StudentSubject::query()
            ->where('user_id', $student->user_id)
            ->whereNotNull('section_id')
            ->with(['subject', 'section.sectionSubjects.teacher:id,name'])
            ->get()
            ->reject(fn (StudentSubject $record) => in_array((int) $record->subject_id, $sectionSubjectIds, true))
            ->map(function (StudentSubject $record) {
                $offering = $record->section?->sectionSubjects
                    ->first(fn ($sectionSubject) => (int) $sectionSubject->subject_id === (int) $record->subject_id);

                return [
                    'id'          => $record->subject?->id,
                    'section_id'  => $record->section_id,
                    'code'        => $record->subject?->code,
                    'name'        => $record->subject?->name,
                    'units_lec'   => $record->subject?->units_lec,
                    'units_lab'   => $record->subject?->units_lab,
                    'teacher'     => $offering?->teacher?->name,
                    'day'         => $offering?->day,
                    'time_start'  => $offering?->time_start,
                    'time_end'    => $offering?->time_end,
                    'room'        => $offering?->room,
                    'source'      => 'irregular',
                    'status'      => $record->status ?? 'enrolled',
                    'drop_reason' => $record->drop_reason,
                    'dropped_at'  => $record->dropped_at,
                ];
            });

        $directSubjectIds = collect($application?->subject_ids ?? [])
            ->map(fn ($id) => (int) $id)
            ->filter(fn ($id) => $id > 0 && !in_array($id, $sectionSubjectIds, true))
            ->unique()
            ->values();

        $directSubjects = Subject::query()
            ->whereIn('id', $directSubjectIds)
            ->get()
            ->map(function (Subject $subject) use ($overrides) {
                $override = $overrides->get($this->subjectOverrideKey(null, $subject->id));

                return [
                    'id'          => $subject->id,
                    'section_id'  => null,
                    'code'        => $subject->code,
                    'name'        => $subject->name,
                    'units_lec'   => $subject->units_lec,
                    'units_lab'   => $subject->units_lab,
                    'teacher'     => null,
                    'day'         => null,
                    'time_start'  => null,
                    'time_end'    => null,
                    'room'        => null,
                    'source'      => 'enrollment',
                    'status'      => $override?->status ?? 'enrolled',
                    'drop_reason' => $override?->drop_reason,
                    'dropped_at'  => $override?->dropped_at,
                ];
            });

        return $sectionSubjects
            ->concat($directSectionSubjects)
            ->concat($directSubjects)
            ->filter(fn ($subject) => $subject['id'])
            ->values()
            ->all();
    }

    private function subjectOverrideKey(?int $sectionId, ?int $subjectId): string
    {
        return ($sectionId ?? 'direct') . ':' . ($subjectId ?? 'none');
    }

    private function rewardSummary(Student $student, PointsConfiguration $pointsConfiguration): array
    {
        $points = (int) StudentReward::where('student_id', $student->id)->sum('points');
        $pointsPerLevel = max(1, (int) $pointsConfiguration->get('points_per_level'));
        $level = intdiv($points, $pointsPerLevel) + 1;

        return [
            'points' => $points,
            'level' => $level,
            'points_to_next_level' => max(0, ($level * $pointsPerLevel) - $points),
            'rewards_count' => StudentReward::where('student_id', $student->id)->count(),
        ];
    }
}
