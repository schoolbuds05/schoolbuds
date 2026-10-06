<?php

namespace App\Http\Controllers\Registrar;

use App\Http\Controllers\Controller;
use App\Models\GradeChangeRequest;
use App\Models\GradeSubmission;
use App\Models\SectionSubject;
use App\Models\Student;
use App\Services\GradeWorkflowService;
use App\Services\GradeCsvTransferService;
use App\Services\PointsService;
use Illuminate\Http\Request;

class GradeApprovalController extends Controller
{
    public function index(Request $request)
    {
        $showApproved = $request->query('view') === 'approved';
        $submissions = GradeSubmission::query()
            ->where('status', $showApproved
                ? GradeSubmission::STATUS_FINALIZED
                : GradeSubmission::STATUS_REGISTRAR_REVIEW)
            ->with(['schoolClass.teacher', 'teacher', 'events.actor'])
            ->orderByDesc($showApproved ? 'finalized_at' : 'submitted_at')
            ->paginate(25)
            ->withQueryString();
        $changeRequests = $showApproved
            ? null
            : GradeChangeRequest::query()
                ->where('status', GradeChangeRequest::STATUS_REGISTRAR_REVIEW)
                ->with(['submission.schoolClass', 'submission.teacher', 'teacher', 'chairReviewer', 'events.actor'])
                ->orderByDesc('created_at')
                ->paginate(25, ['*'], 'change_page')
                ->withQueryString();

        return view('registrar.grades.index', compact('submissions', 'showApproved', 'changeRequests'));
    }

    public function export(Request $request)
    {
        $request->validate(['program_type' => ['nullable', 'in:college,shs']]);
        $exportProgramType = $request->query('program_type');
        $periods = match ($exportProgramType) {
            'college' => ['prelim', 'midterm', 'prefinal', 'final'],
            'shs' => ['q1', 'q2', 'q3', 'q4'],
            default => ['prelim', 'midterm', 'prefinal', 'final', 'q1', 'q2', 'q3', 'q4'],
        };
        $headers = [
            'export_version', 'source_system', 'source_class_id', 'source_student_id',
            'student_number', 'student_name', 'program_type', 'subject_code', 'subject_name',
            'school_year', 'semester', 'year_level', 'section', 'grade_scale', 'grade_scale_note',
            ...array_map(fn ($period) => $period . '_grade', $periods),
            ...array_map(fn ($period) => $period . '_remarks', $periods),
            ...array_map(fn ($period) => $period . '_source_submission_id', $periods),
            ...array_map(fn ($period) => $period . '_finalized_at', $periods),
        ];

        return response()->streamDownload(function () use ($headers, $periods, $exportProgramType) {
            $output = fopen('php://output', 'w');
            fwrite($output, "\xEF\xBB\xBF");
            fputcsv($output, $headers, ',', '"', '');

            $exportRows = [];
            $sectionSubjectCache = [];
            $studentCache = [];

            GradeSubmission::query()
                ->where('status', GradeSubmission::STATUS_FINALIZED)
                ->with('schoolClass')
                ->orderBy('id')
                ->get()
                ->each(function (GradeSubmission $submission) use (&$exportRows, &$sectionSubjectCache, &$studentCache, $headers, $periods, $exportProgramType) {
                    $schoolClass = $submission->schoolClass;
                    if (!$schoolClass) {
                        return;
                    }

                    if (!array_key_exists($schoolClass->id, $sectionSubjectCache)) {
                        $sectionSubjectCache[$schoolClass->id] = SectionSubject::query()
                            ->with(['section', 'subject'])
                            ->whereHas('section', fn ($query) => $query
                                ->where('name', $schoolClass->section)
                                ->where('year_level', $schoolClass->grade_level)
                                ->where('school_year', $schoolClass->school_year))
                            ->whereHas('subject', fn ($query) => $query->where('name', $schoolClass->subject))
                            ->when($schoolClass->teacher_id, fn ($query) => $query->where('teacher_id', $schoolClass->teacher_id))
                            ->first();
                    }

                    $sectionSubject = $sectionSubjectCache[$schoolClass->id];
                    $programType = $sectionSubject?->section?->program_type
                        ?? ($schoolClass->is_college ? 'college' : 'shs');
                    if ($exportProgramType && $programType !== $exportProgramType) {
                        return;
                    }
                    $isCollege = $programType === 'college';
                    $period = $isCollege
                        ? (['1' => 'prelim', '2' => 'midterm', '3' => 'prefinal', '4' => 'final'][(string) $submission->quarter] ?? null)
                        : 'q' . $submission->quarter;
                    if (!$period) {
                        return;
                    }

                    $gradeScale = $isCollege ? 'college_1_to_5' : 'shs_1_to_100';
                    $gradeScaleNote = $isCollege ? '1 is highest' : '100 is highest';

                    foreach ($submission->grades ?? [] as $gradeLine) {
                        $studentId = (int) ($gradeLine['student_id'] ?? 0);
                        if (!$studentId) {
                            continue;
                        }
                        if (!array_key_exists($studentId, $studentCache)) {
                            $studentCache[$studentId] = Student::query()->find($studentId);
                        }
                        $student = $studentCache[$studentId];
                        $rowKey = implode(':', [$schoolClass->id, $submission->school_year, $sectionSubject?->section?->id, $studentId]);

                        if (!isset($exportRows[$rowKey])) {
                            $exportRows[$rowKey] = array_fill_keys($headers, '');
                            $exportRows[$rowKey] = array_replace($exportRows[$rowKey], [
                                'export_version' => '2.0',
                                'source_system' => 'SchoolBuds',
                                'source_class_id' => $schoolClass->id,
                                'source_student_id' => $studentId,
                                'student_number' => $gradeLine['student_code'] ?? $student?->student_id ?? '',
                                'student_name' => $gradeLine['student_name'] ?? trim(($student?->first_name ?? '') . ' ' . ($student?->last_name ?? '')),
                                'program_type' => $programType,
                                'subject_code' => $sectionSubject?->subject?->code ?? '',
                                'subject_name' => $schoolClass->subject,
                                'school_year' => $submission->school_year,
                                'semester' => $sectionSubject?->section?->semester ?? '',
                                'year_level' => $schoolClass->grade_level,
                                'section' => $schoolClass->section,
                                'grade_scale' => $gradeScale,
                                'grade_scale_note' => $gradeScaleNote,
                            ]);
                        }

                        $exportRows[$rowKey][$period . '_grade'] = isset($gradeLine['score'])
                            ? number_format((float) $gradeLine['score'], 2, '.', '')
                            : '';
                        $exportRows[$rowKey][$period . '_remarks'] = $gradeLine['remarks'] ?? '';
                        $exportRows[$rowKey][$period . '_source_submission_id'] = $submission->id;
                        $exportRows[$rowKey][$period . '_finalized_at'] = $submission->finalized_at?->toIso8601String() ?? '';
                    }
                });

            foreach ($exportRows as $exportRow) {
                $row = array_map(function ($value) {
                    $value = (string) ($value ?? '');
                    return preg_match('/^[=+@\\-]/', $value) ? "'{$value}" : $value;
                }, array_values($exportRow));
                fputcsv($output, $row, ',', '"', '');
            }

            fclose($output);
        }, 'schoolbuds-finalized-grades-v2-' . now()->format('Ymd') . '.csv', [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    public function import(Request $request, GradeCsvTransferService $transfer)
    {
        $request->validate([
            'grades_file' => ['required', 'file', 'mimes:csv,txt', 'max:10240'],
        ]);

        $importedCount = $transfer->import($request->file('grades_file'), $request->user());

        return redirect()
            ->route('registrar.grades.index', ['view' => 'approved'])
            ->with('status', "Imported {$importedCount} finalized grade record(s). Existing grades were not changed.");
    }

    public function review(Request $request, GradeSubmission $submission, GradeWorkflowService $workflow, PointsService $points)
    {
        $data = $request->validate([
            'decision' => ['required', 'in:approve,return'],
            'note' => ['nullable', 'required_if:decision,return', 'string', 'max:2000'],
        ]);

        $workflow->registrarDecision(
            $request->user(),
            $submission,
            $data['decision'],
            $data['note'] ?? null,
            $points
        );

        return redirect()->route('registrar.grades.index')->with('status', $data['decision'] === 'approve'
            ? 'Grade sheet finalized and published.'
            : 'Grade sheet returned to the Department Chair.');
    }
}
