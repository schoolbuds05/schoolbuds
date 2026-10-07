@extends('layouts.portal', ['title' => 'Class Work'])

@section('content')
<div class="mb-6">
    <h1 class="text-2xl font-black text-slate-900">Class Work</h1>
    <p class="mt-1 text-sm text-slate-500">Create assignments and quizzes for assigned section subjects.</p>
</div>

<div class="grid grid-cols-1 gap-6 lg:grid-cols-[420px_1fr]">
    <section class="portal-card h-fit p-5">
        <h2 class="font-black text-slate-800">New Work</h2>

        <div class="mt-4 rounded-xl border border-violet-200 bg-violet-50/50 p-3">
            <div class="flex items-center justify-between gap-3">
                <h3 class="text-sm font-black text-slate-800">AI Quiz Generator</h3>
                <span class="rounded-full bg-violet-100 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-violet-700">Groq</span>
            </div>
            <div class="mt-3 space-y-3">
                <textarea id="ai-module-text" rows="3" class="portal-field w-full" placeholder="Paste lesson notes or module content here..."></textarea>
                <div>
                    <label for="ai-module-file" class="group flex w-full cursor-pointer items-center gap-3 rounded-xl border border-violet-200 bg-white p-2.5 shadow-sm transition hover:border-violet-400 hover:bg-violet-50/50">
                        <input id="ai-module-file" type="file" accept=".txt,.pdf,.doc,.docx" class="peer sr-only">
                        <span class="inline-flex shrink-0 items-center gap-2 rounded-lg bg-violet-100 px-3 py-2 text-xs font-black text-violet-700 transition group-hover:bg-violet-200">
                            <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                <path fill-rule="evenodd" d="M10 2a.75.75 0 01.75.75v8.69l2.22-2.22a.75.75 0 111.06 1.06l-3.5 3.5a.75.75 0 01-1.06 0l-3.5-3.5a.75.75 0 111.06-1.06l2.22 2.22V2.75A.75.75 0 0110 2zM3.5 13.5a.75.75 0 01.75.75v1.25h11.5v-1.25a.75.75 0 011.5 0v2a.75.75 0 01-.75.75h-13a.75.75 0 01-.75-.75v-2a.75.75 0 01.75-.75z" clip-rule="evenodd" />
                            </svg>
                            Choose file
                        </span>
                        <span id="ai-module-file-name" class="min-w-0 flex-1 truncate text-xs text-slate-500" aria-live="polite">No file chosen</span>
                    </label>
                    <p class="mt-1.5 px-1 text-[11px] text-slate-500">TXT, PDF, DOC, or DOCX</p>
                </div>
                <div class="grid grid-cols-[1fr_auto] gap-2">
                    <select id="ai-question-count" class="portal-field w-full">
                        <option value="5">5 questions</option>
                        <option value="10" selected>10 questions</option>
                        <option value="15">15 questions</option>
                    </select>
                    <button type="button" id="generate-ai-quiz" class="portal-button-primary whitespace-nowrap">Generate</button>
                </div>
                <p id="ai-quiz-status" class="text-xs text-slate-500">Generate questions from notes or uploaded modules. Generate again to append more questions.</p>
            </div>
        </div>

        <form method="POST" action="{{ route('teacher.assignments.store') }}" class="mt-5 space-y-3">
            @csrf
            <select name="section_subject_id" class="portal-field w-full" required>
                <option value="">Choose class subject</option>
                @forelse($sectionSubjects as $sectionSubject)
                    <option value="{{ $sectionSubject->id }}">
                        {{ $sectionSubject->section?->name }} - {{ $sectionSubject->subject?->name }}
                    </option>
                @empty
                    <option value="" disabled>No current classes available</option>
                @endforelse
            </select>
            <select name="type" id="work-type" class="portal-field w-full" required>
                <option value="assignment">Assignment</option>
                <option value="quiz">Quiz</option>
            </select>
            <input name="title" class="portal-field w-full" placeholder="Title" required>
            <textarea name="instructions" rows="4" class="portal-field w-full" placeholder="Instructions"></textarea>
            <div class="grid grid-cols-2 gap-3">
                <input name="points_possible" type="number" min="1" value="100" class="portal-field w-full" placeholder="Points" required>
                <select name="status" class="portal-field w-full" required>
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                    <option value="closed">Closed</option>
                </select>
            </div>
            <input name="due_at" type="datetime-local" class="portal-field w-full">
            <label class="flex items-center gap-2 rounded-lg border border-violet-100 bg-violet-50 px-3 py-3 text-sm font-bold text-slate-700">
                <input name="allow_file_upload" type="checkbox" value="1" class="rounded border-violet-200">
                Allow file upload
            </label>

            <div id="quiz-question-builder" class="hidden space-y-3 rounded-xl border border-violet-100 bg-violet-50/40 p-3">
                <div class="flex items-center justify-between">
                    <h3 class="text-sm font-black text-slate-800">Quiz Questions</h3>
                    <button type="button" id="add-quiz-question" class="text-xs font-black text-violet-700">+ Add question</button>
                </div>
                <div id="quiz-questions-container" class="space-y-3"></div>
            </div>

            <button class="portal-button-primary w-full">Create work</button>
        </form>
    </section>

    <section class="portal-card overflow-hidden">
        <div class="border-b border-violet-100 p-5">
            <h2 class="font-black text-slate-800">Posted Work</h2>
        </div>
        <div class="divide-y divide-slate-100">
            @forelse($assignments as $assignment)
                <div class="p-5">
                    <div class="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <p class="font-black text-slate-900">{{ $assignment->title }}</p>
                            <p class="mt-1 text-sm font-medium text-slate-600">
                                {{ ucfirst($assignment->type) }} · {{ $assignment->sectionSubject?->section?->name }} - {{ $assignment->sectionSubject?->subject?->name }}
                            </p>
                        </div>
                        <span class="rounded-full bg-violet-50 px-3 py-1 text-xs font-black text-violet-700">{{ ucfirst($assignment->status) }}</span>
                    </div>
                    <p class="mt-3 text-sm text-slate-600">{{ $assignment->instructions ?: 'No instructions.' }}</p>
                    <p class="mt-3 text-sm font-semibold text-slate-600">
                        {{ (float) $assignment->points_possible }} points · {{ $assignment->submissions_count }} submissions · Due {{ $assignment->due_at?->format('Y-m-d H:i') ?? 'anytime' }}
                    </p>
                    @if($assignment->submissions->isNotEmpty())
                        <details class="mt-4 rounded-lg border border-violet-100 bg-violet-50/40">
                            <summary class="cursor-pointer px-3 py-3 text-sm font-black text-violet-900">Review student submissions</summary>
                            <div class="divide-y divide-violet-100 border-t border-violet-100">
                                @foreach($assignment->submissions as $submission)
                                    <details class="group border-b border-violet-100 last:border-b-0">
                                        <summary class="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 p-3 hover:bg-violet-50">
                                            <span class="text-sm font-black text-slate-800">
                                                {{ $submission->student?->first_name }} {{ $submission->student?->last_name }}
                                            </span>
                                            <span class="text-sm font-bold text-slate-700">{{ ucfirst($submission->status) }}</span>
                                        </summary>
                                        <div class="space-y-2 px-3 pb-3">
                                            @if($assignment->type === 'quiz')
                                                @php
                                                    $questionCount = count($assignment->questions ?? []);
                                                    $correctCount = $assignment->correctAnswersCount($submission->answers ?? []);
                                                    $mistakeCount = $questionCount - $correctCount;
                                                @endphp
                                                <p class="text-sm font-black text-rose-700">
                                                    Correct: {{ $correctCount }}/{{ $questionCount }} · Mistakes: {{ $mistakeCount }}
                                                </p>
                                            @endif
                                            <p class="text-sm font-black text-slate-700">
                                                Score:
                                                @if($submission->score !== null)
                                                    {{ (float) $submission->score }}/{{ (float) $assignment->points_possible }} points
                                                @else
                                                    Not graded
                                                @endif
                                            </p>
                                            @if($assignment->type === 'quiz')
                                                <ol class="space-y-2">
                                                    @foreach($assignment->questions ?? [] as $index => $question)
                                                        <li class="rounded-md border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-700">
                                                            <p class="font-bold text-slate-900">{{ $index + 1 }}. {{ $question['question'] ?? '' }}</p>
                                                            <p class="mt-2"><span class="font-semibold text-slate-600">Student answer:</span> <span class="font-medium text-slate-800">{{ data_get($submission->answers, $index) ?: 'Not answered' }}</span></p>
                                                            <p class="mt-1 font-bold text-emerald-800">Correct answer: {{ $question['answer'] ?? 'Not set' }}</p>
                                                        </li>
                                                    @endforeach
                                                </ol>
                                            @else
                                                <p class="whitespace-pre-wrap text-sm text-slate-600">{{ $submission->answer_text ?: 'No text answer provided.' }}</p>
                                            @endif
                                            @if($submission->feedback)
                                                <p class="text-xs text-slate-500">Feedback: {{ $submission->feedback }}</p>
                                            @endif
                                        </div>
                                    </details>
                                @endforeach
                            </div>
                        </details>
                    @endif
                </div>
            @empty
                <p class="p-10 text-center text-sm text-slate-500">No class work posted yet.</p>
            @endforelse
        </div>
    </section>
</div>
@push('scripts')
<script>
    (() => {
        const typeSelect = document.getElementById('work-type');
        const quizBuilder = document.getElementById('quiz-question-builder');
        const quizContainer = document.getElementById('quiz-questions-container');
        const addQuestionButton = document.getElementById('add-quiz-question');
        const aiModuleText = document.getElementById('ai-module-text');
        const aiModuleFile = document.getElementById('ai-module-file');
        const aiModuleFileName = document.getElementById('ai-module-file-name');
        const aiQuestionCount = document.getElementById('ai-question-count');
        const generateAiButton = document.getElementById('generate-ai-quiz');
        const aiStatus = document.getElementById('ai-quiz-status');
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
        const generateQuizUrl = @json(route('teacher.assignments.generate-quiz'));

        aiModuleFile.addEventListener('change', () => {
            aiModuleFileName.textContent = aiModuleFile.files[0]?.name || 'No file chosen';
            aiModuleFileName.classList.toggle('text-slate-500', !aiModuleFile.files.length);
            aiModuleFileName.classList.toggle('font-semibold', Boolean(aiModuleFile.files.length));
            aiModuleFileName.classList.toggle('text-slate-800', Boolean(aiModuleFile.files.length));
        });

        const reindexQuestionRows = () => {
            Array.from(quizContainer.children).forEach((wrapper, index) => {
                wrapper.querySelector('span').textContent = `Question ${index + 1}`;
                wrapper.querySelectorAll('input[name^="questions["]').forEach((input) => {
                    input.name = input.name.replace(/^questions\[\d+\]/, `questions[${index}]`);
                });
            });
        };

        const createQuestionRow = (data = null) => {
            const index = quizContainer.children.length;
            const wrapper = document.createElement('div');
            wrapper.className = 'rounded-lg border border-violet-200 bg-white p-3 space-y-2';

            const questionText = data?.question ?? '';
            const choices = Array.isArray(data?.choices) ? data.choices : ['', '', '', ''];
            const answerText = data?.answer ?? '';

            wrapper.innerHTML = `
                <div class="flex items-center justify-between gap-3">
                    <span class="text-xs font-black uppercase tracking-wide text-violet-700">Question ${index + 1}</span>
                    <button type="button" data-remove-question class="text-xs font-bold text-rose-600">Remove</button>
                </div>
                <input type="text" name="questions[${index}][question]" class="portal-field w-full" value="${escapeHtml(questionText)}" placeholder="Question text" required>
                <div class="grid grid-cols-2 gap-2">
                    <input type="text" name="questions[${index}][choices][]" class="portal-field w-full" value="${escapeHtml(choices[0] ?? '')}" placeholder="Choice A" required>
                    <input type="text" name="questions[${index}][choices][]" class="portal-field w-full" value="${escapeHtml(choices[1] ?? '')}" placeholder="Choice B" required>
                    <input type="text" name="questions[${index}][choices][]" class="portal-field w-full" value="${escapeHtml(choices[2] ?? '')}" placeholder="Choice C" required>
                    <input type="text" name="questions[${index}][choices][]" class="portal-field w-full" value="${escapeHtml(choices[3] ?? '')}" placeholder="Choice D" required>
                </div>
                <input type="text" name="questions[${index}][answer]" class="portal-field w-full" value="${escapeHtml(answerText)}" placeholder="Correct answer (exact text or A-D)" required>
            `;

            wrapper.querySelector('[data-remove-question]').addEventListener('click', () => {
                wrapper.remove();
                reindexQuestionRows();
            });
            quizContainer.appendChild(wrapper);
            reindexQuestionRows();
        };

        const escapeHtml = (value) => {
            return String(value ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        };

        const appendGeneratedQuestions = (questions) => {
            if (!Array.isArray(questions) || questions.length === 0) {
                aiStatus.textContent = 'No quiz questions were generated. Try a longer lesson summary.';
                aiStatus.className = 'text-xs text-amber-600';
                return;
            }

            questions.forEach((question) => createQuestionRow(question));
            typeSelect.value = 'quiz';
            syncQuizBuilder();
            aiStatus.textContent = `${questions.length} question(s) added. ${quizContainer.children.length} question(s) in the quiz.`;
            aiStatus.className = 'text-xs text-emerald-700';
        };

        const syncQuizBuilder = (addInitialQuestion = true) => {
            const isQuiz = typeSelect.value === 'quiz';
            quizBuilder.classList.toggle('hidden', !isQuiz);

            if (isQuiz && addInitialQuestion && quizContainer.children.length === 0) {
                createQuestionRow();
            }
        };

        typeSelect.addEventListener('change', syncQuizBuilder);
        addQuestionButton.addEventListener('click', () => createQuestionRow());

        generateAiButton.addEventListener('click', async () => {
            const formData = new FormData();
            const text = aiModuleText.value.trim();
            const file = aiModuleFile.files[0];

            if (!text && !file) {
                aiStatus.textContent = 'Enter lesson text or upload a file before generating.';
                aiStatus.className = 'text-xs text-amber-600';
                return;
            }

            if (text) {
                formData.append('module_text', text);
            }

            if (file) {
                formData.append('module_file', file);
            }

            formData.append('question_count', aiQuestionCount.value);

            try {
                aiStatus.textContent = 'Generating questions...';
                aiStatus.className = 'text-xs text-slate-500';
                typeSelect.value = 'quiz';
                syncQuizBuilder(false);

                const response = await fetch(generateQuizUrl, {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'X-CSRF-TOKEN': csrfToken || '',
                    },
                    credentials: 'same-origin',
                    body: formData,
                });

                const responseText = await response.text();
                let data;
                try {
                    data = JSON.parse(responseText);
                } catch {
                    throw new Error(`Quiz generation request failed (${response.status}). The server returned an unexpected response.`);
                }

                if (!response.ok) {
                    throw new Error(data.message || 'AI quiz generation failed.');
                }

                appendGeneratedQuestions(data.questions || []);
            } catch (error) {
                aiStatus.textContent = error.message || 'AI quiz generation failed.';
                aiStatus.className = 'text-xs text-rose-600';
            }
        });

        syncQuizBuilder();
    })();
</script>
@endpush

@endsection
