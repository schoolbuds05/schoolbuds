<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\EnrollmentApplication;
use App\Models\AcademicTerm;
use App\Models\Course;
use App\Models\CourseShiftRequest;
use App\Models\SchoolNotification;
use App\Models\Section;
use App\Models\SectionSubject;
use App\Models\Student;
use App\Models\StudentSubject;
use App\Models\Subject;
use App\Models\User;
use App\Services\PointsService;
use App\Services\SemesterProgressionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Role;

class EnrollmentController extends Controller
{
    // ── PUBLIC ──────────────────────────────────────────────────

    // POST /api/enrollment
    public function store(Request $request, SemesterProgressionService $progression)
    {
        $studentUser = $request->user();
        if (! $studentUser) {
            return response()->json(['message' => 'Please register or log in before enrolling.'], 401);
        }

        $request->merge([
            'email' => $studentUser->email,
        ]);

        $existingApplication = null;
        $currentApprovedApplication = null;

        // For old students, find their most recent approved application
        if ($request->filled('student_type') && $request->student_type === 'old_student' && $request->filled('id_no')) {
            $existingApplication = EnrollmentApplication::where('id_no', $request->id_no)
                ->where('status', 'approved')
                ->latest()
                ->first();
        }

        if ($request->student_type === 'shiftee') {
            $currentApprovedApplication = EnrollmentApplication::query()
                ->where('user_id', $studentUser->id)
                ->where('status', 'approved')
                ->latest()
                ->first();
        }

        $rules = [
            // Account
            'email'                 => ['required', 'email'],

            // Personal
            'first_name'     => 'required|string|max:100',
            'last_name'      => 'required|string|max:100',
            'middle_name'    => 'nullable|string|max:100',
            'birthdate'      => 'nullable|date',
            'gender'         => 'nullable|string|max:20',
            'religion'       => 'nullable|string|max:100',
            'civil_status'   => 'nullable|string|max:50',
            'citizenship'    => 'nullable|string|max:100',
            'place_of_birth' => 'nullable|string|max:255',
            'contact_number' => 'nullable|string|max:20',
            'address'        => 'nullable|string|max:500',

            // Family
            'father_name'        => 'nullable|string|max:255',
            'father_occupation'  => 'nullable|string|max:255',
            'mother_name'        => 'nullable|string|max:255',
            'mother_occupation'  => 'nullable|string|max:255',
            'parent_email'       => ['nullable', 'email', 'max:255', 'different:email'],

            // Previous school
            'prev_school'         => 'nullable|string|max:255',
            'prev_school_address' => 'nullable|string|max:255',

            // Classification
            'student_type'    => 'nullable|in:new_student,old_student,transferee,shiftee,returnee',
            'academic_status' => 'required|in:Regular,Irregular',
            'shiftee_from'    => 'nullable|string|max:100',
            'shiftee_to'      => 'nullable|string|max:100',
            'id_no'           => 'nullable|string|max:50',

            // Program
            'program_type' => 'required|in:shs,college',
            'grade_level'  => 'required_if:program_type,shs|nullable|in:11,12',
            'strand'       => 'required_if:program_type,shs|nullable|in:STEM,ABM,HUMSS,TVL,GAS',
            'course_id'    => 'nullable|exists:courses,id',
            'course'       => 'required_if:program_type,college|required_without:course_id|nullable|string|max:100',
            'year_level'   => 'required_if:program_type,college|nullable|in:1,2,3,4',

            // Subjects
            'subject_ids'   => $request->academic_status === 'Regular'
                ? 'nullable|array'
                : 'required|array|min:1',
            'subject_ids.*' => 'integer|exists:subjects,id',
            'section_subject_ids'   => 'nullable|array',
            'section_subject_ids.*' => 'integer|exists:section_subjects,id',
            'documents'     => 'required_if:student_type,transferee,shiftee|array|max:10',
            'documents.*'   => 'file|mimes:pdf,doc,docx,jpg,jpeg,png|max:5120',

            // Enrollment period
            'school_year' => 'required|string|max:20',
            'semester'    => 'required|in:1st,2nd,summer',
        ];

        if ($request->student_type === 'old_student') {
            // id_no must match an approved application
            $rules['id_no'] = [
                'required', 'string', 'max:50',
                function ($attribute, $value, $fail) {
                    $exists = EnrollmentApplication::where('id_no', $value)
                        ->where('status', 'approved')
                        ->exists();
                    if (!$exists) {
                        $fail('No approved student record found with that ID.');
                    }
                },
            ];
        }

        $validator = Validator::make($request->all(), $rules);
        if ($validator->fails()) {
            return response()->json([
                'message' => $validator->errors()->first(),
                'errors'  => $validator->errors(),
            ], 422);
        }

        if ($request->student_type === 'shiftee' && (!$request->filled('course_id') || !$request->filled('shiftee_from') || !$request->filled('shiftee_to'))) {
            return response()->json([
                'message' => 'Shiftee applications require the current course, requested course, and reason path.',
            ], 422);
        }

        // Block exact name + birthdate duplicates (new students only)
        if ($request->student_type !== 'old_student' && $request->filled('birthdate')) {
            $nameMatch = EnrollmentApplication::query()
                ->whereRaw('LOWER(first_name) = ?', [strtolower($request->first_name)])
                ->whereRaw('LOWER(last_name) = ?', [strtolower($request->last_name)])
                ->where('birthdate', $request->birthdate)
                ->whereIn('status', ['pending', 'approved'])
                ->exists();

            if (! $nameMatch) {
                $nameMatch = Student::query()
                    ->whereRaw('LOWER(first_name) = ?', [strtolower($request->first_name)])
                    ->whereRaw('LOWER(last_name) = ?', [strtolower($request->last_name)])
                    ->where('birthdate', $request->birthdate)
                    ->exists();
            }

            if ($nameMatch) {
                return response()->json([
                    'message' => 'A student with the same name and birthdate already exists. If this is you, please use the "Old Student" option instead.',
                ], 422);
            }
        }

        if ($existingApplication && EnrollmentApplication::query()
            ->where('id_no', $request->id_no)
            ->where('school_year', $request->school_year)
            ->where('semester', strtolower($request->semester))
            ->where('status', 'pending')
            ->exists()
        ) {
            return response()->json([
                'message' => 'You already have a pending enrollment application for this term.',
            ], 422);
        }

        if (EnrollmentApplication::query()
            ->where('user_id', $studentUser->id)
            ->where('school_year', $request->school_year)
            ->where('semester', strtolower($request->semester))
            ->where('status', 'pending')
            ->exists()
        ) {
            return response()->json([
                'message' => 'You already have a pending enrollment application for this term.',
            ], 422);
        }

        if ($message = $this->enrollmentWindowMessage($request->school_year, strtolower($request->semester))) {
            return response()->json(['message' => $message], 422);
        }

        $evaluation = ['requires_irregular' => false];
        if (strtolower($request->semester) === '2nd') {
            $evaluation = $progression->evaluateFirstSemester($studentUser, $request->school_year);
            if (!$evaluation['can_proceed']) {
                return response()->json(['message' => $evaluation['message']], 422);
            }
            if ($evaluation['requires_irregular']) {
                $request->merge(['academic_status' => 'Irregular']);
            }
        }

        // Normalize gender
        $genderMap = [
            'm' => 'male', 'f' => 'female',
            'male' => 'male', 'female' => 'female', 'other' => 'other',
        ];
        $gender = $genderMap[strtolower($request->gender ?? '')] ?? 'other';

        $hashedPassword = $studentUser->password;

        $sectionSubjectIds = $this->sectionSubjectIdsForApplication($request);
        $requestedSectionSubjectCount = collect($request->section_subject_ids ?? [])->map(fn ($id) => (int) $id)->unique()->count();
        if ($requestedSectionSubjectCount !== count($sectionSubjectIds)) {
            return response()->json([
                'message' => 'Some selected subjects are not offered for this school year and semester. Refresh the subject list and try again.',
            ], 422);
        }

        $subjectIds = $this->subjectIdsForApplication($request, $sectionSubjectIds);
        if ($request->academic_status === 'Regular' && empty($subjectIds)) {
            return response()->json([
                'message' => 'No regular subjects are available for this program and semester.',
            ], 422);
        }

        $prerequisiteMessage = $this->prerequisiteFailureMessage($subjectIds, $studentUser->id, $progression);
        if ($prerequisiteMessage) {
            return response()->json(['message' => $prerequisiteMessage], 422);
        }

        $documentUrls = $this->storeDocuments($request);

        $application = EnrollmentApplication::create([
            ...$request->except('password', 'password_confirmation', 'gender', 'course', 'subject_ids', 'section_subject_ids'),
            'course'   => $request->filled('course_id')
                ? Course::find($request->course_id)?->name
                : $request->course,
            'subject_ids' => $subjectIds,
            'section_subject_ids' => $sectionSubjectIds,
            'document_urls' => $documentUrls,
            'password' => $hashedPassword,
            'gender'   => $gender,
            'status'   => 'pending',
            'user_id'  => $studentUser->id,
        ]);

        if ($request->student_type === 'shiftee') {
            $pendingShift = CourseShiftRequest::query()
                ->where('user_id', $studentUser->id)
                ->where('status', CourseShiftRequest::STATUS_PENDING)
                ->exists();

            if (!$pendingShift) {
                CourseShiftRequest::create([
                    'user_id' => $studentUser->id,
                    'current_course_id' => $currentApprovedApplication?->course_id,
                    'requested_course_id' => $request->course_id,
                    'reason' => trim("Course shift from {$request->shiftee_from} to {$request->shiftee_to}"),
                    'school_year' => $request->school_year,
                    'semester' => strtolower($request->semester),
                    'status' => CourseShiftRequest::STATUS_PENDING,
                ]);
            }
        }

        return response()->json([
            'message'        => 'Application submitted successfully.',
            'application_id' => $application->id,
            'email'          => $application->email,
            'academic_status' => $application->academic_status,
            'irregular_due_to_failed_subjects' => $evaluation['requires_irregular'] ?? false,
        ], 201);
    }

    // GET /api/enrollment/status?email=xxx
    public function status(Request $request)
    {
        $request->validate(['email' => 'required|email']);

        $app = EnrollmentApplication::where('email', $request->email)
            ->select([
                'id', 'first_name', 'last_name', 'middle_name',
                'program_type', 'grade_level', 'strand',
                'course', 'year_level', 'student_type', 'academic_status',
                'school_year', 'semester',
                'status', 'remarks', 'reviewed_at', 'created_at',
            ])
            ->first();

        if (!$app) {
            return response()->json(['message' => 'No application found for this email.'], 404);
        }

        return response()->json($app);
    }

    public function prerequisiteStatus(Request $request, SemesterProgressionService $progression)
    {
        $data = $request->validate([
            'subject_ids' => ['required', 'array', 'max:200'],
            'subject_ids.*' => ['integer', 'distinct', 'exists:subjects,id'],
        ]);

        $student = Student::query()->where('user_id', $request->user()->id)->first();
        $subjects = Subject::query()
            ->with('prerequisites:id,code,name,program_type,semester')
            ->whereIn('id', $data['subject_ids'])
            ->get();

        return response()->json([
            'subjects' => $subjects->map(fn (Subject $subject) => [
                'subject_id' => $subject->id,
                'unmet_prerequisites' => $subject->prerequisites
                    ->filter(fn (Subject $prerequisite) => !$student || !$progression->studentPassedSubject($student, $prerequisite))
                    ->map(fn (Subject $prerequisite) => [
                        'code' => $prerequisite->code,
                        'name' => $prerequisite->name,
                    ])
                    ->values(),
            ])->values(),
        ]);
    }

    // GET /api/enrollment/lookup?id_no=xxx
    // Looks up a student by student_id from the students table first,
    // then falls back to enrollment_applications for extra details.
    public function lookup(Request $request)
    {
        $request->validate(['id_no' => 'required|string|max:50']);

        $idNo = trim($request->id_no);

        // 1. Search students table by student_id (exact match)
        $student = Student::where('student_id', $idNo)->first();

        // 2. Partial match — user typed just the number e.g. "14266"
        if (!$student) {
            $student = Student::where('student_id', 'like', '%' . $idNo)->first();
        }

        // 3. Match by email
        if (!$student && filter_var($idNo, FILTER_VALIDATE_EMAIL)) {
            $student = Student::where('email', $idNo)->first();
        }

        if (!$student) {
            return response()->json(['message' => 'No student found with that ID.'], 404);
        }

        // Pull extra details from their most recent approved application
        $app = EnrollmentApplication::where('user_id', $student->user_id)
            ->where('status', 'approved')
            ->latest()
            ->first();

        return response()->json([
            // From students table
            'student_id'          => $student->student_id,
            'has_account'         => (bool) $student->user_id,
            'account_name'        => trim("{$student->first_name} {$student->last_name}"),
            'first_name'          => $student->first_name,
            'last_name'           => $student->last_name,
            'email'               => $student->email,
            'phone'               => $student->phone,
            'birthdate'           => $student->birthdate,
            'gender'              => $student->gender,
            'address'             => $student->address,
            'grade_level'         => $student->grade_level,
            'school_year'         => $student->school_year,
            // Extra details from enrollment application (if available)
            'middle_name'         => $app?->middle_name,
            'religion'            => $app?->religion,
            'civil_status'        => $app?->civil_status,
            'citizenship'         => $app?->citizenship,
            'place_of_birth'      => $app?->place_of_birth,
            'father_name'         => $app?->father_name,
            'father_occupation'   => $app?->father_occupation,
            'mother_name'         => $app?->mother_name,
            'mother_occupation'   => $app?->mother_occupation,
            'parent_email'        => $app?->parent_email,
            'prev_school'         => $app?->prev_school,
            'prev_school_address' => $app?->prev_school_address,
            'student_type'        => $app?->student_type,
            'academic_status'     => $app?->academic_status,
            'program_type'        => $app?->program_type,
            'strand'              => $app?->strand,
            'course_id'           => $app?->course_id,
            'course'              => $app?->course,
            'year_level'          => $app?->year_level,
            'semester'            => $app?->semester,
        ]);
    }

    // ── REGISTRAR ────────────────────────────────────────────────

    // GET /api/registrar/enrollments
    public function index(Request $request)
    {
        $this->authorizeRegistrar($request);

        $query = EnrollmentApplication::latest();

        if ($request->filled('status'))       $query->where('status', $request->status);
        if ($request->filled('program_type')) $query->where('program_type', $request->program_type);
        if ($request->filled('search')) {
            $query->where(function ($q) use ($request) {
                $search = addcslashes($request->search, '%_');
                $q->where('first_name', 'like', "%{$search}%")
                  ->orWhere('last_name',  'like', "%{$search}%")
                  ->orWhere('email',      'like', "%{$search}%");
            });
        }

        return response()->json($query->get());
    }

    // GET /api/registrar/enrollments/{id}
    public function show(Request $request, $id)
    {
        $this->authorizeRegistrar($request);
        return response()->json(EnrollmentApplication::findOrFail($id));
    }

    // POST /api/registrar/enrollments/{id}/approve
    public function approve(Request $request, $id, PointsService $points, SemesterProgressionService $progression)
    {
        $this->authorizeRegistrar($request);
        $request->validate(['remarks' => 'nullable|string|max:500']);

        $app = EnrollmentApplication::findOrFail($id);

        if ($app->status !== 'pending') {
            return response()->json(['message' => 'Application already reviewed.'], 422);
        }

        if ($app->student_type === 'shiftee') {
            $shiftApproved = CourseShiftRequest::query()
                ->where('user_id', $app->user_id)
                ->where('requested_course_id', $app->course_id)
                ->where('school_year', $app->school_year)
                ->where('semester', $app->semester)
                ->where('status', CourseShiftRequest::STATUS_APPROVED)
                ->exists();

            if (!$shiftApproved) {
                return response()->json(['message' => 'Approve the course-shift request before approving this enrollment.'], 422);
            }
        }

        $progressionEvaluation = null;
        if (strtolower((string) $app->semester) === '2nd' && $app->student) {
            $progressionEvaluation = $progression->evaluateFirstSemester($app->student, $app->school_year);
            if (!$progressionEvaluation['can_proceed']) {
                return response()->json(['message' => $progressionEvaluation['message']], 422);
            }
        }

        $prerequisiteMessage = $this->prerequisiteFailureMessage(
            $app->subject_ids ?? [],
            $app->user_id,
            $progression
        );
        if ($prerequisiteMessage) {
            return response()->json(['message' => $prerequisiteMessage], 422);
        }

        if ($app->parent_email) {
            $existingParentUser = User::where('email', $app->parent_email)->first();
            if ($existingParentUser && $existingParentUser->role !== User::ROLE_PARENT && !$existingParentUser->hasRole(User::ROLE_PARENT)) {
                return response()->json(['message' => 'Parent email is already used by a non-parent account.'], 422);
            }
        }

        $studentId = $app->id_no ?: self::generateStudentId($app->id);
        $existingStudentById = Student::query()->where('student_id', $studentId)->first();
        $existingUser = User::query()->where('email', $app->email)->first();
        if ($existingStudentById?->user_id && !in_array((int) $existingStudentById->user_id, array_filter([
            (int) $app->user_id,
            (int) $existingUser?->id,
        ]), true)) {
            return response()->json(['message' => 'This student ID is already linked to another student account.'], 422);
        }

        $parentDefaultPassword = null;
        $academicStatus = ($progressionEvaluation['requires_irregular'] ?? false)
            ? 'Irregular'
            : $app->academic_status;

        DB::transaction(function () use ($app, $request, $points, &$parentDefaultPassword, $studentId, $academicStatus) {
            // Reuse existing user account if one already exists for this email
            $user = User::where('email', $app->email)->first();

            if (!$user) {
                $user = User::create([
                    'name'     => trim("{$app->first_name} {$app->last_name}"),
                    'email'    => $app->email,
                    'password' => $app->password, // already hashed
                    'role'     => 'student',
                ]);
                Role::findOrCreate('student', 'web');
                $user->assignRole('student');
            }

            $parent = null;
            if ($app->parent_email) {
                $parent = User::where('email', $app->parent_email)->first();

                if (!$parent) {
                    $parentDefaultPassword = 'parent-' . Str::lower(Str::random(8));
                    $parentName = $app->mother_name ?: $app->father_name ?: $app->parent_email;

                    $parent = User::create([
                        'name' => $parentName,
                        'email' => $app->parent_email,
                        'password' => Hash::make($parentDefaultPassword),
                        'role' => User::ROLE_PARENT,
                    ]);
                    Role::findOrCreate(User::ROLE_PARENT, 'web');
                    $parent->assignRole(User::ROLE_PARENT);
                }
            }

            $app->update([
                'status'      => 'approved',
                'academic_status' => $academicStatus,
                'remarks'     => $request->remarks,
                'user_id'     => $user->id,
                'reviewed_by' => $request->user()->id,
                'reviewed_at' => now(),
                'id_no'       => $studentId,
            ]);

            $section = $this->matchingSectionForApplication($app);

            // Sync to students table so grades/attendance/fees work
            $studentValues = [
                'student_id'  => $studentId,
                'first_name'  => $app->first_name,
                'last_name'   => $app->last_name,
                'email'       => $app->email,
                'phone'       => $app->contact_number,
                'birthdate'   => $app->birthdate,
                'gender'      => in_array($app->gender, ['male','female']) ? $app->gender : 'male',
                'address'     => $app->address,
                'father_name' => $app->father_name,
                'father_occupation' => $app->father_occupation,
                'mother_name' => $app->mother_name,
                'mother_occupation' => $app->mother_occupation,
                'prev_school' => $app->prev_school,
                'prev_school_address' => $app->prev_school_address,
                'student_type' => $app->student_type,
                'academic_status' => $academicStatus,
                'grade_level' => $app->program_type === 'college' ? $app->year_level : $app->grade_level,
                'section'     => $section?->name ?? 'TBA',
                'school_year' => $app->school_year,
                'status'      => 'active',
            ];

            if ($parent) {
                $studentValues['parent_user_id'] = $parent->id;
            }

            $student = Student::query()->where('user_id', $user->id)->first()
                ?? Student::query()->where('student_id', $studentId)->first()
                ?? new Student();
            $student->fill($studentValues + ['user_id' => $user->id]);
            $student->save();

            if ($section) {
                $section->students()->syncWithoutDetaching([
                    $user->id => ['status' => 'enrolled'],
                ]);
            }

            $this->activateStudentSubjects($app, $user->id);
            $this->awardEarlyEnrollmentIfEligible($app, $student, $points, $request->user());

            SchoolNotification::create([
                'user_id' => $user->id,
                'type' => 'enrollment_approved',
                'title' => 'Enrollment approved',
                'body' => 'Your enrollment application has been approved. You can now sign in.',
                'channels' => ['in_app'],
                'data' => ['enrollment_application_id' => $app->id],
            ]);
        });

        return response()->json([
            'message' => $parentDefaultPassword
                ? 'Application approved. Student and parent accounts were created.'
                : 'Application approved. Student account and record created.',
            'parent_default_password' => $parentDefaultPassword,
        ]);
    }

    // POST /api/registrar/enrollments/{id}/reject
    public function reject(Request $request, $id)
    {
        $this->authorizeRegistrar($request);
        $request->validate(['remarks' => 'required|string|max:500']);

        $app = EnrollmentApplication::findOrFail($id);

        if ($app->status !== 'pending') {
            return response()->json(['message' => 'Application already reviewed.'], 422);
        }

        $app->update([
            'status'      => 'rejected',
            'remarks'     => $request->remarks,
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
        ]);

        if ($app->user_id) {
            SchoolNotification::create([
                'user_id' => $app->user_id,
                'type' => 'enrollment_rejected',
                'title' => 'Enrollment rejected',
                'body' => $request->remarks,
                'channels' => ['in_app'],
                'data' => ['enrollment_application_id' => $app->id],
            ]);
        }

        return response()->json(['message' => 'Application rejected.']);
    }

    // POST /api/registrar/students — direct student creation (no approval flow)
    public function storeStudent(Request $request)
    {
        $this->authorizeRegistrar($request);

        $validator = Validator::make($request->all(), [
            'email'          => 'required|email|unique:users,email|unique:enrollment_applications,email',
            'password'       => 'required|string|min:8',
            'first_name'     => 'required|string|max:100',
            'last_name'      => 'required|string|max:100',
            'middle_name'    => 'nullable|string|max:100',
            'birthdate'      => 'nullable|date',
            'gender'         => 'nullable|in:male,female,other',
            'religion'       => 'nullable|string|max:100',
            'civil_status'   => 'nullable|string|max:50',
            'citizenship'    => 'nullable|string|max:100',
            'place_of_birth' => 'nullable|string|max:255',
            'contact_number' => 'nullable|string|max:20',
            'address'        => 'nullable|string|max:500',
            'father_name'        => 'nullable|string|max:255',
            'father_occupation'  => 'nullable|string|max:255',
            'mother_name'        => 'nullable|string|max:255',
            'mother_occupation'  => 'nullable|string|max:255',
            'parent_email'       => ['nullable', 'email', 'max:255', 'different:email'],
            'prev_school'         => 'nullable|string|max:255',
            'prev_school_address' => 'nullable|string|max:255',
            'student_type'    => 'nullable|in:new_student,old_student,transferee,returnee',
            'academic_status' => 'nullable|in:Regular,Irregular',
            'id_no'           => 'nullable|string|max:50',
            'program_type'    => 'required|in:shs,college',
            'course_id'       => 'nullable|exists:courses,id',
            'course'          => 'nullable|string|max:100',
            'year_level'      => 'nullable|in:1,2,3,4',
            'grade_level'     => 'nullable|in:11,12',
            'strand'          => 'nullable|in:STEM,ABM,HUMSS,TVL,GAS',
            'school_year'     => 'required|string|max:20',
            'semester'        => 'required|in:1st,2nd,summer',
            'subject_ids'     => 'nullable|array',
            'subject_ids.*'   => 'integer|exists:subjects,id',
            'section_subject_ids'   => 'nullable|array',
            'section_subject_ids.*' => 'integer|exists:section_subjects,id',
            'documents'       => 'nullable|array|max:10',
            'documents.*'     => 'file|mimes:pdf,doc,docx,jpg,jpeg,png|max:5120',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => $validator->errors()->first(),
                'errors'  => $validator->errors(),
            ], 422);
        }

        $sectionSubjectIds = $this->sectionSubjectIdsForApplication($request);
        $requestedSectionSubjectCount = collect($request->section_subject_ids ?? [])->map(fn ($id) => (int) $id)->unique()->count();
        if ($requestedSectionSubjectCount !== count($sectionSubjectIds)) {
            return response()->json([
                'message' => 'Some selected subjects are not offered for this school year and semester.',
            ], 422);
        }

        $subjectIds = $this->subjectIdsForApplication($request, $sectionSubjectIds);
        if ($request->academic_status === 'Regular' && empty($subjectIds)) {
            return response()->json([
                'message' => 'No regular subjects are available for this program and semester.',
            ], 422);
        }

        $documentUrls = $this->storeDocuments($request);

        if ($request->filled('parent_email')) {
            $existingParentUser = User::where('email', $request->parent_email)->first();
            if ($existingParentUser && $existingParentUser->role !== User::ROLE_PARENT && !$existingParentUser->hasRole(User::ROLE_PARENT)) {
                return response()->json(['message' => 'Parent email is already used by a non-parent account.'], 422);
            }
        }

        $parentDefaultPassword = null;

        DB::transaction(function () use ($request, $subjectIds, $sectionSubjectIds, $documentUrls, &$parentDefaultPassword) {
            // Create user account
            $user = User::create([
                'name'     => trim("{$request->first_name} {$request->last_name}"),
                'email'    => $request->email,
                'password' => Hash::make($request->password),
                'role'     => 'student',
            ]);
            Role::findOrCreate('student', 'web');
            $user->assignRole('student');

            $courseName = $request->filled('course_id')
                ? Course::find($request->course_id)?->name
                : $request->course;

            // Create an already-approved enrollment application so the student
            // appears in all enrollment records and can be looked up by id_no
            $app = EnrollmentApplication::create([
                'email'          => $request->email,
                'password'       => $user->password,
                'first_name'     => $request->first_name,
                'last_name'      => $request->last_name,
                'middle_name'    => $request->middle_name,
                'birthdate'      => $request->birthdate,
                'gender'         => $request->gender,
                'religion'       => $request->religion,
                'civil_status'   => $request->civil_status,
                'citizenship'    => $request->citizenship,
                'place_of_birth' => $request->place_of_birth,
                'contact_number' => $request->contact_number,
                'address'        => $request->address,
                'father_name'        => $request->father_name,
                'father_occupation'  => $request->father_occupation,
                'mother_name'        => $request->mother_name,
                'mother_occupation'  => $request->mother_occupation,
                'parent_email'       => $request->parent_email,
                'prev_school'         => $request->prev_school,
                'prev_school_address' => $request->prev_school_address,
                'student_type'    => $request->student_type ?? 'new_student',
                'academic_status' => $request->academic_status,
                'shiftee_from'    => $request->shiftee_from,
                'shiftee_to'      => $request->shiftee_to,
                'id_no'           => $request->id_no,
                'program_type'    => $request->program_type,
                'course_id'       => $request->course_id,
                'course'          => $courseName,
                'year_level'      => $request->year_level,
                'grade_level'     => $request->grade_level,
                'strand'          => $request->strand,
                'school_year'     => $request->school_year,
                'semester'        => $request->semester,
                'subject_ids'     => $subjectIds,
                'section_subject_ids' => $sectionSubjectIds,
                'document_urls'   => $documentUrls,
                // Pre-approved — no pending review needed
                'status'      => 'approved',
                'user_id'     => $user->id,
                'reviewed_by' => $request->user()->id,
                'reviewed_at' => now(),
            ]);

            // If no id_no was given, auto-generate one from the app id
            $studentId = $app->id_no ?: self::generateStudentId($app->id);
            if (!$app->id_no) {
                $app->update(['id_no' => $studentId]);
            }

            $parent = null;
            if ($request->filled('parent_email')) {
                $parent = User::where('email', $request->parent_email)->first();

                if (!$parent) {
                    $parentDefaultPassword = 'parent-' . Str::lower(Str::random(8));
                    $parentName = $request->mother_name ?: $request->father_name ?: $request->parent_email;

                    $parent = User::create([
                        'name' => $parentName,
                        'email' => $request->parent_email,
                        'password' => Hash::make($parentDefaultPassword),
                        'role' => User::ROLE_PARENT,
                    ]);
                    Role::findOrCreate(User::ROLE_PARENT, 'web');
                    $parent->assignRole(User::ROLE_PARENT);
                }
            }

            $section = $this->matchingSectionForApplication($app);

            // Sync to students table so grades/attendance/fees work
            $studentValues = [
                'student_id'  => $studentId,
                'first_name'  => $request->first_name,
                'last_name'   => $request->last_name,
                'email'       => $request->email,
                'phone'       => $request->contact_number,
                'birthdate'   => $request->birthdate,
                'gender'      => in_array($request->gender, ['male','female']) ? $request->gender : 'male',
                'address'     => $request->address,
                'grade_level' => $request->program_type === 'college' ? $request->year_level : $request->grade_level,
                'section'     => $section?->name ?? 'TBA',
                'school_year' => $request->school_year,
                'status'      => 'active',
            ];

            if ($parent) {
                $studentValues['parent_user_id'] = $parent->id;
            }

            Student::updateOrCreate(
                ['user_id' => $user->id],
                $studentValues
            );

            if ($section) {
                $section->students()->syncWithoutDetaching([
                    $user->id => ['status' => 'enrolled'],
                ]);
            }

            $this->activateStudentSubjects($app, $user->id);
        });

        return response()->json([
            'message' => 'Student created and enrolled successfully.',
            'parent_default_password' => $parentDefaultPassword,
        ], 201);
    }

    // ── PRIVATE ──────────────────────────────────────────────────

    /**
     * Generate a student ID in the format SCC-YY-XXXXXXXX
     * e.g. SCC-25-00014266
     *
     * You can change the prefix ('SCC') and year logic here.
     */
    private static function generateStudentId(int $appId): string
    {
        $prefix = 'SCC';
        $year   = date('y'); // 2-digit year, e.g. 25 for 2025
        $seq    = str_pad($appId, 8, '0', STR_PAD_LEFT); // 8-digit zero-padded
        return "{$prefix}-{$year}-{$seq}";
    }

    private function sectionSubjectIdsForApplication(Request $request): array
    {
        $semester = strtolower((string) $request->semester);

        return SectionSubject::query()
            ->whereIn('id', collect($request->section_subject_ids ?? [])->map(fn ($id) => (int) $id)->filter()->unique())
            ->whereHas('section', fn ($query) => $query
                ->where('school_year', $request->school_year)
                ->where('semester', $semester)
                ->where('is_active', true))
            ->whereHas('subject', fn ($query) => $query->where(function ($subjectQuery) use ($semester) {
                $subjectQuery->where('semester', $semester)
                    ->orWhereNull('semester')
                    ->orWhere('semester', '');
            }))
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->filter()
            ->unique()
            ->values()
            ->all();
    }

    private function subjectIdsForApplication(Request $request, array $sectionSubjectIds = []): array
    {
        if ($request->academic_status === 'Regular' && !empty($sectionSubjectIds)) {
            return SectionSubject::query()
                ->whereIn('id', $sectionSubjectIds)
                ->pluck('subject_id')
                ->map(fn ($id) => (int) $id)
                ->filter()
                ->unique()
                ->values()
                ->all();
        }

        if ($request->academic_status !== 'Regular') {
            if (!empty($sectionSubjectIds)) {
                return SectionSubject::query()
                    ->whereIn('id', $sectionSubjectIds)
                    ->pluck('subject_id')
                    ->map(fn ($id) => (int) $id)
                    ->filter()
                    ->unique()
                    ->values()
                    ->all();
            }

            return collect($request->subject_ids ?? [])
                ->map(fn ($id) => (int) $id)
                ->filter()
                ->unique()
                ->values()
                ->all();
        }

        $courseName = $request->filled('course_id')
            ? Course::find($request->course_id)?->name
            : $request->course;

        return Subject::query()
            ->where('program_type', $request->program_type)
            ->where('is_active', true)
            ->when($request->semester, fn ($query) => $query->where('semester', strtolower($request->semester)))
            ->when($request->program_type === 'college', function ($query) use ($request, $courseName) {
                $query->where('year_level', $request->year_level)
                    ->where(function ($courseQuery) use ($courseName) {
                        $courseQuery->where('course', $courseName)
                            ->orWhereNull('course')
                            ->orWhere('course', '');
                    });
            })
            ->when($request->program_type === 'shs', function ($query) use ($request) {
                $query->where('year_level', $request->grade_level)
                    ->where(function ($strandQuery) use ($request) {
                        $strandQuery->where('strand', $request->strand)
                            ->orWhereNull('strand')
                            ->orWhere('strand', '');
                    });
            })
            ->orderBy('code')
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->values()
            ->all();
    }

    private function enrollmentWindowMessage(string $schoolYear, string $semester): ?string
    {
        $term = AcademicTerm::where('school_year', $schoolYear)
            ->where('semester', $semester)
            ->first();

        if (!$term) {
            return 'Enrollment is closed until an administrator opens this academic term.';
        }

        if (!$term->is_active) {
            return 'Enrollment is closed for this academic term.';
        }

        if ($term->grade_finalization_deadline && now()->lt($term->grade_finalization_deadline)) {
            return 'Enrollment opens after grades are finalized on ' . $term->grade_finalization_deadline->toDateTimeString() . '.';
        }

        if ($term->enrollment_opens_at && now()->lt($term->enrollment_opens_at)) {
            return 'Enrollment opens on ' . $term->enrollment_opens_at->toDateTimeString() . '.';
        }

        if ($term->enrollment_closes_at && now()->gt($term->enrollment_closes_at)) {
            return 'Enrollment closed on ' . $term->enrollment_closes_at->toDateTimeString() . '.';
        }

        return null;
    }

    private function storeDocuments(Request $request): array
    {
        if (!$request->hasFile('documents')) {
            return [];
        }

        $urls = [];
        foreach ($request->file('documents') as $file) {
            $path = $file->store('enrollment-documents', 'public');
            $urls[] = [
                'name' => $file->getClientOriginalName(),
                'type' => $file->getClientMimeType(),
                'size' => $file->getSize(),
                'url' => url(Storage::url($path)),
            ];
        }

        return $urls;
    }

    private function activateStudentSubjects(EnrollmentApplication $app, int $userId): void
    {
        $sectionSubjectIds = collect($app->section_subject_ids ?? [])
            ->map(fn ($id) => (int) $id)
            ->filter()
            ->unique()
            ->values()
            ->all();

        if (!empty($sectionSubjectIds)) {
            SectionSubject::query()
                ->whereIn('id', $sectionSubjectIds)
                ->get()
                ->each(function (SectionSubject $sectionSubject) use ($userId) {
                    StudentSubject::updateOrCreate(
                        [
                            'user_id' => $userId,
                            'subject_id' => (int) $sectionSubject->subject_id,
                            'section_id' => (int) $sectionSubject->section_id,
                        ],
                        [
                            'status' => 'enrolled',
                            'drop_reason' => null,
                            'dropped_at' => null,
                            'dropped_by' => null,
                        ]
                    );
                });

            return;
        }

        foreach (($app->subject_ids ?? []) as $subjectId) {
            StudentSubject::updateOrCreate(
                [
                    'user_id' => $userId,
                    'subject_id' => (int) $subjectId,
                    'section_id' => null,
                ],
                [
                    'status' => 'enrolled',
                    'drop_reason' => null,
                    'dropped_at' => null,
                    'dropped_by' => null,
                ]
            );
        }
    }

    private function matchingSectionForApplication(EnrollmentApplication $app): ?Section
    {
        if ($app->academic_status !== 'Regular') {
            return null;
        }

        $sectionSubjectIds = collect($app->section_subject_ids ?? [])
            ->map(fn ($id) => (int) $id)
            ->filter()
            ->values()
            ->all();

        if (!empty($sectionSubjectIds)) {
            $selectedSectionIds = SectionSubject::query()
                ->whereIn('id', $sectionSubjectIds)
                ->pluck('section_id')
                ->unique()
                ->values();
            $selectedSectionId = $selectedSectionIds->count() === 1 ? $selectedSectionIds->first() : null;

            if ($selectedSectionId) {
                $section = Section::query()
                    ->where('is_active', true)
                    ->find($selectedSectionId);

                if ($section && (!$section->max_students || $section->students()->wherePivot('status', 'enrolled')->count() < $section->max_students)) {
                    return $section;
                }
            }
        }

        $sections = Section::query()
            ->where('is_active', true)
            ->where('program_type', $app->program_type)
            ->where('school_year', $app->school_year)
            ->where('semester', strtolower((string) $app->semester))
            ->when($app->program_type === 'college', function ($query) use ($app) {
                $query->where('year_level', $app->year_level)
                    ->where(function ($courseQuery) use ($app) {
                        $courseQuery->where('course', $app->course)
                            ->orWhereNull('course')
                            ->orWhere('course', '');
                    });
            })
            ->when($app->program_type === 'shs', function ($query) use ($app) {
                $query->where('year_level', $app->grade_level)
                    ->where(function ($strandQuery) use ($app) {
                        $strandQuery->where('strand', $app->strand)
                            ->orWhereNull('strand')
                            ->orWhere('strand', '');
                    });
            })
            ->get()
            ->filter(fn (Section $section) => $section->students()->wherePivot('status', 'enrolled')->count() < $section->max_students)
            ->values();

        return $sections->count() === 1 ? $sections->first() : null;
    }

    private function prerequisiteFailureMessage(array $subjectIds, ?int $userId, SemesterProgressionService $progression): ?string
    {
        $subjectIds = collect($subjectIds)->map(fn ($id) => (int) $id)->filter()->values();
        if ($subjectIds->isEmpty() || !$userId) {
            return null;
        }

        $student = Student::where('user_id', $userId)->first();
        $subjects = Subject::whereIn('id', $subjectIds)
            ->with('prerequisites')
            ->get();

        $missing = [];
        foreach ($subjects as $subject) {
            foreach ($subject->prerequisites as $prerequisite) {
                if (!$student || !$progression->studentPassedSubject($student, $prerequisite)) {
                    $missing[] = "{$subject->code} requires {$prerequisite->code}";
                }
            }
        }

        if ($missing && !$student) {
            return 'Prerequisite completion cannot be verified because your student record is unavailable. Please contact the Registrar.';
        }

        return empty($missing)
            ? null
            : 'Prerequisite check failed: ' . implode('; ', array_unique($missing)) . '. Select Irregular and remove those subjects to continue.';
    }

    private function awardEarlyEnrollmentIfEligible(EnrollmentApplication $app, Student $student, PointsService $points, ?User $awardedBy = null): void
    {
        $term = AcademicTerm::where('school_year', $app->school_year)
            ->where('semester', strtolower((string) $app->semester))
            ->first();

        if (!$term?->enrollment_opens_at) {
            return;
        }

        $earlyWindowEnds = $term->enrollment_opens_at->copy()->addDays(7);
        if ($app->created_at && $app->created_at->greaterThan($earlyWindowEnds)) {
            return;
        }

        $points->awardVerifiedPoints($student, [
            'source' => 'early_enrollment',
            'source_key' => "early-enrollment:{$student->id}:{$app->school_year}:{$app->semester}",
            'title' => 'Early enrollment bonus',
            'description' => 'Enrollment submitted during the early enrollment window.',
            'points' => 30,
            'school_year' => $app->school_year,
            'semester' => $app->semester,
            'meta' => ['enrollment_application_id' => $app->id],
        ], $awardedBy);
    }

    private function authorizeRegistrar(Request $request)
    {
        $user = $request->user();
        if (!$user || !$user->hasAnyRole(['registrar', 'admin'])) {
            abort(403, 'Unauthorized.');
        }
    }
}
