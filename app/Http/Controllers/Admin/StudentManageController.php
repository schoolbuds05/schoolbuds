<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\EnrollmentApplication;
use App\Models\Section;
use App\Models\Student;
use App\Models\Grade;
use App\Models\Attendance;
use App\Models\Fee;
use App\Models\StudentReward;
use App\Models\StudentSubject;
use App\Models\Subject;
use App\Services\PointsService;
use Illuminate\Http\Request;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class StudentManageController extends Controller
{
    public function index(Request $request)
    {
        $students = Student::query()
            ->with('user:id,name,profile_photo_path')
            ->when($request->search, fn($q) =>
                $q->where('first_name', 'like', "%{$request->search}%")
                  ->orWhere('last_name', 'like', "%{$request->search}%")
                  ->orWhere('student_id', 'like', "%{$request->search}%")
            )
            ->when($request->filled('year_level'), fn($q) =>
                $q->where('grade_level', $request->year_level)
            )
            ->when($request->filled('school_year'), fn($q) =>
                $q->where('school_year', $request->school_year)
            )
            ->when($request->filled('course'), function ($q) use ($request) {
                $q->whereExists(function ($exists) use ($request) {
                    $exists->from('enrollment_applications')
                        ->where(function ($subQuery) {
                            $subQuery->whereColumn('enrollment_applications.user_id', 'students.user_id')
                                ->orWhereColumn('enrollment_applications.id_no', 'students.student_id');
                        })
                        ->where(function ($inner) use ($request) {
                            $inner->where('enrollment_applications.course', $request->course)
                                ->orWhere('enrollment_applications.strand', $request->course);
                        });
                });
            })
            ->latest()
            ->paginate(15)
            ->withQueryString();

        $yearLevels = Student::query()
            ->whereNotNull('grade_level')
            ->where('grade_level', '!=', '')
            ->distinct()
            ->orderByRaw('CAST(grade_level AS UNSIGNED) ASC')
            ->pluck('grade_level');

        $schoolYears = Student::query()
            ->whereNotNull('school_year')
            ->where('school_year', '!=', '')
            ->distinct()
            ->orderByDesc('school_year')
            ->pluck('school_year');

        $courseOptions = EnrollmentApplication::query()
            ->whereNotNull('course')
            ->where('course', '!=', '')
            ->orWhere(function ($query) {
                $query->whereNotNull('strand')->where('strand', '!=', '');
            })
            ->distinct()
            ->orderBy('course')
            ->get(['course', 'strand'])
            ->flatMap(function ($application) {
                $values = [];
                if ($application->course) $values[] = $application->course;
                if ($application->strand) $values[] = $application->strand;
                return $values;
            })
            ->unique()
            ->values();

        $routePrefix = $request->routeIs('registrar.*') ? 'registrar' : 'admin';

        return view('admin.students.index', compact('students', 'routePrefix', 'yearLevels', 'schoolYears', 'courseOptions'));
    }

    public function template()
    {
        $headers = $this->studentCsvHeaders();
        $rows = [
            $headers,
            array_replace(array_fill_keys($headers, ''), [
                'student_id' => 'ST-001',
                'first_name' => 'Jane',
                'last_name' => 'Doe',
                'middle_name' => 'Sample',
                'birthdate' => '2009-04-01',
                'gender' => 'female',
                'address' => 'Sample Address',
                'father_name' => 'Juan Doe',
                'mother_name' => 'Maria Doe',
                'student_type' => 'new_student',
                'academic_status' => 'Regular',
                'program_type' => 'shs',
                'grade_level' => '11',
                'strand' => 'STEM',
                'school_year' => '2026-2027',
                'semester' => '1st',
                'section' => 'Section A',
                'status' => 'active',
                'application_status' => 'approved',
            ]),
        ];

        return $this->downloadCsv($rows, 'students-template.csv');
    }

    public function export()
    {
        $headers = $this->studentCsvHeaders();
        $rows = [$headers];

        Student::query()->orderBy('last_name')->orderBy('first_name')->each(function (Student $student) use (&$rows, $headers) {
            $application = $this->applicationForStudent($student);
            $data = [
                'student_id' => $student->student_id,
                'first_name' => $student->first_name,
                'last_name' => $student->last_name,
                'middle_name' => $application?->middle_name,
                'birthdate' => $student->birthdate,
                'gender' => $application?->gender ?: $student->gender,
                'religion' => $application?->religion,
                'civil_status' => $application?->civil_status,
                'citizenship' => $application?->citizenship,
                'place_of_birth' => $application?->place_of_birth,
                'contact_number' => $student->phone ?: $application?->contact_number,
                'address' => $student->address,
                'father_name' => $student->father_name ?: $application?->father_name,
                'father_occupation' => $student->father_occupation ?: $application?->father_occupation,
                'mother_name' => $student->mother_name ?: $application?->mother_name,
                'mother_occupation' => $student->mother_occupation ?: $application?->mother_occupation,
                'parent_email' => $application?->parent_email ?: $student->parent?->email,
                'prev_school' => $student->prev_school ?: $application?->prev_school,
                'prev_school_address' => $student->prev_school_address ?: $application?->prev_school_address,
                'student_type' => $student->student_type ?: $application?->student_type,
                'academic_status' => $student->academic_status ?: $application?->academic_status,
                'shiftee_from' => $application?->shiftee_from,
                'shiftee_to' => $application?->shiftee_to,
                'id_no' => $application?->id_no ?: $student->student_id,
                'program_type' => $application?->program_type ?: (in_array((string) $student->grade_level, ['11', '12'], true) ? 'shs' : 'college'),
                'course_id' => $application?->course_id,
                'course' => $application?->course,
                'year_level' => $application?->year_level ?: (!in_array((string) $student->grade_level, ['11', '12'], true) ? $student->grade_level : ''),
                'grade_level' => $application?->grade_level ?: $student->grade_level,
                'strand' => $application?->strand,
                'school_year' => $student->school_year ?: $application?->school_year,
                'semester' => $application?->semester ?: '1st',
                'subject_ids' => json_encode($application?->subject_ids ?? []),
                'section_subject_ids' => json_encode($application?->section_subject_ids ?? []),
                'document_urls' => json_encode($application?->document_urls ?? []),
                'section' => $student->section,
                'status' => $student->status,
                'application_status' => $application?->status,
                'remarks' => $application?->remarks,
            ];

            $rows[] = array_map(fn ($header) => $data[$header] ?? '', $headers);
        });

        return $this->downloadCsv($rows, 'students-export.csv');
    }

    public function import(Request $request)
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt', 'max:10240'],
        ]);

        $handle = fopen($request->file('file')->getRealPath(), 'r');
        if ($handle === false) {
            return back()->withErrors(['file' => 'The CSV file could not be read.']);
        }

        $headers = fgetcsv($handle);
        if (!$headers) {
            fclose($handle);
            return back()->withErrors(['file' => 'The CSV file is empty or missing its header row.']);
        }

        $headers = array_map(fn ($header) => strtolower(trim(ltrim((string) $header, "\xEF\xBB\xBF"))), $headers);
        $required = ['student_id', 'first_name', 'last_name', 'program_type', 'school_year', 'semester'];
        $missing = array_values(array_diff($required, $headers));
        if ($missing) {
            fclose($handle);
            return back()->withErrors(['file' => 'Missing required columns: ' . implode(', ', $missing)]);
        }

        $rows = [];
        $rowNumber = 1;
        while (($values = fgetcsv($handle)) !== false) {
            $rowNumber++;
            if ($values === [null] || (count($values) === 1 && trim((string) $values[0]) === '')) {
                continue;
            }

            $row = [];
            foreach ($headers as $index => $header) {
                $row[$header] = trim((string) ($values[$index] ?? ''));
            }
            $row += [
                'middle_name' => '',
                'birthdate' => '',
                'gender' => '',
                'religion' => '',
                'civil_status' => '',
                'citizenship' => '',
                'place_of_birth' => '',
                'contact_number' => '',
                'address' => '',
                'father_name' => '',
                'father_occupation' => '',
                'mother_name' => '',
                'mother_occupation' => '',
                'parent_email' => '',
                'prev_school' => '',
                'prev_school_address' => '',
                'student_type' => '',
                'academic_status' => '',
                'shiftee_from' => '',
                'shiftee_to' => '',
                'id_no' => '',
                'course_id' => '',
                'course' => '',
                'year_level' => '',
                'grade_level' => '',
                'strand' => '',
                'semester' => '',
                'subject_ids' => '[]',
                'section_subject_ids' => '[]',
                'document_urls' => '[]',
                'section' => 'TBA',
                'status' => '',
                'application_status' => 'approved',
                'remarks' => '',
            ];

            $row['grade_level'] = $row['grade_level'] ?: ($row['program_type'] === 'college' ? $row['year_level'] : '');
            $row['id_no'] = $row['id_no'] ?: $row['student_id'];
            $row['gender'] = $row['gender'] ?: 'male';
            $row['status'] = $row['status'] ?: 'active';
            $row['application_status'] = $row['application_status'] ?: 'approved';
            $row['section'] = $row['section'] ?: 'TBA';

            if ($row['birthdate'] !== '') {
                $row['birthdate'] = $this->normalizeCsvBirthdate($row['birthdate']);
                if ($row['birthdate'] === null) {
                    fclose($handle);
                    return back()->withErrors(['file' => "Row {$rowNumber}: birthdate must use YYYY-MM-DD or MM/DD/YYYY format."]);
                }
            }

            if (preg_match('/^[+-]?\d+(?:\.\d+)?[eE][+-]?\d+$/', $row['contact_number'])) {
                fclose($handle);
                return back()->withErrors(['file' => "Row {$rowNumber}: contact number is in scientific notation. Format that spreadsheet column as text and export the CSV again."]);
            }

            foreach ([
                'middle_name', 'birthdate', 'religion', 'civil_status', 'citizenship',
                'place_of_birth', 'contact_number', 'address', 'father_name',
                'father_occupation', 'mother_name', 'mother_occupation', 'parent_email',
                'prev_school', 'prev_school_address', 'student_type', 'academic_status',
                'shiftee_from', 'shiftee_to', 'course_id', 'course', 'year_level',
                'strand', 'remarks',
            ] as $optionalField) {
                if ($row[$optionalField] === '') {
                    $row[$optionalField] = null;
                }
            }

            foreach (['subject_ids', 'section_subject_ids', 'document_urls'] as $jsonField) {
                $row[$jsonField] = $row[$jsonField] ?: '[]';
                $decoded = json_decode($row[$jsonField], true);
                if (!is_array($decoded)) {
                    fclose($handle);
                    return back()->withErrors(['file' => "Row {$rowNumber}: {$jsonField} must contain a valid JSON array."]);
                }
                $row[$jsonField] = $decoded;
            }

            $existingStudent = Student::query()->where('student_id', $row['student_id'])->first();

            $validator = validator($row, [
                'student_id' => ['required', 'string', 'max:255'],
                'first_name' => ['required', 'string', 'max:255'],
                'last_name' => ['required', 'string', 'max:255'],
                'middle_name' => ['nullable', 'string', 'max:100'],
                'birthdate' => ['nullable', 'date'],
                'gender' => ['required', 'in:male,female,other'],
                'religion' => ['nullable', 'string', 'max:100'],
                'civil_status' => ['nullable', 'string', 'max:50'],
                'citizenship' => ['nullable', 'string', 'max:100'],
                'place_of_birth' => ['nullable', 'string', 'max:255'],
                'contact_number' => ['nullable', 'string', 'max:20'],
                'address' => ['nullable', 'string', 'max:500'],
                'father_name' => ['nullable', 'string', 'max:255'],
                'father_occupation' => ['nullable', 'string', 'max:255'],
                'mother_name' => ['nullable', 'string', 'max:255'],
                'mother_occupation' => ['nullable', 'string', 'max:255'],
                'parent_email' => ['nullable', 'email', 'max:255'],
                'prev_school' => ['nullable', 'string', 'max:255'],
                'prev_school_address' => ['nullable', 'string', 'max:255'],
                'student_type' => ['nullable', 'in:new_student,old_student,transferee,shiftee,returnee'],
                'academic_status' => ['nullable', 'in:Regular,Irregular'],
                'shiftee_from' => ['nullable', 'string', 'max:255'],
                'shiftee_to' => ['nullable', 'string', 'max:255'],
                'id_no' => ['nullable', 'string', 'max:50'],
                'program_type' => ['required', 'in:shs,college'],
                'course_id' => ['nullable', 'integer', 'exists:courses,id'],
                'course' => ['nullable', 'string', 'max:100'],
                'year_level' => ['nullable', 'in:1,2,3,4'],
                'grade_level' => ['required', 'string', 'max:255'],
                'strand' => ['nullable', 'in:STEM,ABM,HUMSS,TVL,GAS'],
                'section' => ['required', 'string', 'max:255'],
                'school_year' => ['required', 'string', 'max:255'],
                'semester' => ['required', 'in:1st,2nd,summer'],
                'status' => ['nullable', 'in:active,inactive,graduated'],
                'application_status' => ['nullable', 'in:pending,approved,rejected'],
                'remarks' => ['nullable', 'string', 'max:5000'],
            ]);

            if ($validator->fails()) {
                fclose($handle);
                return back()->withErrors(['file' => "Row {$rowNumber}: " . $validator->errors()->first()]);
            }

            $row['_existing_student_id'] = $existingStudent?->id;
            $rows[] = $row;
        }
        fclose($handle);

        if (!$rows) {
            return back()->withErrors(['file' => 'The CSV contains no student rows.']);
        }

        $seenStudentIds = [];
        foreach ($rows as $index => $row) {
            if (isset($seenStudentIds[$row['student_id']])) {
                return back()->withErrors(['file' => 'The CSV contains duplicate student IDs.']);
            }
            $seenStudentIds[$row['student_id']] = true;

            foreach (['subject_ids' => Subject::class, 'section_subject_ids' => \App\Models\SectionSubject::class] as $field => $model) {
                $ids = array_values(array_unique(array_filter(array_map('intval', $row[$field]))));
                if ($ids && $model::query()->whereIn('id', $ids)->count() !== count($ids)) {
                    return back()->withErrors(['file' => "A row contains invalid {$field}; use IDs from this school system."]);
                }
                $rows[$index][$field] = $ids;
            }
        }

        DB::transaction(function () use ($rows) {
            foreach ($rows as $row) {
                $student = $row['_existing_student_id']
                    ? Student::findOrFail($row['_existing_student_id'])
                    : new Student();
                $studentGradeLevel = $row['program_type'] === 'college'
                    ? ($row['year_level'] ?: $row['grade_level'])
                    : $row['grade_level'];

                $student->fill([
                    'student_id' => $row['student_id'],
                    'first_name' => $row['first_name'],
                    'last_name' => $row['last_name'],
                    'email' => $student->email,
                    'phone' => $row['contact_number'] ?: null,
                    'birthdate' => $row['birthdate'] ?: null,
                    'gender' => in_array($row['gender'], ['male', 'female'], true) ? $row['gender'] : 'male',
                    'address' => $row['address'] ?: null,
                    'father_name' => $row['father_name'] ?: null,
                    'father_occupation' => $row['father_occupation'] ?: null,
                    'mother_name' => $row['mother_name'] ?: null,
                    'mother_occupation' => $row['mother_occupation'] ?: null,
                    'prev_school' => $row['prev_school'] ?: null,
                    'prev_school_address' => $row['prev_school_address'] ?: null,
                    'student_type' => $row['student_type'] ?: null,
                    'academic_status' => $row['academic_status'] ?: null,
                    'grade_level' => $studentGradeLevel,
                    'section' => $row['section'] ?: 'TBA',
                    'school_year' => $row['school_year'],
                    'status' => $row['status'],
                ])->save();

                $application = $this->applicationForStudent($student) ?? new EnrollmentApplication();
                $application->fill([
                    'email' => $application->email,
                    'password' => $application->password,
                    'first_name' => $row['first_name'],
                    'last_name' => $row['last_name'],
                    'middle_name' => $row['middle_name'] ?: null,
                    'birthdate' => $row['birthdate'] ?: null,
                    'gender' => $row['gender'],
                    'religion' => $row['religion'] ?: null,
                    'civil_status' => $row['civil_status'] ?: null,
                    'citizenship' => $row['citizenship'] ?: null,
                    'place_of_birth' => $row['place_of_birth'] ?: null,
                    'contact_number' => $row['contact_number'] ?: null,
                    'address' => $row['address'] ?: null,
                    'father_name' => $row['father_name'] ?: null,
                    'father_occupation' => $row['father_occupation'] ?: null,
                    'mother_name' => $row['mother_name'] ?: null,
                    'mother_occupation' => $row['mother_occupation'] ?: null,
                    'parent_email' => $row['parent_email'] ?: null,
                    'prev_school' => $row['prev_school'] ?: null,
                    'prev_school_address' => $row['prev_school_address'] ?: null,
                    'student_type' => $row['student_type'] ?: null,
                    'academic_status' => $row['academic_status'] ?: null,
                    'shiftee_from' => $row['shiftee_from'] ?: null,
                    'shiftee_to' => $row['shiftee_to'] ?: null,
                    'id_no' => $row['id_no'] ?: $row['student_id'],
                    'program_type' => $row['program_type'],
                    'course_id' => $row['course_id'] ?: null,
                    'course' => $row['course'] ?: null,
                    'year_level' => $row['year_level'] ?: null,
                    'grade_level' => $row['grade_level'] ?: null,
                    'strand' => $row['strand'] ?: null,
                    'school_year' => $row['school_year'],
                    'semester' => $row['semester'],
                    'subject_ids' => $row['subject_ids'],
                    'section_subject_ids' => $row['section_subject_ids'],
                    'document_urls' => $row['document_urls'],
                    'status' => $row['application_status'],
                    'remarks' => $row['remarks'] ?: null,
                    'user_id' => $student->user_id,
                    'reviewed_by' => in_array($row['application_status'], ['approved', 'rejected'], true)
                        ? ($application->reviewed_by ?: auth()->id())
                        : null,
                    'reviewed_at' => in_array($row['application_status'], ['approved', 'rejected'], true)
                        ? ($application->reviewed_at ?: now())
                        : null,
                ]);
                $application->save();
            }
        });

        $routePrefix = $request->routeIs('registrar.*') ? 'registrar' : 'admin';

        return redirect()->route($routePrefix . '.students.index')
            ->with('status', count($rows) . ' student record(s) imported successfully.');
    }

    private function downloadCsv(array $rows, string $filename)
    {
        $stream = fopen('php://temp', 'r+');
        foreach ($rows as $row) {
            fputcsv($stream, array_map(function ($value) {
                $value = (string) ($value ?? '');
                return preg_match('/^[=+@\-]/', $value) ? "'{$value}" : $value;
            }, $row));
        }
        rewind($stream);
        $csv = stream_get_contents($stream);
        fclose($stream);

        return response($csv, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ]);
    }

    private function normalizeCsvBirthdate(string $value): ?string
    {
        foreach (['!Y-m-d', '!m/d/Y', '!n/j/Y', '!m-d-Y', '!n-j-Y'] as $format) {
            $date = \DateTimeImmutable::createFromFormat($format, $value);
            $errors = \DateTimeImmutable::getLastErrors();

            if ($date && (!$errors || ($errors['warning_count'] === 0 && $errors['error_count'] === 0))) {
                return $date->format('Y-m-d');
            }
        }

        return null;
    }

    private function studentCsvHeaders(): array
    {
        return [
            'student_id', 'first_name', 'last_name', 'middle_name', 'birthdate', 'gender',
            'religion', 'civil_status', 'citizenship', 'place_of_birth', 'contact_number', 'address',
            'father_name', 'father_occupation', 'mother_name', 'mother_occupation',
            'parent_email', 'prev_school', 'prev_school_address', 'student_type', 'academic_status', 'shiftee_from', 'shiftee_to',
            'id_no', 'program_type', 'course_id', 'course', 'year_level', 'grade_level', 'strand',
            'school_year', 'semester', 'subject_ids', 'section_subject_ids', 'document_urls',
            'section', 'status', 'application_status', 'remarks',
        ];
    }

    private function applicationForStudent(Student $student): ?EnrollmentApplication
    {
        return EnrollmentApplication::query()
            ->when($student->user_id, fn ($query, $userId) => $query->where('user_id', $userId))
            ->when(!$student->user_id, fn ($query) => $query->where('id_no', $student->student_id))
            ->latest()
            ->first();
    }

    public function show(Request $request, Student $student, PointsService $pointsService)
    {
        $gradeRecords = Grade::where('student_id', $student->id)
            ->with('schoolClass')
            ->get();

        $fees = Fee::where('student_id', $student->id)->get();
        $pointRecords = StudentReward::query()
            ->where('student_id', $student->id)
            ->with('awardedBy:id,name')
            ->latest()
            ->get();
        $pointSummary = $pointsService->summaryFor($student);

        $attendance = Attendance::where('student_id', $student->id)->get();

        $attendancePct = $attendance->count() > 0
            ? round(($attendance->where('status', 'present')->count() / $attendance->count()) * 100, 1)
            : 0;

        $application = $this->applicationForStudent($student);
        $subjects = $this->subjectsForStudent($student, $application);

        $routePrefix = $request->routeIs('registrar.*') ? 'registrar' : 'admin';

        return view('admin.students.show', compact('student', 'gradeRecords', 'fees', 'pointRecords', 'pointSummary', 'attendance', 'attendancePct', 'routePrefix', 'subjects'));
    }

    public function update(Request $request, Student $student)
    {
        $data = $request->validate([
            'student_id' => ['required', 'string', 'max:255', Rule::unique('students', 'student_id')->ignore($student->id)],
            'first_name' => ['required', 'string', 'max:255'],
            'last_name' => ['required', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255', Rule::unique('students', 'email')->ignore($student->id), Rule::unique('users', 'email')->ignore($student->user_id)],
            'phone' => ['nullable', 'string', 'max:50'],
            'birthdate' => ['nullable', 'date'],
            'gender' => ['required', 'in:male,female'],
            'address' => ['nullable', 'string', 'max:500'],
            'father_name' => ['nullable', 'string', 'max:255'],
            'father_occupation' => ['nullable', 'string', 'max:255'],
            'mother_name' => ['nullable', 'string', 'max:255'],
            'mother_occupation' => ['nullable', 'string', 'max:255'],
            'prev_school' => ['nullable', 'string', 'max:255'],
            'prev_school_address' => ['nullable', 'string', 'max:255'],
            'student_type' => ['nullable', 'in:new_student,old_student,transferee,returnee'],
            'academic_status' => ['nullable', 'in:Regular,Irregular'],
            'grade_level' => ['required', 'string', 'max:255'],
            'section' => ['required', 'string', 'max:255'],
            'school_year' => ['required', 'string', 'max:255'],
            'status' => ['required', 'in:active,inactive,graduated'],
        ]);

        $student->update($data);

        $application = $this->applicationForStudent($student);

        if ($application) {
            $application->update(collect($data)->only([
                'father_name',
                'father_occupation',
                'mother_name',
                'mother_occupation',
                'prev_school',
                'prev_school_address',
                'student_type',
                'academic_status',
            ])->all());
        }

        if ($student->user) {
            $userValues = [
                'name' => trim($data['first_name'] . ' ' . $data['last_name']),
            ];
            if (!empty($data['email'])) {
                $userValues['email'] = $data['email'];
            }
            $student->user->update($userValues);
        }

        return back()->with('status', 'Student information updated.');
    }

    public function updateParent(Request $request, Student $student)
    {
        $data = $request->validate([
            'parent_email' => ['nullable', 'email'],
        ]);

        $parentId = null;
        $parentEmail = trim((string) ($data['parent_email'] ?? ''));

        if ($parentEmail !== '') {
            $parent = User::where('email', $parentEmail)->first();

            if (!$parent || ($parent->role !== User::ROLE_PARENT && !$parent->hasRole(User::ROLE_PARENT))) {
                return back()
                    ->withErrors(['parent_email' => 'Parent email must belong to a parent account.'])
                    ->withInput();
            }

            $parentId = $parent->id;
        }

        $student->update(['parent_user_id' => $parentId]);

        return back()->with('status', $parentId ? 'Parent account linked.' : 'Parent account unlinked.');
    }

    public function storeFee(Request $request, Student $student)
    {
        $data = $request->validate([
            'type'        => ['required', 'string', 'max:255'],
            'amount'      => ['required', 'numeric', 'min:1'],
            'due_date'    => ['required', 'date'],
            'school_year' => ['required', 'string', 'max:255'],
            'semester'    => ['nullable', 'in:1st,2nd,summer'],
            'quarter'     => ['nullable', 'in:1,2,3,4'],
            'notes'       => ['nullable', 'string', 'max:1000'],
        ]);

        $student->fees()->create($data);

        return back()->with('status', 'Tuition fee posted.');
    }

    public function markFeePaid(Request $request, Student $student, Fee $fee, PointsService $points)
    {
        abort_unless((int) $fee->student_id === (int) $student->id, 404);

        $data = $request->validate([
            'amount' => ['nullable', 'numeric', 'min:1'],
            'payment_method' => ['required', 'in:cash,gcash,qrph,bank_transfer'],
            'payment_reference' => ['nullable', 'string', 'max:100'],
        ]);

        $remaining = max(0, (float) $fee->amount - (float) $fee->paid_amount);
        if ($remaining <= 0) {
            return back()->with('status', 'This fee is already paid.');
        }

        $paidAmount = min((float) ($data['amount'] ?? $remaining), $remaining);
        $newPaidAmount = (float) $fee->paid_amount + $paidAmount;
        $status = $newPaidAmount >= (float) $fee->amount ? 'paid' : 'partial';

        $fee->update([
            'paid_amount' => $newPaidAmount,
            'status' => $status,
            'paid_date' => $status === 'paid' ? now() : $fee->paid_date,
            'payment_method' => $data['payment_method'],
            'payment_reference' => $data['payment_reference'] ?? $fee->payment_reference,
            'paid_by' => auth()->id(),
            'verified_by' => auth()->id(),
            'payment_verified_at' => now(),
        ]);

        if ($status === 'paid' && $fee->fresh()->paid_date && $fee->fresh()->due_date && $fee->fresh()->paid_date->lte($fee->fresh()->due_date)) {
            $points->awardVerifiedPoints($student, [
                'source' => 'early_payment',
                'source_key' => "early-payment:fee:{$fee->id}",
                'title' => 'Early tuition payment bonus',
                'description' => "Paid {$fee->type} on or before the due date.",
                'points' => (int) $points->rule('early_payment_early_points'),
                'school_year' => $fee->school_year,
                'semester' => $fee->semester,
                'meta' => ['fee_id' => $fee->id],
            ], auth()->user());
        }

        return back()->with('status', $status === 'paid' ? 'Fee marked as paid.' : 'Partial payment recorded.');
    }

    private function subjectsForStudent(Student $student, ?EnrollmentApplication $application): array
    {
        $overrides = StudentSubject::query()
            ->where('user_id', $student->user_id)
            ->get()
            ->keyBy(fn (StudentSubject $record) => $this->subjectOverrideKey($record->section_id, $record->subject_id));
        $droppedSubjectIds = StudentSubject::query()
            ->where('user_id', $student->user_id)
            ->where('status', 'dropped')
            ->pluck('subject_id')
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        $sectionSubjects = Section::query()
            ->whereHas('students', function ($query) use ($student) {
                $query->where('users.id', $student->user_id)
                    ->where('section_students.status', 'enrolled');
            })
            ->with(['sectionSubjects.subject', 'sectionSubjects.teacher:id,name'])
            ->get()
            ->flatMap(fn (Section $section) => $section->sectionSubjects
                ->filter(fn ($sectionSubject) => ($overrides->get($this->subjectOverrideKey($section->id, $sectionSubject->subject?->id))?->status ?? 'enrolled') !== 'dropped'
                    && ($overrides->get($this->subjectOverrideKey(null, $sectionSubject->subject?->id))?->status ?? 'enrolled') !== 'dropped')
                ->map(function ($sectionSubject) use ($section, $overrides) {
                $override = $overrides->get($this->subjectOverrideKey($section->id, $sectionSubject->subject?->id));

                return [
                    'id' => $sectionSubject->subject?->id,
                    'section_name' => $section->name,
                    'school_year' => $section->school_year,
                    'program_type' => $section->program_type,
                    'code' => $sectionSubject->subject?->code,
                    'name' => $sectionSubject->subject?->name,
                    'units' => (int) ($sectionSubject->subject?->units_lec ?? 0) + (int) ($sectionSubject->subject?->units_lab ?? 0),
                    'teacher' => $sectionSubject->teacher?->name,
                    'schedule' => trim(collect([$sectionSubject->day, trim(($sectionSubject->time_start ?: '') . '-' . ($sectionSubject->time_end ?: '')), $sectionSubject->room])->filter()->join(' · ')),
                    'source' => 'section',
                    'status' => $override?->status ?? 'enrolled',
                    'drop_reason' => $override?->drop_reason,
                ];
            }));

        $sectionSubjectIds = $sectionSubjects->pluck('id')->filter()->unique()->all();
        $directSubjectIds = collect($application?->subject_ids ?? [])
            ->map(fn ($id) => (int) $id)
            ->filter(fn ($id) => $id > 0 && !in_array($id, $sectionSubjectIds, true))
            ->diff($droppedSubjectIds)
            ->unique()
            ->values();

        $directSubjects = Subject::query()
            ->whereIn('id', $directSubjectIds)
            ->orderBy('code')
            ->get()
            ->map(function (Subject $subject) use ($overrides, $application) {
                $override = $overrides->get($this->subjectOverrideKey(null, $subject->id));

                return [
                    'id' => $subject->id,
                    'section_name' => 'Direct enrollment',
                    'school_year' => $application?->school_year,
                    'program_type' => $application?->program_type,
                    'code' => $subject->code,
                    'name' => $subject->name,
                    'units' => (int) ($subject->units_lec ?? 0) + (int) ($subject->units_lab ?? 0),
                    'teacher' => null,
                    'schedule' => '',
                    'source' => 'enrollment',
                    'status' => $override?->status ?? 'enrolled',
                    'drop_reason' => $override?->drop_reason,
                ];
            });

        return $sectionSubjects
            ->concat($directSubjects)
            ->filter(fn ($subject) => $subject['id'])
            ->values()
            ->all();
    }

    private function subjectOverrideKey(?int $sectionId, ?int $subjectId): string
    {
        return ($sectionId ?? 'direct') . ':' . ($subjectId ?? 'none');
    }
}
