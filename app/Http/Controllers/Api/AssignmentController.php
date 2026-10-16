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
use Smalot\PdfParser\Parser as PdfParser;
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
            'type' => ['required', Rule::in(['assignment', 'quiz', 'exam'])],
            'title' => ['required', 'string', 'max:160'],
            'instructions' => ['nullable', 'string', 'max:5000'],
            'points_possible' => ['required', 'numeric', 'min:1', 'max:1000'],
            'due_at' => ['nullable', 'date'],
            'duration_minutes' => ['required_if:type,exam', 'nullable', 'integer', 'min:1', 'max:300'],
            'allow_file_upload' => ['nullable', 'boolean'],
            'questions' => ['required_if:type,exam', 'nullable', 'array', 'min:1', 'max:50'],
            'questions.*.question' => ['required_with:questions', 'string', 'max:1000'],
            'questions.*.choices' => ['required_if:type,exam', 'nullable', 'array', 'min:2', 'max:6'],
            'questions.*.choices.*' => ['required_if:type,exam', 'string', 'max:500'],
            'questions.*.answer' => ['required_if:type,exam', 'nullable', 'string', 'max:500'],
            'status' => ['nullable', Rule::in(['draft', 'published', 'closed'])],
        ]);

        if ($data['type'] === 'exam') {
            foreach ($data['questions'] as $index => &$question) {
                $answer = mb_strtolower(trim((string) ($question['answer'] ?? '')));
                $choices = array_map(
                    fn ($choice) => mb_strtolower(trim((string) $choice)),
                    $question['choices'] ?? []
                );
                $answerIndex = array_search($answer, $choices, true);
                if ($answerIndex === false && preg_match('/^[A-F]$/i', $answer)) {
                    $answerIndex = ord(strtoupper($answer)) - 65;
                }
                if ($answer === '' || !isset($question['choices'][$answerIndex])) {
                    return response()->json([
                        'message' => 'Each exam answer must match one of its choices or use its A-F letter.',
                        'errors' => ["questions.{$index}.answer" => ['Choose a correct answer from the question choices.']],
                    ], 422);
                }
                $question['answer'] = $question['choices'][$answerIndex];
            }
            unset($question);
        }

        $sectionSubject = $this->teacherSectionSubject($request, (int) $data['section_subject_id']);

        $assignment = ClassAssignment::create([
            ...$data,
            'section_subject_id' => $sectionSubject->id,
            'teacher_id' => $request->user()->id,
            'status' => $data['status'] ?? 'published',
        ]);

        if ($assignment->status === 'published') {
            $this->notifyEnrolledStudents($assignment, 'New class work', "{$assignment->title} is now available.");
        }

        return response()->json($assignment->load(['sectionSubject.section', 'sectionSubject.subject']), 201);
    }

    public function generateQuiz(Request $request)
    {
        $this->authorizeFaculty($request->user());

        $data = $request->validate([
            'module_text' => ['nullable', 'string', 'max:30000'],
            'module_file' => ['nullable', 'file', 'mimes:txt,pdf,docx', 'max:10240'],
            'question_count' => ['nullable', 'integer', 'min:3', 'max:50'],
        ]);

        $content = trim((string) ($data['module_text'] ?? ''));
        if ($request->hasFile('module_file')) {
            try {
                $content .= "\n\n" . $this->extractModuleText(
                    $request->file('module_file')->getRealPath(),
                    $request->file('module_file')->getClientOriginalExtension()
                );
            } catch (\Exception $exception) {
                report($exception);

                return response()->json([
                    'message' => 'Could not read the uploaded file. Make sure the PDF is not password-protected or corrupted.',
                ], 422);
            }
        }

        $content = trim($content);
        if ($content === '') {
            return response()->json([
                'message' => 'No readable text was found. Scanned or image-only PDFs are not supported; add lesson text or upload a text-based PDF, TXT, or DOCX file.',
            ], 422);
        }

        $key = config('services.groq.key');
        if (!$key) {
            return response()->json(['message' => 'Groq is not configured. Add GROQ_API_KEY to your .env file.'], 503);
        }

        $count = (int) ($data['question_count'] ?? 10);
        $questions = [];
        foreach (array_chunk(range(1, $count), 10) as $batch) {
            $batchCount = count($batch);
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
                            'content' => "Generate exactly {$batchCount} multiple-choice questions. JSON shape: [{\"question\":\"...\",\"choices\":[\"A\",\"B\",\"C\",\"D\"],\"answer\":\"correct choice\",\"explanation\":\"...\"}]. Module:\n" . mb_substr($content, 0, 24000),
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
            $batchQuestions = json_decode(trim($raw), true);
            if (!is_array($batchQuestions)) {
                return response()->json(['message' => 'AI response could not be parsed. Try shorter module text.'], 422);
            }

            $questions = array_merge($questions, $batchQuestions);
        }

        $questions = collect($questions)
            ->map(function ($item) {
                if (!is_array($item) || blank($item['question'] ?? null) || !is_array($item['choices'] ?? null)) {
                    return null;
                }
                $choices = array_values(array_filter($item['choices'], fn ($choice) => is_string($choice) && trim($choice) !== ''));
                if (count($choices) < 2 || count($choices) > 6) {
                    return null;
                }
                $answer = mb_strtolower(trim((string) ($item['answer'] ?? '')));
                $answerIndex = array_search($answer, array_map('mb_strtolower', $choices), true);
                if ($answerIndex === false && preg_match('/^[A-F]$/i', $answer)) {
                    $answerIndex = ord(strtoupper($answer)) - 65;
                }
                if ($answerIndex === false || !isset($choices[$answerIndex])) {
                    return null;
                }
                $item['choices'] = $choices;
                $item['answer'] = $choices[$answerIndex];

                return $item;
            })
            ->filter()
            ->take($count)
            ->values();
        if ($questions->count() !== $count) {
            return response()->json([
                'message' => "The AI returned {$questions->count()} of {$count} requested questions. Please retry or choose a smaller number.",
            ], 422);
        }

        return response()->json([
            'questions' => $questions->all(),
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

    public function startExam(Request $request, ClassAssignment $assignment)
    {
        if ($assignment->type !== 'exam' || $assignment->status !== 'published') {
            return response()->json(['message' => 'This exam is not available.'], 422);
        }

        $student = $this->studentFor($request->user());
        if (!$student || !$this->studentCanAccess($request->user(), $assignment)) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        if (!$assignment->duration_minutes || empty($assignment->questions)) {
            return response()->json(['message' => 'This exam does not have a valid time limit. Contact your teacher.'], 422);
        }

        $submission = DB::transaction(function () use ($request, $assignment, $student) {
            $submission = AssignmentSubmission::firstOrCreate(
                [
                    'class_assignment_id' => $assignment->id,
                    'student_id' => $student->id,
                ],
                [
                    'user_id' => $request->user()->id,
                    'status' => 'in_progress',
                ]
            );
            $submission = AssignmentSubmission::whereKey($submission->id)->lockForUpdate()->firstOrFail();

            if (!$submission->started_at && !$submission->submitted_at) {
                $submission->update(['started_at' => now()]);
            }

            if (!$submission->submitted_at && $this->examExpired($assignment, $submission)) {
                $this->finishTimedExam($assignment, $submission, $submission->answers ?? []);
            }

            return $submission->fresh();
        });

        return response()->json([
            'submission' => $submission,
            'expires_at' => $submission->started_at
                ? $submission->started_at->copy()->addMinutes((int) $assignment->duration_minutes)->toISOString()
                : null,
        ]);
    }

    public function saveExamProgress(Request $request, ClassAssignment $assignment)
    {
        if ($assignment->type !== 'exam') {
            return response()->json(['message' => 'Progress saving is only available for exams.'], 422);
        }
        if ($assignment->status !== 'published' || !$assignment->duration_minutes) {
            return response()->json(['message' => 'This exam is not accepting answers.'], 422);
        }

        $student = $this->studentFor($request->user());
        if (!$student || !$this->studentCanAccess($request->user(), $assignment)) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $data = $request->validate([
            'answers' => ['required', 'array', 'max:50'],
            'answers.*' => ['nullable', 'string', 'max:1000'],
        ]);

        $submission = DB::transaction(function () use ($request, $assignment, $student, $data) {
            $submission = AssignmentSubmission::query()
                ->where('class_assignment_id', $assignment->id)
                ->where('student_id', $student->id)
                ->lockForUpdate()
                ->first();

            if ($assignment->status !== 'published') {
                abort(response()->json(['message' => 'This exam is not accepting answers.'], 422));
            }
            if (!$submission || !$submission->started_at) {
                abort(response()->json(['message' => 'Start the exam before saving answers.'], 409));
            }
            if ($submission->submitted_at) {
                abort(response()->json(['message' => 'This exam has already been submitted.'], 409));
            }

            if ($this->examExpired($assignment, $submission)) {
                $this->finishTimedExam($assignment, $submission, $submission->answers ?? []);
            } else {
                $submission->update([
                    'user_id' => $request->user()->id,
                    'answers' => $data['answers'],
                ]);
            }

            return $submission->fresh();
        });

        return response()->json($submission);
    }

    public function update(Request $request, ClassAssignment $assignment)
    {
        $this->authorizeTeacherAssignment($request, $assignment);

        $data = $request->validate([
            'type' => ['nullable', Rule::in(['assignment', 'quiz', 'exam'])],
            'title' => ['nullable', 'string', 'max:160'],
            'instructions' => ['nullable', 'string', 'max:5000'],
            'points_possible' => ['nullable', 'numeric', 'min:1', 'max:1000'],
            'due_at' => ['nullable', 'date'],
            'duration_minutes' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:300'],
            'allow_file_upload' => ['nullable', 'boolean'],
            'questions' => ['nullable', 'array', 'max:50'],
            'questions.*.question' => ['required_with:questions', 'string', 'max:1000'],
            'questions.*.choices' => ['nullable', 'array', 'min:2', 'max:6'],
            'questions.*.choices.*' => ['string', 'max:500'],
            'questions.*.answer' => ['nullable', 'string', 'max:500'],
            'status' => ['nullable', Rule::in(['draft', 'published', 'closed'])],
        ]);

        if (($data['type'] ?? $assignment->type) === 'exam') {
            $duration = $data['duration_minutes'] ?? $assignment->duration_minutes;
            $questions = $data['questions'] ?? $assignment->questions ?? [];
            if (!$duration || count($questions) < 1) {
                return response()->json(['message' => 'Exams require a time limit and at least one question.'], 422);
            }
            foreach ($questions as $index => &$question) {
                $answer = mb_strtolower(trim((string) ($question['answer'] ?? '')));
                $choices = array_map(
                    fn ($choice) => mb_strtolower(trim((string) $choice)),
                    $question['choices'] ?? []
                );
                $answerIndex = array_search($answer, $choices, true);
                if ($answerIndex === false && preg_match('/^[A-F]$/i', $answer)) {
                    $answerIndex = ord(strtoupper($answer)) - 65;
                }
                if (
                    blank($question['question'] ?? null)
                    || count($question['choices'] ?? []) < 2
                    || count($question['choices'] ?? []) > 6
                    || $answerIndex === false
                    || !isset($question['choices'][$answerIndex])
                ) {
                    return response()->json([
                        'message' => 'Each exam answer must match one of its choices or use its A-F letter.',
                        'errors' => ["questions.{$index}.answer" => ['Choose a correct answer from the question choices.']],
                    ], 422);
                }
                $question['answer'] = $question['choices'][$answerIndex];
            }
            unset($question);
            if (array_key_exists('questions', $data)) {
                $data['questions'] = $questions;
            }
        }

        $wasDraft = $assignment->status === 'draft';
        $assignment->update($data);
        if ($wasDraft && $assignment->status === 'published') {
            $this->notifyEnrolledStudents($assignment, 'New class work', "{$assignment->title} is now available.");
        }

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

        $existingSubmission = AssignmentSubmission::where('class_assignment_id', $assignment->id)
            ->where('student_id', $student->id)
            ->first();

        if ($existingSubmission?->submitted_at) {
            return response()->json(['message' => 'This work has already been submitted.'], 409);
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
        $timedOut = false;
        if ($assignment->type === 'exam') {
            if (!$existingSubmission?->started_at) {
                return response()->json(['message' => 'Start the exam before submitting.'], 409);
            }
            $timedOut = $this->examExpired($assignment, $existingSubmission);
            if ($timedOut) {
                $data['answers'] = $existingSubmission->answers ?? [];
                $hasQuizAnswer = collect($data['answers'])
                    ->contains(fn ($answer) => trim((string) $answer) !== '');
            }
        }

        if (!$hasTextAnswer && !$hasFileAnswer && !$hasQuizAnswer) {
            if ($timedOut) {
                $data['answers'] = [];
            } else {
                return response()->json(['message' => 'Please add an answer before submitting.'], 422);
            }
        }

        $plagiarismScore = $this->similarityScore($assignment, $student, $data['answer_text'] ?? '');
        $autoScore = in_array($assignment->type, ['quiz', 'exam'], true)
            ? $this->autoScoreQuiz($assignment, $data['answers'] ?? [])
            : null;
        $submission = DB::transaction(function () use ($request, $assignment, $student, $data, $autoScore, $plagiarismScore) {
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
            $submission = AssignmentSubmission::whereKey($submission->id)->lockForUpdate()->firstOrFail();

            if ($submission->submitted_at) {
                return null;
            }

            $violationCount = max((int) ($data['violation_count'] ?? 0), (int) ($submission->violation_count ?? 0));
            $isFlagged = $request->boolean('auto_submit')
                || $violationCount >= 3
                || $submission->status === 'flagged';
            $examExpired = $assignment->type === 'exam' && $this->examExpired($assignment, $submission);
            $answers = $data['answers'] ?? null;
            if ($examExpired) {
                $answers = $submission->answers ?? [];
            }
            $score = in_array($assignment->type, ['quiz', 'exam'], true)
                ? $this->autoScoreQuiz($assignment, $answers ?? [])
                : $autoScore;

            $submission->fill([
                'user_id' => $request->user()->id,
                'answer_text' => $data['answer_text'] ?? null,
                'file_url' => $data['file_url'] ?? null,
                'answers' => $answers,
                'score' => $score,
                'plagiarism_score' => $plagiarismScore,
                'violation_count' => $violationCount,
                'violations' => $data['violations'] ?? $submission->violations,
                'status' => $isFlagged ? 'flagged' : ($score === null ? 'submitted' : 'graded'),
                'submitted_at' => $examExpired
                    ? $submission->started_at->copy()->addMinutes((int) $assignment->duration_minutes)
                    : now(),
                'auto_submitted_at' => $isFlagged ? ($submission->auto_submitted_at ?? now()) : null,
                'flagged_at' => $isFlagged ? ($submission->flagged_at ?? now()) : null,
                'graded_at' => $isFlagged || $score === null
                    ? null
                    : ($examExpired
                        ? $submission->started_at->copy()->addMinutes((int) $assignment->duration_minutes)
                        : now()),
            ]);
            $submission->save();

            return $submission;
        });

        if (!$submission) {
            return response()->json(['message' => 'This work has already been submitted.'], 409);
        }

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
        if (!in_array($assignment->type, ['quiz', 'exam'], true)) {
            return response()->json(['message' => 'Violations can only be recorded for quizzes and exams.'], 422);
        }

        $student = $this->studentFor($request->user());
        if (!$this->studentCanAccess($request->user(), $assignment)) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $data = $request->validate([
            'type' => ['required', 'string', 'max:80'],
            'details' => ['nullable', 'array'],
            'answers' => ['nullable', 'array'],
            'answers.*' => ['nullable', 'string', 'max:1000'],
        ]);

        $submission = DB::transaction(function () use ($request, $assignment, $student, $data) {
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
            $submission = AssignmentSubmission::whereKey($submission->id)->lockForUpdate()->firstOrFail();

            if ($submission->submitted_at) {
                return null;
            }

            if ($assignment->type === 'exam') {
                if (!$submission->started_at) {
                    abort(response()->json(['message' => 'Start the exam before recording activity.'], 409));
                }
                if ($this->examExpired($assignment, $submission)) {
                    $this->finishTimedExam($assignment, $submission, $submission->answers ?? []);
                    return $submission->fresh();
                }
            }

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

            if ($count >= 3) {
                $answers = $data['answers'] ?? $submission->answers ?? [];
                $updates['status'] = 'flagged';
                $updates['answers'] = $answers;
                $updates['score'] = $this->autoScoreQuiz($assignment, $answers);
                $updates['submitted_at'] = now();
                $updates['auto_submitted_at'] = $submission->auto_submitted_at ?? now();
                $updates['flagged_at'] = $submission->flagged_at ?? now();
            }

            $submission->update($updates);

            return $submission;
        });

        if (!$submission) {
            return response()->json(['message' => 'This quiz has already been submitted.'], 409);
        }

        $autoSubmitted = $submission->status === 'flagged' && (bool) $submission->submitted_at;
        if ($autoSubmitted) {
            SchoolNotification::create([
                'user_id' => $assignment->teacher_id,
                'type' => 'assignment_submitted',
                'title' => 'Submission received',
                'body' => "{$student->first_name} {$student->last_name} submitted {$assignment->title}.",
                'channels' => ['in_app'],
                'data' => ['assignment_id' => $assignment->id, 'submission_id' => $submission->id],
            ]);
        }

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
            return trim((new PdfParser())->parseFile($path)->getText());
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

    private function examExpired(ClassAssignment $assignment, AssignmentSubmission $submission): bool
    {
        return $assignment->type === 'exam'
            && $submission->started_at !== null
            && now()->greaterThanOrEqualTo(
                $submission->started_at->copy()->addMinutes((int) $assignment->duration_minutes)
            );
    }

    private function finishTimedExam(ClassAssignment $assignment, AssignmentSubmission $submission, array $answers): void
    {
        $deadline = $submission->started_at->copy()->addMinutes((int) $assignment->duration_minutes);
        $submission->update([
            'answers' => $answers,
            'score' => $this->autoScoreQuiz($assignment, $answers),
            'status' => 'graded',
            'submitted_at' => $deadline,
            'graded_at' => $deadline,
        ]);

        $student = $submission->student;
        if ($student) {
            SchoolNotification::create([
                'user_id' => $assignment->teacher_id,
                'type' => 'assignment_submitted',
                'title' => 'Submission received',
                'body' => "{$student->first_name} {$student->last_name} submitted {$assignment->title}.",
                'channels' => ['in_app'],
                'data' => ['assignment_id' => $assignment->id, 'submission_id' => $submission->id],
            ]);
        }
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
