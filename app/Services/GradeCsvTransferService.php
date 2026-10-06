<?php

namespace App\Services;

use App\Models\Grade;
use App\Models\GradeSubmission;
use App\Models\GradeSubmissionEvent;
use App\Models\SchoolClass;
use App\Models\Section;
use App\Models\Student;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class GradeCsvTransferService
{
    private const PERIODS = [
        'prelim' => ['quarter' => '1', 'program_type' => 'college'],
        'midterm' => ['quarter' => '2', 'program_type' => 'college'],
        'prefinal' => ['quarter' => '3', 'program_type' => 'college'],
        'final' => ['quarter' => '4', 'program_type' => 'college'],
        'q1' => ['quarter' => '1', 'program_type' => 'shs'],
        'q2' => ['quarter' => '2', 'program_type' => 'shs'],
        'q3' => ['quarter' => '3', 'program_type' => 'shs'],
        'q4' => ['quarter' => '4', 'program_type' => 'shs'],
    ];

    public function import(UploadedFile $file, User $actor): int
    {
        $handle = fopen($file->getRealPath(), 'r');
        if ($handle === false) {
            throw ValidationException::withMessages(['grades_file' => 'The CSV file could not be read.']);
        }
        $headers = fgetcsv($handle, null, ',', '"', '');
        fclose($handle);

        $normalizedHeaders = array_map(fn ($header) => strtolower(trim(ltrim((string) $header, "\xEF\xBB\xBF"))), $headers ?: []);
        if (array_intersect(['prelim_grade', 'q1_grade'], $normalizedHeaders)) {
            return $this->importWide($file, $actor);
        }

        return $this->importLongFormat($file, $actor);
    }

    private function importWide(UploadedFile $file, User $actor): int
    {
        $input = fopen($file->getRealPath(), 'r');
        if ($input === false) {
            throw ValidationException::withMessages(['grades_file' => 'The CSV file could not be read.']);
        }

        $temporaryPath = tempnam(sys_get_temp_dir(), 'grade-transfer-');
        if ($temporaryPath === false) {
            fclose($input);
            throw ValidationException::withMessages(['grades_file' => 'A temporary import file could not be created.']);
        }
        $output = fopen($temporaryPath, 'w');
        if ($output === false) {
            fclose($input);
            @unlink($temporaryPath);
            throw ValidationException::withMessages(['grades_file' => 'A temporary import file could not be opened.']);
        }

        $longHeaders = [
            'export_version', 'source_system', 'source_submission_id', 'source_class_id',
            'source_student_id', 'student_number', 'student_name', 'program_type',
            'subject_code', 'subject_name', 'school_year', 'semester', 'year_level',
            'section', 'quarter', 'quarter_label', 'grade_record_type', 'grade_value',
            'grade_scale', 'grade_scale_note', 'remarks', 'approval_status', 'finalized_at',
        ];

        try {
            $headers = fgetcsv($input, null, ',', '"', '');
            if (!$headers) {
                throw ValidationException::withMessages(['grades_file' => 'The CSV is empty or missing its header row.']);
            }
            $headers = array_map(fn ($header) => strtolower(trim(ltrim((string) $header, "\xEF\xBB\xBF"))), $headers);
            if (count($headers) !== count(array_unique($headers))) {
                throw ValidationException::withMessages(['grades_file' => 'The CSV contains duplicate column names.']);
            }

            $requiredHeaders = [
                'export_version', 'source_system', 'source_class_id', 'source_student_id',
                'student_number', 'student_name', 'program_type', 'subject_code', 'subject_name',
                'school_year', 'semester', 'year_level', 'section', 'grade_scale', 'grade_scale_note',
            ];
            $missingHeaders = array_diff($requiredHeaders, $headers);
            if ($missingHeaders) {
                throw ValidationException::withMessages([
                    'grades_file' => 'This is not a compatible wide grade template. Missing columns: ' . implode(', ', $missingHeaders),
                ]);
            }

            fputcsv($output, $longHeaders, ',', '"', '');
            $rowNumber = 1;
            $gradeCount = 0;
            while (($values = fgetcsv($input, null, ',', '"', '')) !== false) {
                $rowNumber++;
                if ($values === [null] || (count($values) === 1 && trim((string) $values[0]) === '')) {
                    continue;
                }
                if (count($values) > count($headers)) {
                    throw ValidationException::withMessages(['grades_file' => "Row {$rowNumber}: there are more values than columns."]);
                }

                $values = array_pad($values, count($headers), '');
                $row = [];
                foreach ($headers as $index => $header) {
                    $row[$header] = trim((string) ($values[$index] ?? ''));
                }
                if (($row['export_version'] ?? '') !== '2.0') {
                    throw ValidationException::withMessages(['grades_file' => "Row {$rowNumber}: unsupported export version."]);
                }
                if (!in_array($row['program_type'] ?? '', ['college', 'shs'], true)) {
                    throw ValidationException::withMessages(['grades_file' => "Row {$rowNumber}: program_type must be college or shs."]);
                }

                $expectedPeriods = $row['program_type'] === 'college'
                    ? ['prelim', 'midterm', 'prefinal', 'final']
                    : ['q1', 'q2', 'q3', 'q4'];
                foreach ($expectedPeriods as $period) {
                    foreach ([$period . '_grade', $period . '_remarks', $period . '_source_submission_id', $period . '_finalized_at'] as $requiredHeader) {
                        if (!in_array($requiredHeader, $headers, true)) {
                            throw ValidationException::withMessages([
                                'grades_file' => "The template is missing {$requiredHeader} for {$row['program_type']} grades.",
                            ]);
                        }
                    }
                }
                foreach (array_diff(array_keys(self::PERIODS), $expectedPeriods) as $period) {
                    if (($row[$period . '_grade'] ?? '') !== '') {
                        throw ValidationException::withMessages([
                            'grades_file' => "Row {$rowNumber}: {$period}_grade does not match this row's program type.",
                        ]);
                    }
                }

                $expectedScale = $row['program_type'] === 'college' ? 'college_1_to_5' : 'shs_1_to_100';
                if (($row['grade_scale'] ?? '') !== $expectedScale) {
                    throw ValidationException::withMessages(['grades_file' => "Row {$rowNumber}: grade_scale does not match program_type."]);
                }

                foreach ($expectedPeriods as $period) {
                    $score = $row[$period . '_grade'] ?? '';
                    if ($score === '') {
                        continue;
                    }
                    $periodInfo = self::PERIODS[$period];
                    $submissionId = $row[$period . '_source_submission_id'] ?? '';
                    $finalizedAt = $row[$period . '_finalized_at'] ?? '';
                    if ($submissionId === '' || $finalizedAt === '') {
                        throw ValidationException::withMessages([
                            'grades_file' => "Row {$rowNumber}: {$period} needs its source submission ID and finalized date.",
                        ]);
                    }

                    fputcsv($output, [
                        '2.0',
                        $row['source_system'] ?? '',
                        $submissionId,
                        $row['source_class_id'] ?? '',
                        $row['source_student_id'] ?? '',
                        $row['student_number'] ?? '',
                        $row['student_name'] ?? '',
                        $row['program_type'],
                        $row['subject_code'] ?? '',
                        $row['subject_name'] ?? '',
                        $row['school_year'] ?? '',
                        $row['semester'] ?? '',
                        $row['year_level'] ?? '',
                        $row['section'] ?? '',
                        $periodInfo['quarter'],
                        $periodInfo['program_type'] === 'college' ? ucfirst($period) : 'Q' . $periodInfo['quarter'],
                        'quarter_grade',
                        $score,
                        $row['grade_scale'],
                        $row['grade_scale_note'] ?? '',
                        $row[$period . '_remarks'] ?? '',
                        'finalized',
                        $finalizedAt,
                    ], ',', '"', '');

                    $gradeCount++;
                    if ($gradeCount > 25000) {
                        throw ValidationException::withMessages(['grades_file' => 'The CSV exceeds the 25,000-grade import limit.']);
                    }
                }
            }

            if ($gradeCount === 0) {
                throw ValidationException::withMessages(['grades_file' => 'The CSV does not contain any grade values to import.']);
            }
            fflush($output);
        } catch (\Throwable $exception) {
            @unlink($temporaryPath);
            throw $exception;
        } finally {
            fclose($input);
            fclose($output);
        }

        try {
            $normalizedFile = new UploadedFile($temporaryPath, $file->getClientOriginalName(), 'text/csv', UPLOAD_ERR_OK, true);
            return $this->importLongFormat($normalizedFile, $actor);
        } finally {
            @unlink($temporaryPath);
        }
    }

    private const REQUIRED_HEADERS = [
        'export_version', 'source_system', 'source_submission_id', 'source_class_id',
        'source_student_id', 'student_number', 'student_name', 'program_type',
        'subject_code', 'subject_name', 'school_year', 'semester', 'year_level',
        'section', 'quarter', 'quarter_label', 'grade_record_type', 'grade_value',
        'grade_scale', 'grade_scale_note', 'remarks', 'approval_status', 'finalized_at',
    ];

    private function importLongFormat(UploadedFile $file, User $actor): int
    {
        $handle = fopen($file->getRealPath(), 'r');
        if ($handle === false) {
            throw ValidationException::withMessages(['grades_file' => 'The CSV file could not be read.']);
        }

        try {
            $headers = fgetcsv($handle, null, ',', '"', '');
            if (!$headers) {
                throw ValidationException::withMessages(['grades_file' => 'The CSV is empty or missing its header row.']);
            }

            $headers = array_map(fn ($header) => strtolower(trim(ltrim((string) $header, "\xEF\xBB\xBF"))), $headers);
            if (count($headers) !== count(array_unique($headers))) {
                throw ValidationException::withMessages(['grades_file' => 'The CSV contains duplicate column names.']);
            }

            $missingHeaders = array_diff(self::REQUIRED_HEADERS, $headers);
            if ($missingHeaders) {
                throw ValidationException::withMessages([
                    'grades_file' => 'This is not a compatible grade export. Missing columns: ' . implode(', ', $missingHeaders),
                ]);
            }

            $rows = [];
            $studentCache = [];
            $classCache = [];
            $seenGrades = [];
            $rowNumber = 1;

            while (($values = fgetcsv($handle, null, ',', '"', '')) !== false) {
                $rowNumber++;
                if ($values === [null] || (count($values) === 1 && trim((string) $values[0]) === '')) {
                    continue;
                }
                if (count($values) > count($headers)) {
                    throw ValidationException::withMessages(['grades_file' => "Row {$rowNumber}: there are more values than columns."]);
                }

                $values = array_pad($values, count($headers), '');
                $row = [];
                foreach ($headers as $index => $header) {
                    $row[$header] = $this->restoreCsvValue(trim((string) ($values[$index] ?? '')));
                }

                $validator = Validator::make($row, [
                    'export_version' => ['required', 'in:1.0,2.0'],
                    'source_system' => ['required', 'string', 'max:100'],
                    'source_submission_id' => ['required', 'integer', 'min:1'],
                    'source_class_id' => ['required', 'integer', 'min:1'],
                    'source_student_id' => ['required', 'integer', 'min:1'],
                    'student_number' => ['required', 'string', 'max:255'],
                    'student_name' => ['required', 'string', 'max:255'],
                    'program_type' => ['required', 'in:college,shs'],
                    'subject_code' => ['required', 'string', 'max:100'],
                    'subject_name' => ['required', 'string', 'max:255'],
                    'school_year' => ['required', 'string', 'max:20'],
                    'semester' => ['required', 'in:1st,2nd,summer'],
                    'year_level' => ['required', 'string', 'max:50'],
                    'section' => ['required', 'string', 'max:255'],
                    'quarter' => ['required', 'in:1,2,3,4'],
                    'quarter_label' => ['required', 'string', 'max:30'],
                    'grade_record_type' => ['required', 'in:quarter_grade'],
                    'grade_value' => ['required', 'numeric', 'min:1', 'max:100'],
                    'grade_scale' => ['required', 'in:college_1_to_5,shs_1_to_100'],
                    'grade_scale_note' => ['required', 'string', 'max:100'],
                    'remarks' => ['nullable', 'string', 'max:5000'],
                    'approval_status' => ['required', 'in:finalized'],
                    'finalized_at' => ['required', 'date'],
                ]);

                if ($validator->fails()) {
                    throw ValidationException::withMessages([
                        'grades_file' => "Row {$rowNumber}: " . $validator->errors()->first(),
                    ]);
                }

                $isCollege = $row['program_type'] === 'college';
                $expectedScale = $isCollege ? 'college_1_to_5' : 'shs_1_to_100';
                $score = (float) $row['grade_value'];
                if ($row['grade_scale'] !== $expectedScale
                    || ($isCollege && ($score > 5 || abs(($score * 4) - round($score * 4)) > 0.00001))
                    || (!$isCollege && ($score > 100 || abs(($score * 100) - round($score * 100)) > 0.00001))) {
                    throw ValidationException::withMessages([
                        'grades_file' => "Row {$rowNumber}: the grade value does not match its program's grading scale.",
                    ]);
                }

                $studentNumber = $row['student_number'];
                if (!array_key_exists($studentNumber, $studentCache)) {
                    $studentCache[$studentNumber] = Student::query()->where('student_id', $studentNumber)->first();
                }
                $student = $studentCache[$studentNumber];
                if (!$student) {
                    throw ValidationException::withMessages([
                        'grades_file' => "Row {$rowNumber}: student number {$studentNumber} does not exist in this system. Import students first.",
                    ]);
                }

                $classCacheKey = json_encode([
                    $row['program_type'], $row['subject_code'], $row['subject_name'],
                    $row['school_year'], $row['semester'], $row['year_level'], $row['section'],
                ]);
                if (!array_key_exists($classCacheKey, $classCache)) {
                    $classCache[$classCacheKey] = $this->resolveClass($row);
                }
                $classMatches = $classCache[$classCacheKey];
                if (count($classMatches) !== 1) {
                    $message = $classMatches
                        ? 'the class mapping is ambiguous; make the section, subject, and term mapping unique.'
                        : 'no matching class, section, and subject were found. Import or configure them first.';
                    throw ValidationException::withMessages(['grades_file' => "Row {$rowNumber}: {$message}"]);
                }

                [$schoolClass, $section] = $classMatches[0];
                $groupKey = $this->groupKey($schoolClass->id, $row['school_year'], $row['quarter']);
                $gradeKey = $groupKey . ':' . $student->id;
                if (isset($seenGrades[$gradeKey])) {
                    throw ValidationException::withMessages(['grades_file' => "Row {$rowNumber}: this student and quarter appear more than once."]);
                }
                $seenGrades[$gradeKey] = true;

                $rows[] = [
                    'group_key' => $groupKey,
                    'class' => $schoolClass,
                    'section' => $section,
                    'student' => $student,
                    'source_system' => $row['source_system'],
                    'source_submission_id' => $row['source_submission_id'],
                    'source_class_id' => $row['source_class_id'],
                    'source_student_id' => $row['source_student_id'],
                    'school_year' => $row['school_year'],
                    'semester' => $row['semester'],
                    'program_type' => $row['program_type'],
                    'quarter' => $row['quarter'],
                    'score' => number_format($score, 2, '.', ''),
                    'remarks' => $row['remarks'] ?: null,
                ];

                if (count($rows) > 25000) {
                    throw ValidationException::withMessages(['grades_file' => 'The CSV exceeds the 25,000-row import limit.']);
                }
            }

            if (!$rows) {
                throw ValidationException::withMessages(['grades_file' => 'The CSV does not contain any grade rows.']);
            }

            $groups = [];
            foreach ($rows as $row) {
                $key = $row['group_key'];
                $group = $groups[$key] ?? [
                    'class' => $row['class'],
                    'school_year' => $row['school_year'],
                    'semester' => $row['semester'],
                    'program_type' => $row['program_type'],
                    'quarter' => $row['quarter'],
                    'rows' => [],
                ];
                if ($group['semester'] !== $row['semester'] || $group['program_type'] !== $row['program_type']) {
                    throw ValidationException::withMessages([
                        'grades_file' => 'Multiple terms map to the same class and quarter. Resolve the class mapping before importing.',
                    ]);
                }
                $group['rows'][] = $row;
                $groups[$key] = $group;
            }

            $classIds = collect($groups)->pluck('class.id')->unique()->all();
            $schoolYears = collect($groups)->pluck('school_year')->unique()->all();
            $quarters = collect($groups)->pluck('quarter')->unique()->all();
            $existingSubmissions = GradeSubmission::query()
                ->whereIn('school_class_id', $classIds)
                ->whereIn('school_year', $schoolYears)
                ->whereIn('quarter', $quarters)
                ->get(['school_class_id', 'school_year', 'quarter']);
            foreach ($existingSubmissions as $existing) {
                if (isset($groups[$this->groupKey($existing->school_class_id, $existing->school_year, $existing->quarter)])) {
                    throw ValidationException::withMessages([
                        'grades_file' => 'At least one target class already has a grade sheet for that school year and quarter. Existing grade sheets are never overwritten.',
                    ]);
                }
            }

            $existingGrades = Grade::query()
                ->whereIn('school_class_id', $classIds)
                ->whereIn('school_year', $schoolYears)
                ->whereIn('quarter', $quarters)
                ->get(['school_class_id', 'school_year', 'quarter']);
            foreach ($existingGrades as $existing) {
                if (isset($groups[$this->groupKey($existing->school_class_id, $existing->school_year, $existing->quarter)])) {
                    throw ValidationException::withMessages([
                        'grades_file' => 'At least one target class already has published grades for that school year and quarter. Existing grades are never overwritten.',
                    ]);
                }
            }

            return DB::transaction(function () use ($groups, $actor) {
                $importedCount = 0;
                foreach ($groups as $group) {
                    $now = now();
                    $gradeLines = [];
                    $sourceSubmissionIds = [];

                    foreach ($group['rows'] as $row) {
                        $student = $row['student'];
                        $line = [
                            'student_id' => $student->id,
                            'student_code' => $student->student_id,
                            'student_name' => trim($student->first_name . ' ' . $student->last_name),
                            'score' => $row['score'],
                            'remarks' => $row['remarks'],
                            'source_system' => $row['source_system'],
                            'source_submission_id' => $row['source_submission_id'],
                            'source_student_id' => $row['source_student_id'],
                        ];
                        $gradeLines[] = $line;
                        $sourceSubmissionIds[] = $row['source_submission_id'];

                        Grade::create([
                            'student_id' => $student->id,
                            'school_class_id' => $group['class']->id,
                            'school_year' => $group['school_year'],
                            'quarter' => $group['quarter'],
                            'score' => $row['score'],
                            'remarks' => $row['remarks'],
                        ]);
                        $importedCount++;
                    }

                    $sourceSubmissionIds = array_values(array_unique($sourceSubmissionIds));
                    $sourceSystem = $group['rows'][0]['source_system'];
                    $submission = GradeSubmission::create([
                        'school_class_id' => $group['class']->id,
                        'teacher_id' => $group['class']->teacher_id,
                        'school_year' => $group['school_year'],
                        'quarter' => $group['quarter'],
                        'status' => GradeSubmission::STATUS_FINALIZED,
                        'revision' => 1,
                        'grades' => $gradeLines,
                        'submitted_at' => $now,
                        'registrar_reviewed_by' => $actor->id,
                        'registrar_reviewed_at' => $now,
                        'registrar_note' => "Imported finalized grade data from {$sourceSystem}.",
                        'finalized_at' => $now,
                    ]);

                    GradeSubmissionEvent::create([
                        'grade_submission_id' => $submission->id,
                        'actor_id' => $actor->id,
                        'action' => 'imported_finalized',
                        'from_status' => null,
                        'to_status' => GradeSubmission::STATUS_FINALIZED,
                        'revision' => 1,
                        'note' => 'Imported from ' . $sourceSystem . '; source submission IDs: ' . implode(', ', $sourceSubmissionIds),
                        'grade_snapshot' => $gradeLines,
                        'created_at' => $now,
                    ]);
                }

                return $importedCount;
            });
        } finally {
            fclose($handle);
        }
    }

    private function resolveClass(array $row): array
    {
        $sections = Section::query()
            ->where('program_type', $row['program_type'])
            ->where('school_year', $row['school_year'])
            ->where('semester', $row['semester'])
            ->where('year_level', $row['year_level'])
            ->where('name', $row['section'])
            ->whereHas('sectionSubjects.subject', fn ($query) => $query
                ->where('code', $row['subject_code'])
                ->where('name', $row['subject_name']))
            ->with(['sectionSubjects.subject'])
            ->get();

        $matches = [];
        foreach ($sections as $section) {
            foreach ($section->sectionSubjects as $sectionSubject) {
                if ($sectionSubject->subject?->code !== $row['subject_code']
                    || $sectionSubject->subject?->name !== $row['subject_name']) {
                    continue;
                }

                $classes = SchoolClass::query()
                    ->where('subject', $row['subject_name'])
                    ->where('grade_level', $row['year_level'])
                    ->where('section', $row['section'])
                    ->where('school_year', $row['school_year'])
                    ->get();

                foreach ($classes as $schoolClass) {
                    $matches[$section->id . ':' . $schoolClass->id] = [$schoolClass, $section];
                }
            }
        }

        return array_values($matches);
    }

    private function restoreCsvValue(string $value): string
    {
        return preg_match("/^'[=+@\\-]/", $value) ? substr($value, 1) : $value;
    }

    private function groupKey(int|string $classId, int|string $schoolYear, int|string $quarter): string
    {
        return json_encode([(string) $classId, (string) $schoolYear, (string) $quarter]);
    }
}