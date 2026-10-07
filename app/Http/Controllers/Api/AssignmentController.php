<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AssignmentSubmission;
use App\Models\ClassAssignment;
use App\Models\SchoolClass;
use App\Models\SchoolNotification;
use App\Models\SectionSubject;
use App\Models\Student;
use App\Models\User;
use App\Services\GradeWorkflowService;
use Illuminate\Http\Request;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\Rule;
use ZipArchive;

class AssignmentController extends Controller
{
    public function teacherIndex(Request $request)
    {
        $this->authorizeFaculty($request->user());

        $assignments = ClassAssignment::query()
            ->where('teacher_id', $request->user()->id)
            ->with(['sectionSubject.section', 'sectionSubject.subject'])
            ->withCount('submissions')
            ->latest()
            ->get();

        return response()->json($assignments);
    }

    public function store(Request $request)
    {
        $this->authorizeFaculty($request->user());

        $data = $request->validate([
            'section_subject_id' => ['required', 'integer', 'exists:section_subjects,id'],
            'type' => ['required', Rule::in(['assignment', 'quiz'])],
            'title' => ['required', 'string', 'max:160'],
            'instructions' => ['nullable', 'string', 'max:5000'],
            'points_possible' => ['required', 'numeric', 'min:1', 'max:1000'],
            'due_at' => ['nullable', 'date'],
            'allow_file_upload' => ['nullable', 'boolean'],
            'questions' => ['nullable', 'array'],
            'questions.*.question' => ['required_with:questions', 'string', 'max:1000'],
            'questions.*.choices' => ['nullable', 'array'],
            'questions.*.answer' => ['nullable', 'string', 'max:500'],
            'status' => ['nullable', Rule::in(['draft', 'published', 'closed'])],
        ]);

        $sectionSubject = $this->teacherSectionSubject($request, (int) $data['section_subject_id']);

        $assignment = ClassAssignment::create([
            ...$data,
            'section_subject_id' => $sectionSubject->id,
            'teacher_id' => $request->user()->id,
            'status' => $data['status'] ?? 'published',
        ]);

        $this->notifyEnrolledStudents($assignment, 'New class work', "{$assignment->title} is now available.");

        return response()->json($assignment->load(['sectionSubject.section', 'sectionSubject.subject']), 201);
    }

    public function generateQuiz(Request $request)
    {
        $this->authorizeFaculty($request->user());

        $data = $request->validate([
            'module_text' => ['nullable', 'string', 'max:30000'],
            'module_file' => ['nullable', 'file', 'mimes:txt,pdf,doc,docx', 'max:10240'],
            'question_count' => ['nullable', 'integer', 'min:3', 'max:20'],
        ]);

        $content = trim((string) ($data['module_text'] ?? ''));
        if ($request->hasFile('module_file')) {
            $content .= "\n\n" . $this->extractModuleText($request->file('module_file')->getRealPath(), $request->file('module_file')->getClientOriginalExtension());
        }

        $content = trim($content);
        if ($content === '') {
            return response()->json(['message' => 'Add module text or upload a readable TXT/DOCX file.'], 422);
        }

        $key = config('services.groq.key');
        if (!$key) {
            return response()->json(['message' => 'Groq is not configured. Add GROQ_API_KEY to your .env file.'], 503);
        }

        $count = (int) ($data['question_count'] ?? 10);
        try {
            $response = Http::withOptions([
                'verify' => config('services.groq.ca_bundle') ?: true,
            ])->withHeaders([
                'Authorization' => 'Bearer ' . $key,
                'Content-Type' => 'application/json',
            ])->timeout(60)->post('https://api.groq.com/openai/v1/chat/completions', [
                'model' => 'openai/gpt-oss-20b',
                'max_tokens' => 4096,
                'temperature' => 0.4,
                'messages' => [
                    [
                        'role' => 'system',
                        'content' => 'Return only valid JSON. Generate multiple-choice quiz questions from teacher module content.',
                    ],
                    [
                        'role' => 'user',
                        'content' => "Generate {$count} multiple-choice questions. JSON shape: [{\"question\":\"...\",\"choices\":[\"A\",\"B\",\"C\",\"D\"],\"answer\":\"correct choice\",\"explanation\":\"...\"}]. Module:\n" . mb_substr($content, 0, 24000),
                    ],
                ],
            ]);
        } catch (ConnectionException $exception) {
            report($exception);

            return response()->json([
                'message' => "PHP could not verify Groq's TLS certificate. If your antivirus or network inspects HTTPS, configure PHP with that trusted root certificate using GROQ_CA_BUNDLE.",
            ], 503);
        }

        if (!$response->successful()) {
            $errorMessage = $response->json('error.message');
            logger()->error('Groq quiz generation request failed.', [
                'status' => $response->status(),
                'error' => $errorMessage,
            ]);

            return response()->json([
                'message' => $response->status() === 429
                    ? 'Groq is temporarily rate-limited. Please wait a moment and try again.'
                    : ($errorMessage ?: 'Groq could not generate the quiz. Please try again.'),
            ], $response->status() === 429 ? 429 : 503);
        }

        $raw = preg_replace('/```json|```/', '', (string) $response->json('choices.0.message.content'));
        $questions = json_decode(trim($raw), true);
        if (!is_array($questions)) {
            return response()->json(['message' => 'AI response could not be parsed. Try shorter module text.'], 422);
        }

        return response()->json([
            'questions' => collect($questions)
                ->filter(fn ($item) => is_array($item) && !blank($item['question'] ?? null))
                ->values()
                ->all(),
        ]);
    }

    public function show(Request $request, ClassAssignment $assignment)
    {
        $this->authorizeAssignmentAccess($request, $assignment);

        $assignment->load(['sectionSubject.section', 'sectionSubject.subject']);

        if ($this->isFaculty($request->user()) && (int) $assignment->teacher_id === (int) $request->user()->id) {
            $assignment->load('submissions.student');
            return response()->json($assignment);
        }

        $student = $this->studentFor($request->user());
        $submission = $student
            ? AssignmentSubmission::query()
                ->where('class_assignment_id', $assignment->id)
                ->where('student_id', $student->id)
                ->first()
            : null;

        $assignment->setAttribute('submission', $submission);
        $assignment->setAttribute('questions', $this->questionsForStudent($assignment, $submission));

        return response()->json($assignment);
    }

    public function update(Request $request, ClassAssignment $assignment)
    {
        $this->authorizeTeacherAssignment($request, $assignment);

        $data = $request->validate([
            'type' => ['nullable', Rule::in(['assignment', 'quiz'])],
            'title' => ['nullable', 'string', 'max:160'],
            'instructions' => ['nullable', 'string', 'max:5000'],
            'points_possible' => ['nullable', 'numeric', 'min:1', 'max:1000'],
            'due_at' => ['nullable', 'date'],
            'allow_file_upload' => ['nullable', 'boolean'],
            'questions' => ['nullable', 'array'],
            'questions.*.question' => ['required_with:questions', 'string', 'max:1000'],
            'questions.*.choices' => ['nullable', 'array'],
            'questions.*.answer' => ['nullable', 'string', 'max:500'],
            'status' => ['nullable', Rule::in(['draft', 'published', 'closed'])],
        ]);

        $assignment->update($data);

        return response()->json($assignment->fresh()->load(['sectionSubject.section', 'sectionSubject.subject']));
    }

    public function destroy(Request $request, ClassAssignment $assignment)
    {
        $this->authorizeTeacherAssignment($request, $assignment);

        $assignment->delete();

        return response()->json(['message' => 'Class work deleted.']);
    }

    public function studentIndex(Request $request)
    {
        $student = $this->studentFor($request->user());

        if (!$student) {
            return response()->json([]);
        }

        $sectionSubjectIds = SectionSubject::query()
            ->where(function ($query) use ($request) {
                $query->whereExists(function ($enrollment) use ($request) {
                    $enrollment->selectRaw('1')
                        ->from('section_students')
                        ->whereColumn('section_students.section_id', 'section_subjects.section_id')
                        ->where('section_students.user_id', $request->user()->id)
                        ->where('section_students.status', 'enrolled');
                })->orWhereExists(function ($enrollment) use ($request) {
                    $enrollment->selectRaw('1')
                        ->from('student_subjects')
                        ->whereColumn('student_subjects.subject_id', 'section_subjects.subject_id')
                        ->where('student_subjects.user_id', $request->user()->id)
                        ->where('student_subjects.status', 'enrolled')
                        ->where(function ($section) {
                            $section->whereColumn('student_subjects.section_id', 'section_subjects.section_id')
                                ->orWhereNull('student_subjects.section_id');
                        });
                });
            })
            ->whereNotExists(function ($dropped) use ($request) {
                $dropped->selectRaw('1')
                    ->from('student_subjects')
                    ->whereColumn('student_subjects.subject_id', 'section_subjects.subject_id')
                    ->where('student_subjects.user_id', $request->user()->id)
                    ->where('student_subjects.status', 'dropped')
                    ->where(function ($section) {
                        $section->whereColumn('student_subjects.section_id', 'section_subjects.section_id')
                            ->orWhereNull('student_subjects.section_id');
                    });
            })
            ->pluck('id');

        $assignments = ClassAssignment::query()
            ->whereIn('section_subject_id', $sectionSubjectIds)
            ->where('status', 'published')
            ->with(['sectionSubject.section', 'sectionSubject.subject', 'teacher:id,name'])
            ->with(['submissions' => fn ($query) => $query->where('student_id', $student->id)])
            ->orderByRaw('due_at IS NULL, due_at ASC')
            ->latest('id')
            ->get()
            ->map(function (ClassAssignment $assignment) {
                $submission = $assignment->submissions->first();
                unset($assignment->submissions);
                $assignment->submission = $submission;
                $assignment->questions = $this->questionsForStudent($assignment, $submission);
                return $assignment;
            });

        return response()->json($assignments);
    }

    public function submit(Request $request, ClassAssignment $assignment)
    {
        if ($assignment->status !== 'published') {
            return response()->json(['message' => 'This class work is not accepting submissions.'], 422);
        }

        $student = $this->studentFor($request->user());
        if (!$this->studentCanAccess($request->user(), $assignment)) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $data = $request->validate([
            'answer_text' => ['nullable', 'string', 'max:10000'],
            'file_url' => ['nullable', 'string', 'max:1000'],
            'answers' => ['nullable', 'array'],
            'answers.*' => ['nullable', 'string', 'max:1000'],
            'violation_count' => ['nullable', 'integer', 'min:0'],
            'violations' => ['nullable', 'array'],
            'auto_submit' => ['nullable', 'boolean'],
        ]);

        $hasTextAnswer = trim((string) ($data['answer_text'] ?? '')) !== '';
        $hasFileAnswer = trim((string) ($data['file_url'] ?? '')) !== '';
        $hasQuizAnswer = collect($data['answers'] ?? [])
            ->contains(fn ($answer) => trim((string) $answer) !== '');

        if (!$hasTextAnswer && !$hasFileAnswer && !$hasQuizAnswer) {
            return response()->json(['message' => 'Please add an answer before submitting.'], 422);
        }

        $plagiarismScore = $this->similarityScore($assignment, $student, $data['answer_text'] ?? '');
        $autoScore = $assignment->type === 'quiz'
            ? $this->autoScoreQuiz($assignment, $data['answers'] ?? [])
            : null;
        $existingSubmission = AssignmentSubmission::where('class_assignment_id', $assignment->id)
            ->where('student_id', $student->id)
            ->first();
        $violationCount = max((int) ($data['violation_count'] ?? 0), (int) ($existingSubmission?->violation_count ?? 0));
        $isFlagged = $request->boolean('auto_submit') || $violationCount >= 3 || $existingSubmission?->status === 'flagged';

        $submission = AssignmentSubmission::updateOrCreate(
            [
                'class_assignment_id' => $assignment->id,
                'student_id' => $student->id,
            ],
            [
                'user_id' => $request->user()->id,
                'answer_text' => $data['answer_text'] ?? null,
                'file_url' => $data['file_url'] ?? null,
                'answers' => $data['answers'] ?? null,
                'score' => $autoScore,
                'plagiarism_score' => $plagiarismScore,
                'violation_count' => $violationCount,
                'violations' => $data['violations'] ?? $existingSubmission?->violations,
                'status' => $isFlagged ? 'flagged' : ($autoScore === null ? 'submitted' : 'graded'),
                'submitted_at' => now(),
                'auto_submitted_at' => $isFlagged ? ($existingSubmission?->auto_submitted_at ?? now()) : null,
                'flagged_at' => $isFlagged ? ($existingSubmission?->flagged_at ?? now()) : null,
                'graded_at' => $isFlagged || $autoScore === null ? null : now(),
            ]
        );

        SchoolNotification::create([
            'user_id' => $assignment->teacher_id,
            'type' => 'assignment_submitted',
            'title' => 'Submission received',
            'body' => "{$student->first_name} {$student->last_name} submitted {$assignment->title}.",
            'channels' => ['in_app'],
            'data' => ['assignment_id' => $assignment->id, 'submission_id' => $submission->id],
        ]);

        return response()->json($submission->load('assignment.sectionSubject.subject'), 201);
    }

    public function recordViolation(Request $request, ClassAssignment $assignment)
    {
        if ($assignment->type !== 'quiz') {
            return response()->json(['message' => 'Violations can only be recorded for quizzes.'], 422);
        }

        $student = $this->studentFor($request->user());
        if (!$this->studentCanAccess($request->user(), $assignment)) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $data = $request->validate([
            'type' => ['required', 'string', 'max:80'],
            'details' => ['nullable', 'array'],
        ]);

        $submission = AssignmentSubmission::firstOrCreate(
            [
                'class_assignment_id' => $assignment->id,
                'student_id' => $student->id,
            ],
            [
                'user_id' => $request->user()->id,
                'status' => 'in_progress',
                'submitted_at' => null,
            ]
        );

        $violations = $submission->violations ?? [];
        $violations[] = [
            'type' => $data['type'],
            'details' => $data['details'] ?? [],
            'recorded_at' => now()->toISOString(),
        ];

        $count = count($violations);
        $updates = [
            'violation_count' => $count,
            'violations' => $violations,
        ];

        if ($count >= 3 && $submission->status !== 'flagged') {
            $updates['status'] = 'flagged';
            $updates['auto_submitted_at'] = now();
            $updates['flagged_at'] = now();
        }

        $submission->update($updates);

        return response()->json($submission->fresh());
    }

    public function grade(Request $request, ClassAssignment $assignment, AssignmentSubmission $submission, GradeWorkflowService $workflow)
    {
        $this->authorizeTeacherAssignment($request, $assignment);

        if ((int) $submission->class_assignment_id !== (int) $assignment->id) {
            return response()->json(['message' => 'Submission does not belong to this class work.'], 422);
        }

        $data = $request->validate([
            'score' => ['required', 'numeric', 'min:0', 'max:' . max(1, (float) $assignment->points_possible)],
            'feedback' => ['nullable', 'string', 'max:3000'],
            'sync_to_grades' => ['nullable', 'boolean'],
            'quarter' => ['nullable', Rule::in(['1', '2', '3', '4'])],
        ]);

        DB::transaction(function () use ($submission, $data, $request, $assignment, $workflow) {
            $submission->update([
                'score' => $data['score'],
                'feedback' => $data['feedback'] ?? null,
                'status' => 'graded',
                'graded_at' => now(),
            ]);

            if ($request->boolean('sync_to_grades')) {
                $this->saveAssignmentScoreToDraft($assignment, $submission, $data['quarter'] ?? '1', $request->user(), $workflow);
            }
        });

        SchoolNotification::create([
            'user_id' => $submission->user_id,
            'type' => 'assignment_graded',
            'title' => 'Class work graded',
            'body' => "{$assignment->title} was graded: {$submission->score}/{$assignment->points_possible}.",
            'channels' => ['in_app'],
            'data' => ['assignment_id' => $assignment->id, 'submission_id' => $submission->id],
        ]);

        return response()->json($submission->fresh()->load('student'));
    }

    private function teacherSectionSubject(Request $request, int $sectionSubjectId): SectionSubject
    {
        return SectionSubject::query()
            ->where('teacher_id', $request->user()->id)
            ->with(['section', 'subject'])
            ->findOrFail($sectionSubjectId);
    }

    private function authorizeTeacherAssignment(Request $request, ClassAssignment $assignment): void
    {
        $this->authorizeFaculty($request->user());
        if ((int) $assignment->teacher_id !== (int) $request->user()->id) {
            abort(response()->json(['message' => 'Unauthorized.'], 403));
        }
    }

    private function authorizeAssignmentAccess(Request $request, ClassAssignment $assignment): void
    {
        if ($this->isFaculty($request->user()) && (int) $assignment->teacher_id === (int) $request->user()->id) {
            return;
        }

        if ($this->studentCanAccess($request->user(), $assignment)) {
            return;
        }

        abort(response()->json(['message' => 'Unauthorized.'], 403));
    }

    private function notifyEnrolledStudents(ClassAssignment $assignment, string $title, string $body): void
    {
        $userIds = DB::table('section_students')
            ->where('section_id', $assignment->sectionSubject?->section_id ?? $assignment->sectionSubject()->value('section_id'))
            ->where('status', 'enrolled')
            ->pluck('user_id');

        foreach ($userIds as $userId) {
            SchoolNotification::create([
                'user_id' => $userId,
                'type' => 'assignment_posted',
                'title' => $title,
                'body' => $body,
                'channels' => ['in_app'],
                'data' => ['assignment_id' => $assignment->id],
            ]);
        }
    }

    private function extractModuleText(string $path, string $extension): string
    {
        $extension = strtolower($extension);

        if ($extension === 'txt') {
            return (string) file_get_contents($path);
        }

        if ($extension === 'docx') {
            $zip = new ZipArchive();
            if ($zip->open($path) !== true) {
                return '';
            }
            $xml = $zip->getFromName('word/document.xml') ?: '';
            $zip->close();

            $xml = preg_replace('/<w:tab\/>/', ' ', $xml);
            $xml = preg_replace('/<\/w:p>/', "\n", $xml);
            return trim(strip_tags($xml));
        }

        if ($extension === 'pdf') {
            $bytes = (string) file_get_contents($path);
            preg_match_all('/\(([^()]*)\)\s*Tj/', $bytes, $matches);
            return trim(implode("\n", $matches[1] ?? []));
        }

        return '';
    }

    private function studentCanAccess(User $user, ClassAssignment $assignment): bool
    {
        $sectionSubject = $assignment->sectionSubject;
        if (!$sectionSubject) {
            return false;
        }

        $hasDroppedSubject = DB::table('student_subjects')
            ->where('user_id', $user->id)
            ->where('subject_id', $sectionSubject->subject_id)
            ->where('status', 'dropped')
            ->where(function ($query) use ($sectionSubject) {
                $query->where('section_id', $sectionSubject->section_id)
                    ->orWhereNull('section_id');
            })
            ->exists();

        if ($hasDroppedSubject) {
            return false;
        }

        $hasSectionEnrollment = DB::table('section_students')
            ->where('section_id', $sectionSubject->section_id)
            ->where('user_id', $user->id)
            ->where('status', 'enrolled')
            ->exists();

        if ($hasSectionEnrollment) {
            return true;
        }

        return DB::table('student_subjects')
            ->where('user_id', $user->id)
            ->where('subject_id', $sectionSubject->subject_id)
            ->where('status', 'enrolled')
            ->where(function ($query) use ($sectionSubject) {
                $query->where('section_id', $sectionSubject->section_id)
                    ->orWhereNull('section_id');
            })
            ->exists();
    }

    private function studentFor(User $user): ?Student
    {
        return Student::where('user_id', $user->id)->first();
    }

    private function authorizeFaculty(?User $user): void
    {
        if (!$user || !$this->isFaculty($user)) {
            abort(response()->json(['message' => 'Faculty access is required.'], 403));
        }
    }

    private function isFaculty(User $user): bool
    {
        return in_array($user->role, User::FACULTY_ROLES, true) || $user->hasAnyRole(User::FACULTY_ROLES);
    }

    private function similarityScore(ClassAssignment $assignment, Student $student, ?string $answerText): ?float
    {
        $answerText = trim((string) $answerText);
        if ($answerText === '') {
            return null;
        }

        $highest = 0.0;
        $others = AssignmentSubmission::where('class_assignment_id', $assignment->id)
            ->where('student_id', '!=', $student->id)
            ->whereNotNull('answer_text')
            ->pluck('answer_text');

        foreach ($others as $otherText) {
            similar_text(strtolower($answerText), strtolower((string) $otherText), $percent);
            $highest = max($highest, (float) $percent);
        }

        return round($highest, 2);
    }

    private function autoScoreQuiz(ClassAssignment $assignment, array $answers): ?float
    {
        $questions = collect($assignment->questions ?? [])->values();
        if ($questions->isEmpty()) {
            return null;
        }

        $correct = $assignment->correctAnswersCount($answers);

        return round(($correct / max(1, $questions->count())) * (float) $assignment->points_possible, 2);
    }

    private function questionsForStudent(ClassAssignment $assignment, ?AssignmentSubmission $submission): array
    {
        $canReviewAnswers = $submission
            && $submission->status === 'graded'
            && $submission->score !== null;

        return collect($assignment->questions ?? [])
            ->map(function ($question) use ($canReviewAnswers) {
                if (is_array($question) && !$canReviewAnswers) {
                    unset($question['answer']);
                }

                return $question;
            })
            ->values()
            ->all();
    }

    private function saveAssignmentScoreToDraft(ClassAssignment $assignment, AssignmentSubmission $submission, string $quarter, User $teacher, GradeWorkflowService $workflow): void
    {
        $sectionSubject = $assignment->sectionSubject()->with(['section', 'subject'])->first();
        if (!$sectionSubject || $submission->score === null) {
            return;
        }

        $schoolClass = SchoolClass::firstOrCreate(
            [
                'name' => "{$sectionSubject->section?->name} - {$sectionSubject->subject?->code}",
                'subject' => $sectionSubject->subject?->name ?? 'Subject',
                'grade_level' => $sectionSubject->section?->year_level ?? '',
                'section' => $sectionSubject->section?->name ?? '',
                'school_year' => $sectionSubject->section?->school_year ?? '',
            ],
            [
                'teacher_id' => $sectionSubject->teacher_id,
                'room' => $sectionSubject->room,
                'schedule' => trim(implode(' ', array_filter([
                    $sectionSubject->day,
                    ($sectionSubject->time_start && $sectionSubject->time_end)
                        ? "{$sectionSubject->time_start}-{$sectionSubject->time_end}"
                        : null,
                ]))),
            ]
        );

        $scorePercent = min(100, round(((float) $submission->score / max(1, (float) $assignment->points_possible)) * 100, 2));
        $student = Student::find($submission->student_id);
        if ($student) {
            $workflow->saveAssignmentGrade($teacher, $schoolClass, $student, $quarter, $scorePercent);
        }
    }
}
