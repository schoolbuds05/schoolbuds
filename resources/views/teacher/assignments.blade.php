@extends('layouts.portal', ['title' => 'Class Work'])

@section('content')
<div class="mb-6">
    <h1 class="text-2xl font-black text-slate-900">Class Work</h1>
    <p class="mt-1 text-sm text-slate-500">Create assignments, quizzes, and timed exams for assigned section subjects.</p>
</div>

<div class="space-y-6">
    @php
        $assignmentSchoolYears = $assignments
            ->map(fn ($assignment) => $assignment->sectionSubject?->section?->school_year)
            ->filter()
            ->unique()
            ->sort()
            ->values();
        $assignmentSemesters = $assignments
            ->map(fn ($assignment) => $assignment->sectionSubject?->section?->semester)
            ->filter()
            ->unique()
            ->sort()
            ->values();
    @endphp
    <dialog id="create-work-dialog" aria-labelledby="create-work-title" class="m-auto max-h-[92vh] w-[calc(100%-2rem)] max-w-3xl overflow-hidden rounded-2xl p-0 shadow-2xl backdrop:bg-slate-950/50">
        <section class="portal-card max-h-[92vh] overflow-y-auto p-5 sm:p-7">
            <div class="mb-5 flex items-start justify-between gap-4">
                <div>
                    <h2 id="create-work-title" class="font-black text-slate-800">Create class work</h2>
                    <p class="mt-1 text-sm text-slate-500">Create an assignment, quiz, or timed exam.</p>
                </div>
                <button
                    type="button"
                    onclick="document.getElementById('create-work-dialog').close()"
                    class="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50"
                    aria-label="Close create work dialog"
                >
                    Close
                </button>
            </div>

            <div class="mt-4 rounded-xl border border-violet-200 bg-violet-50/50 p-3">
            <div class="flex items-center justify-between gap-3">
                <h3 class="text-sm font-black text-slate-800">AI Quiz & Exam Generator</h3>
                <span class="rounded-full bg-violet-100 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-violet-700">Groq</span>
            </div>
            <div class="mt-3 space-y-3">
                <textarea id="ai-module-text" rows="3" class="portal-field w-full" placeholder="Paste lesson notes or module content here..."></textarea>
                <div>
                    <label for="ai-module-file" class="group flex w-full cursor-pointer items-center gap-3 rounded-xl border border-violet-200 bg-white p-2.5 shadow-sm transition hover:border-violet-400 hover:bg-violet-50/50">
                        <input id="ai-module-file" type="file" accept=".txt,.pdf,.docx" class="peer sr-only">
                        <span class="inline-flex shrink-0 items-center gap-2 rounded-lg bg-violet-100 px-3 py-2 text-xs font-black text-violet-700 transition group-hover:bg-violet-200">
                            <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                <path fill-rule="evenodd" d="M10 2a.75.75 0 01.75.75v8.69l2.22-2.22a.75.75 0 111.06 1.06l-3.5 3.5a.75.75 0 01-1.06 0l-3.5-3.5a.75.75 0 111.06-1.06l2.22 2.22V2.75A.75.75 0 0110 2zM3.5 13.5a.75.75 0 01.75.75v1.25h11.5v-1.25a.75.75 0 011.5 0v2a.75.75 0 01-.75.75h-13a.75.75 0 01-.75-.75v-2a.75.75 0 01.75-.75z" clip-rule="evenodd" />
                            </svg>
                            Choose file
                        </span>
                        <span id="ai-module-file-name" class="min-w-0 flex-1 truncate text-xs text-slate-500" aria-live="polite">No file chosen</span>
                    </label>
                    <p class="mt-1.5 px-1 text-[11px] text-slate-500">TXT, PDF, or DOCX (text-based PDFs only)</p>
                </div>
                <div class="grid grid-cols-[1fr_auto] gap-2">
                    <select id="ai-question-count" class="portal-field w-full">
                        <option value="5">5 questions</option>
                        <option value="10" selected>10 questions</option>
                        <option value="15">15 questions</option>
                        <option value="20">20 questions</option>
                        <option value="30">30 questions</option>
                        <option value="40">40 questions</option>
                        <option value="50">50 questions</option>
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
                <option value="exam">Timed exam</option>
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
            <div id="exam-duration-field" class="hidden">
                <label for="exam-duration-minutes" class="mb-1 block text-xs font-bold text-slate-600">Exam time limit (minutes)</label>
                <input id="exam-duration-minutes" name="duration_minutes" type="number" min="1" max="300" value="60" class="portal-field w-full" disabled>
            </div>
            <label class="flex items-center gap-2 rounded-lg border border-violet-100 bg-violet-50 px-3 py-3 text-sm font-bold text-slate-700">
                <input name="allow_file_upload" type="checkbox" value="1" class="rounded border-violet-200">
                Allow file upload
            </label>

            <div id="quiz-question-builder" class="hidden space-y-3 rounded-xl border border-violet-100 bg-violet-50/40 p-3">
                <div class="flex items-center justify-between">
                    <h3 id="question-builder-title" class="text-sm font-black text-slate-800">Quiz Questions</h3>
                    <button type="button" id="add-quiz-question" class="text-xs font-black text-violet-700">+ Add question</button>
                </div>
                <div id="quiz-questions-container" class="space-y-5"></div>
            </div>

                <div class="flex gap-3">
                    <button
                        type="button"
                        onclick="document.getElementById('create-work-dialog').close()"
                        class="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50"
                    >
                        Cancel
                    </button>
                    <button class="portal-button-primary w-full">Create work</button>
                </div>
            </form>
        </section>
    </dialog>

    <section class="portal-card overflow-hidden">
        <div class="border-b border-violet-100 p-5">
            <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 class="font-black text-slate-800">Posted Work</h2>
                    <p class="mt-1 text-xs text-slate-500">Search and filter your assignments, quizzes, and exams.</p>
                </div>
                <div class="grid w-full gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] lg:w-auto lg:grid-cols-[16rem_auto_auto]">
                    <label class="sr-only" for="work-search">Search work</label>
                    <input id="work-search" type="search" class="portal-field w-full" placeholder="Search title, class, subject...">
                    <details class="relative">
                        <summary class="flex h-full min-h-10 cursor-pointer list-none items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
                            Filter
                            <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                <path fill-rule="evenodd" d="M5.22 7.22a.75.75 0 011.06 0L10 10.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 8.28a.75.75 0 010-1.06z" clip-rule="evenodd" />
                            </svg>
                        </summary>
                        <div class="absolute right-0 z-20 mt-2 grid w-80 grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
                            <label class="block text-xs font-bold text-slate-600" for="work-school-year-filter">
                                School year
                                <select id="work-school-year-filter" class="portal-field mt-1 w-full">
                                    <option value="">All years</option>
                                    @foreach($assignmentSchoolYears as $schoolYear)
                                        <option value="{{ $schoolYear }}">{{ $schoolYear }}</option>
                                    @endforeach
                                </select>
                            </label>
                            <label class="block text-xs font-bold text-slate-600" for="work-semester-filter">
                                Semester
                                <select id="work-semester-filter" class="portal-field mt-1 w-full">
                                    <option value="">All semesters</option>
                                    @foreach($assignmentSemesters as $semester)
                                        <option value="{{ $semester }}">{{ strtoupper($semester) }}</option>
                                    @endforeach
                                </select>
                            </label>
                            <label class="block text-xs font-bold text-slate-600" for="work-type-filter">
                                Work type
                                <select id="work-type-filter" class="portal-field mt-1 w-full">
                                    <option value="">All types</option>
                                    <option value="assignment">Assignments</option>
                                    <option value="quiz">Quizzes</option>
                                    <option value="exam">Exams</option>
                                </select>
                            </label>
                            <label class="block text-xs font-bold text-slate-600" for="work-status-filter">
                                Status
                                <select id="work-status-filter" class="portal-field mt-1 w-full">
                                    <option value="">All statuses</option>
                                    <option value="published">Published</option>
                                    <option value="draft">Draft</option>
                                    <option value="closed">Closed</option>
                                    <option value="archived">Archived</option>
                                </select>
                            </label>
                            <label class="block text-xs font-bold text-slate-600" for="work-period-filter">
                                Time period
                                <select id="work-period-filter" class="portal-field mt-1 w-full">
                                    <option value="">All work</option>
                                    <option value="current">Current work</option>
                                    <option value="past">Past work</option>
                                </select>
                            </label>
                        </div>
                    </details>
                    <button
                        type="button"
                        onclick="document.getElementById('create-work-dialog').showModal()"
                        class="portal-button-primary whitespace-nowrap"
                    >
                        + Create work
                    </button>
                </div>
            </div>
        </div>
        <div class="space-y-4 bg-slate-50/50 p-4 sm:p-5">
            @forelse($assignments as $assignment)
                <div
                    data-work-card
                    data-work-type="{{ $assignment->type }}"
                    data-work-status="{{ $assignment->status }}"
                    data-work-period="{{ in_array($assignment->status, ['closed', 'archived'], true) || ($assignment->due_at && $assignment->due_at->isPast()) ? 'past' : 'current' }}"
                    data-work-school-year="{{ $assignment->sectionSubject?->section?->school_year }}"
                    data-work-semester="{{ $assignment->sectionSubject?->section?->semester }}"
                    data-work-search="{{ $assignment->title }} {{ $assignment->sectionSubject?->section?->name }} {{ $assignment->sectionSubject?->subject?->name }}"
                    class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                    <div class="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <p class="font-black text-slate-900">{{ $assignment->title }}</p>
                            <p class="mt-1 text-sm font-medium text-slate-600">
                                {{ ucfirst($assignment->type) }} · {{ $assignment->sectionSubject?->section?->name }} - {{ $assignment->sectionSubject?->subject?->name }}
                            </p>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="rounded-full bg-violet-50 px-3 py-1 text-xs font-black text-violet-700">{{ ucfirst($assignment->status) }}</span>
                            @if($assignment->status === 'draft')
                                <form method="POST" action="{{ route('teacher.assignments.publish', $assignment) }}">
                                    @csrf
                                    <button type="submit" class="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white hover:bg-emerald-700">
                                        Publish
                                    </button>
                                </form>
                            @endif
                            @if($assignment->status !== 'archived')
                                <button
                                    type="button"
                                    onclick="document.getElementById('archive-work-{{ $assignment->id }}').showModal()"
                                    class="rounded-lg border border-rose-200 px-3 py-2 text-xs font-black text-rose-700 hover:bg-rose-50"
                                >
                                    Delete
                                </button>
                                <dialog id="archive-work-{{ $assignment->id }}" aria-labelledby="archive-work-title-{{ $assignment->id }}" class="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl p-0 shadow-2xl backdrop:bg-slate-950/50">
                                    <form method="POST" action="{{ route('teacher.assignments.archive', $assignment) }}" class="space-y-4 p-5">
                                        @csrf
                                        <div class="flex items-start justify-between gap-4">
                                            <div>
                                                <h3 id="archive-work-title-{{ $assignment->id }}" class="font-black text-slate-900">Delete this work?</h3>
                                                <p class="mt-1 text-sm text-slate-600">This will move “{{ $assignment->title }}” to Archived. Its questions and student submissions will be kept and remain accessible.</p>
                                            </div>
                                            <button type="button" onclick="document.getElementById('archive-work-{{ $assignment->id }}').close()" class="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50" aria-label="Close delete work dialog">Close</button>
                                        </div>
                                        <label for="archive-reason-{{ $assignment->id }}" class="block text-sm font-bold text-slate-700">
                                            Why is this work being deleted?
                                            <textarea id="archive-reason-{{ $assignment->id }}" name="reason" rows="3" maxlength="1000" class="portal-field mt-1 w-full" required placeholder="Enter a reason"></textarea>
                                        </label>
                                        <div class="flex justify-end gap-2">
                                            <button type="button" onclick="document.getElementById('archive-work-{{ $assignment->id }}').close()" class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
                                            <button type="submit" class="rounded-lg bg-rose-700 px-4 py-2 text-sm font-black text-white hover:bg-rose-800">Archive work</button>
                                        </div>
                                    </form>
                                </dialog>
                            @endif
                        </div>
                    </div>
                    <p class="mt-3 text-sm text-slate-600">{{ $assignment->instructions ?: 'No instructions.' }}</p>
                    <p class="mt-3 text-sm font-semibold text-slate-600">
                        {{ (float) $assignment->points_possible }} points · {{ $assignment->submissions_count }} submissions · Due {{ $assignment->due_at?->format('Y-m-d H:i') ?? 'anytime' }}
                        @if($assignment->type === 'exam')
                            · {{ $assignment->duration_minutes }} minute time limit
                        @endif
                    </p>
                    @if($assignment->status === 'draft' && in_array($assignment->type, ['quiz', 'exam'], true))
                        <details class="mt-4 rounded-xl border border-amber-200 bg-amber-50/40">
                            <summary class="cursor-pointer px-4 py-3 text-sm font-black text-amber-900">
                                Edit and continue questions ({{ count($assignment->questions ?? []) }}/50)
                            </summary>
                            <form method="POST" action="{{ route('teacher.assignments.draft.update', $assignment) }}" class="space-y-3 border-t border-amber-100 p-4">
                                @csrf
                                @method('PUT')
                                <label class="block text-xs font-bold text-slate-600">
                                    Title
                                    <input name="title" value="{{ $assignment->title }}" maxlength="160" class="portal-field mt-1 w-full" required>
                                </label>
                                <label class="block text-xs font-bold text-slate-600">
                                    Instructions
                                    <textarea name="instructions" rows="2" maxlength="5000" class="portal-field mt-1 w-full">{{ $assignment->instructions }}</textarea>
                                </label>
                                <div class="grid gap-3 sm:grid-cols-3">
                                    <label class="block text-xs font-bold text-slate-600">
                                        Points
                                        <input name="points_possible" type="number" min="1" max="1000" value="{{ (float) $assignment->points_possible }}" class="portal-field mt-1 w-full" required>
                                    </label>
                                    <label class="block text-xs font-bold text-slate-600">
                                        Due date
                                        <input name="due_at" type="datetime-local" value="{{ $assignment->due_at?->format('Y-m-d\TH:i') }}" class="portal-field mt-1 w-full">
                                    </label>
                                    @if($assignment->type === 'exam')
                                        <label class="block text-xs font-bold text-slate-600">
                                            Time limit (minutes)
                                            <input name="duration_minutes" type="number" min="1" max="300" value="{{ $assignment->duration_minutes }}" class="portal-field mt-1 w-full" required>
                                        </label>
                                    @endif
                                </div>
                                <div class="space-y-3 rounded-xl border border-violet-200 bg-violet-50/60 p-3" data-draft-ai-generator>
                                    <div>
                                        <h3 class="text-sm font-black text-violet-900">Generate more questions</h3>
                                        <p class="mt-1 text-xs text-slate-600">Add generated questions to this draft. You can review or edit them before saving.</p>
                                    </div>
                                    <textarea rows="3" class="portal-field w-full" data-draft-module-text placeholder="Paste lesson notes or module content..."></textarea>
                                    <label class="flex w-full cursor-pointer items-center gap-3 rounded-lg border border-violet-200 bg-white p-2.5">
                                        <input type="file" accept=".txt,.pdf,.docx" class="sr-only" data-draft-module-file>
                                        <span class="rounded-lg bg-violet-100 px-3 py-2 text-xs font-black text-violet-700">Choose file</span>
                                        <span class="min-w-0 flex-1 truncate text-xs text-slate-500" data-draft-module-file-name>No file chosen</span>
                                    </label>
                                    <div class="grid gap-2 sm:grid-cols-[1fr_auto]">
                                        <select class="portal-field w-full" data-draft-question-count aria-label="Number of questions to generate">
                                            <option value="3">3 questions</option>
                                            <option value="5">5 questions</option>
                                            <option value="10" selected>10 questions</option>
                                            <option value="20">20 questions</option>
                                        </select>
                                        <button type="button" class="rounded-lg bg-violet-700 px-4 py-2 text-xs font-black text-white hover:bg-violet-800 disabled:cursor-wait disabled:opacity-60" data-generate-draft-questions>Generate and append</button>
                                    </div>
                                    <p class="text-xs text-slate-500" aria-live="polite" data-draft-ai-status>Up to {{ max(0, 50 - count($assignment->questions ?? [])) }} more questions can be added.</p>
                                </div>
                                <div data-draft-question-container class="space-y-5">
                                    @foreach($assignment->questions ?? [] as $index => $question)
                                        <div data-question-row class="space-y-2 rounded-lg border border-amber-200 bg-white p-3">
                                            <div class="flex items-center justify-between gap-3">
                                                <span class="text-xs font-black uppercase tracking-wide text-amber-800">Question {{ $index + 1 }}</span>
                                                <button type="button" data-remove-question class="text-xs font-bold text-rose-600">Remove</button>
                                            </div>
                                            <textarea name="questions[{{ $index }}][question]" rows="3" class="portal-field w-full resize-y whitespace-pre-wrap" placeholder="Question text" required>{{ $question['question'] ?? '' }}</textarea>
                                            <div class="grid grid-cols-2 gap-2">
                                                @foreach($question['choices'] ?? [] as $choice)
                                                    <textarea name="questions[{{ $index }}][choices][]" rows="2" class="portal-field w-full resize-y whitespace-pre-wrap" placeholder="Choice" required>{{ $choice }}</textarea>
                                                @endforeach
                                            </div>
                                            <input type="text" name="questions[{{ $index }}][answer]" value="{{ $question['answer'] ?? '' }}" class="portal-field w-full" placeholder="Correct answer (exact text or A-F)" required>
                                        </div>
                                    @endforeach
                                </div>
                                <div class="flex flex-wrap gap-2">
                                    <button type="button" data-add-draft-question class="rounded-lg border border-amber-300 px-3 py-2 text-xs font-black text-amber-900 hover:bg-amber-100">+ Add question</button>
                                    <button type="submit" class="rounded-lg bg-violet-700 px-4 py-2 text-xs font-black text-white hover:bg-violet-800">Save draft</button>
                                </div>
                                <p class="text-xs text-slate-500">Edit existing questions or add more, up to 50. Save the draft, then publish it when ready.</p>
                            </form>
                        </details>
                    @endif
                    @if(in_array($assignment->type, ['quiz', 'exam'], true) && !empty($assignment->questions))
                        <details class="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/40">
                            <summary class="cursor-pointer px-3 py-3 text-sm font-black text-emerald-900">
                                Preview {{ $assignment->type }} ({{ count($assignment->questions) }} questions and correct answers)
                            </summary>
                            <ol class="space-y-5 border-t border-emerald-100 p-3">
                                @foreach($assignment->questions as $index => $question)
                                    <li class="min-w-0 rounded-lg border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-700">
                                        <p class="whitespace-pre-wrap break-words font-bold text-slate-900">{{ $index + 1 }}. {{ $question['question'] ?? '' }}</p>
                                        @if(!empty($question['choices']))
                                            <ol class="mt-2 list-[upper-alpha] space-y-1 pl-6">
                                                @foreach($question['choices'] as $choice)
                                                    <li class="whitespace-pre-wrap break-words">{{ $choice }}</li>
                                                @endforeach
                                            </ol>
                                        @endif
                                        <p class="mt-2 whitespace-pre-wrap break-words font-bold text-emerald-800">
                                            Correct answer: {{ $question['answer'] ?? 'Not set' }}
                                        </p>
                                        @if(!empty($question['explanation']))
                                            <p class="mt-1 whitespace-pre-wrap break-words text-slate-600">
                                                Explanation: {{ $question['explanation'] }}
                                            </p>
                                        @endif
                                    </li>
                                @endforeach
                            </ol>
                        </details>
                    @endif
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
                                            @if(in_array($assignment->type, ['quiz', 'exam'], true))
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
                                            @if(in_array($assignment->type, ['quiz', 'exam'], true))
                                                <ol class="space-y-5">
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
            @if(count($assignments) > 0)
                <p id="work-no-results" class="hidden p-8 text-center text-sm text-slate-500">No work matches your search or filters.</p>
            @endif
        </div>
    </section>
</div>
@push('scripts')
<script>
    (() => {
        const createWorkDialog = document.getElementById('create-work-dialog');
        const typeSelect = document.getElementById('work-type');
        const quizBuilder = document.getElementById('quiz-question-builder');
        const quizContainer = document.getElementById('quiz-questions-container');
        const addQuestionButton = document.getElementById('add-quiz-question');
        const questionBuilderTitle = document.getElementById('question-builder-title');
        const examDurationField = document.getElementById('exam-duration-field');
        const examDurationInput = document.getElementById('exam-duration-minutes');
        const aiModuleText = document.getElementById('ai-module-text');
        const aiModuleFile = document.getElementById('ai-module-file');
        const aiModuleFileName = document.getElementById('ai-module-file-name');
        const aiQuestionCount = document.getElementById('ai-question-count');
        const generateAiButton = document.getElementById('generate-ai-quiz');
        const aiStatus = document.getElementById('ai-quiz-status');
        const workSearch = document.getElementById('work-search');
        const workTypeFilter = document.getElementById('work-type-filter');
        const workStatusFilter = document.getElementById('work-status-filter');
        const workPeriodFilter = document.getElementById('work-period-filter');
        const workSchoolYearFilter = document.getElementById('work-school-year-filter');
        const workSemesterFilter = document.getElementById('work-semester-filter');
        const workCards = Array.from(document.querySelectorAll('[data-work-card]'));
        const workNoResults = document.getElementById('work-no-results');
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
        const generateQuizUrl = @json(route('teacher.assignments.generate-quiz'));

        const filterWork = () => {
            const query = workSearch.value.trim().toLocaleLowerCase();
            const selectedType = workTypeFilter.value;
            const selectedStatus = workStatusFilter.value;
            const selectedPeriod = workPeriodFilter.value;
            const selectedSchoolYear = workSchoolYearFilter.value;
            const selectedSemester = workSemesterFilter.value;
            let visibleCount = 0;

            workCards.forEach((card) => {
                const matches = (!query || card.dataset.workSearch.toLocaleLowerCase().includes(query))
                    && (!selectedType || card.dataset.workType === selectedType)
                    && (!selectedStatus || card.dataset.workStatus === selectedStatus)
                    && (!selectedPeriod || card.dataset.workPeriod === selectedPeriod)
                    && (!selectedSchoolYear || card.dataset.workSchoolYear === selectedSchoolYear)
                    && (!selectedSemester || card.dataset.workSemester === selectedSemester);
                card.hidden = !matches;
                if (matches) visibleCount += 1;
            });

            if (workNoResults) {
                workNoResults.classList.toggle('hidden', visibleCount > 0);
            }
        };

        workSearch.addEventListener('input', filterWork);
        workTypeFilter.addEventListener('change', filterWork);
        workStatusFilter.addEventListener('change', filterWork);
        workPeriodFilter.addEventListener('change', filterWork);
        workSchoolYearFilter.addEventListener('change', filterWork);
        workSemesterFilter.addEventListener('change', filterWork);

        createWorkDialog.addEventListener('click', (event) => {
            if (event.target === createWorkDialog) {
                createWorkDialog.close();
            }
        });

        if (@json($errors->any())) {
            createWorkDialog.showModal();
        }

        aiModuleFile.addEventListener('change', () => {
            aiModuleFileName.textContent = aiModuleFile.files[0]?.name || 'No file chosen';
            aiModuleFileName.classList.toggle('text-slate-500', !aiModuleFile.files.length);
            aiModuleFileName.classList.toggle('font-semibold', Boolean(aiModuleFile.files.length));
            aiModuleFileName.classList.toggle('text-slate-800', Boolean(aiModuleFile.files.length));
        });

        const reindexQuestionRows = () => {
            Array.from(quizContainer.children).forEach((wrapper, index) => {
                wrapper.querySelector('span').textContent = `Question ${index + 1}`;
                wrapper.querySelectorAll('input[name^="questions["], textarea[name^="questions["]').forEach((input) => {
                    input.name = input.name.replace(/^questions\[\d+\]/, `questions[${index}]`);
                });
            });
        };

        const createQuestionRow = (data = null) => {
            if (quizContainer.children.length >= 50) {
                return false;
            }
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
                <textarea name="questions[${index}][question]" rows="3" class="portal-field w-full resize-y whitespace-pre-wrap" placeholder="Question text" required>${escapeHtml(questionText)}</textarea>
                <div class="grid grid-cols-2 gap-2">
                    <textarea name="questions[${index}][choices][]" rows="2" class="portal-field w-full resize-y whitespace-pre-wrap" placeholder="Choice A" required>${escapeHtml(choices[0] ?? '')}</textarea>
                    <textarea name="questions[${index}][choices][]" rows="2" class="portal-field w-full resize-y whitespace-pre-wrap" placeholder="Choice B" required>${escapeHtml(choices[1] ?? '')}</textarea>
                    <textarea name="questions[${index}][choices][]" rows="2" class="portal-field w-full resize-y whitespace-pre-wrap" placeholder="Choice C" required>${escapeHtml(choices[2] ?? '')}</textarea>
                    <textarea name="questions[${index}][choices][]" rows="2" class="portal-field w-full resize-y whitespace-pre-wrap" placeholder="Choice D" required>${escapeHtml(choices[3] ?? '')}</textarea>
                </div>
                <input type="text" name="questions[${index}][answer]" class="portal-field w-full" value="${escapeHtml(answerText)}" placeholder="Correct answer (exact text or A-D)" required>
            `;

            wrapper.querySelector('[data-remove-question]').addEventListener('click', () => {
                wrapper.remove();
                reindexQuestionRows();
            });
            quizContainer.appendChild(wrapper);
            reindexQuestionRows();
            return true;
        };

        const escapeHtml = (value) => {
            return String(value ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        };

        const reindexDraftQuestions = (container) => {
            Array.from(container.children).forEach((wrapper, index) => {
                wrapper.querySelector('span').textContent = `Question ${index + 1}`;
                wrapper.querySelectorAll('[name^="questions["]').forEach((input) => {
                    input.name = input.name.replace(/^questions\[\d+\]/, `questions[${index}]`);
                });
            });
        };

        const addDraftQuestion = (container, data = null) => {
            if (container.children.length >= 50) {
                return false;
            }
            const index = container.children.length;
            const wrapper = document.createElement('div');
            wrapper.dataset.questionRow = '';
            wrapper.className = 'space-y-2 rounded-lg border border-amber-200 bg-white p-3';
            const choices = Array.isArray(data?.choices) ? data.choices : ['', '', '', ''];
            wrapper.innerHTML = `
                <div class="flex items-center justify-between gap-3">
                    <span class="text-xs font-black uppercase tracking-wide text-amber-800">Question ${index + 1}</span>
                    <button type="button" data-remove-question class="text-xs font-bold text-rose-600">Remove</button>
                </div>
                <textarea name="questions[${index}][question]" rows="3" class="portal-field w-full resize-y whitespace-pre-wrap" placeholder="Question text" required>${escapeHtml(data?.question ?? '')}</textarea>
                <div class="grid grid-cols-2 gap-2">
                    <textarea name="questions[${index}][choices][]" rows="2" class="portal-field w-full resize-y whitespace-pre-wrap" placeholder="Choice A" required>${escapeHtml(choices[0] ?? '')}</textarea>
                    <textarea name="questions[${index}][choices][]" rows="2" class="portal-field w-full resize-y whitespace-pre-wrap" placeholder="Choice B" required>${escapeHtml(choices[1] ?? '')}</textarea>
                    <textarea name="questions[${index}][choices][]" rows="2" class="portal-field w-full resize-y whitespace-pre-wrap" placeholder="Choice C" required>${escapeHtml(choices[2] ?? '')}</textarea>
                    <textarea name="questions[${index}][choices][]" rows="2" class="portal-field w-full resize-y whitespace-pre-wrap" placeholder="Choice D" required>${escapeHtml(choices[3] ?? '')}</textarea>
                </div>
                <input type="text" name="questions[${index}][answer]" class="portal-field w-full" value="${escapeHtml(data?.answer ?? '')}" placeholder="Correct answer (exact text or A-D)" required>
            `;
            container.appendChild(wrapper);
            return true;
        };

        document.addEventListener('click', (event) => {
            const addButton = event.target.closest('[data-add-draft-question]');
            const removeButton = event.target.closest('[data-remove-question]');
            if (!addButton && !removeButton) {
                return;
            }

            const form = event.target.closest('form');
            const container = form?.querySelector('[data-draft-question-container]');
            if (!container) {
                return;
            }

            if (addButton) {
                if (!addDraftQuestion(container)) {
                    const status = form.querySelector('[data-draft-ai-status]');
                    if (status) {
                        status.textContent = 'Quizzes and exams are limited to 50 questions.';
                        status.className = 'text-xs text-amber-600';
                    }
                }
                reindexDraftQuestions(container);
            } else {
                removeButton.closest('[data-question-row]')?.remove();
                reindexDraftQuestions(container);
            }
        });

        document.querySelectorAll('[data-draft-ai-generator]').forEach((generator) => {
            const form = generator.closest('form');
            const button = generator.querySelector('[data-generate-draft-questions]');
            const textInput = generator.querySelector('[data-draft-module-text]');
            const fileInput = generator.querySelector('[data-draft-module-file]');
            const fileName = generator.querySelector('[data-draft-module-file-name]');
            const countSelect = generator.querySelector('[data-draft-question-count]');
            const status = generator.querySelector('[data-draft-ai-status]');
            const questionsContainer = form?.querySelector('[data-draft-question-container]');

            fileInput.addEventListener('change', () => {
                fileName.textContent = fileInput.files[0]?.name || 'No file chosen';
                fileName.classList.toggle('font-semibold', Boolean(fileInput.files.length));
                fileName.classList.toggle('text-slate-800', Boolean(fileInput.files.length));
                fileName.classList.toggle('text-slate-500', !fileInput.files.length);
            });

            button.addEventListener('click', async () => {
                const text = textInput.value.trim();
                const file = fileInput.files[0];
                const currentCount = questionsContainer.children.length;
                const remaining = 50 - currentCount;

                if (!text && !file) {
                    status.textContent = 'Enter lesson text or choose a file before generating.';
                    status.className = 'text-xs text-amber-600';
                    return;
                }
                if (remaining < 3) {
                    status.textContent = remaining === 0
                        ? 'This draft already has the maximum of 50 questions.'
                        : `Only ${remaining} question(s) remain. At least 3 are required per generation.`;
                    status.className = 'text-xs text-amber-600';
                    return;
                }

                const formData = new FormData();
                if (text) formData.append('module_text', text);
                if (file) formData.append('module_file', file);
                formData.append('question_count', String(Math.min(Number(countSelect.value), remaining)));

                button.disabled = true;
                status.textContent = 'Generating questions...';
                status.className = 'text-xs text-slate-500';

                try {
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
                        throw new Error(`Question generation failed (${response.status}). The server returned an unexpected response.`);
                    }
                    if (!response.ok) {
                        throw new Error(data.message || 'AI question generation failed.');
                    }
                    if (!Array.isArray(data.questions) || data.questions.length === 0) {
                        throw new Error('No questions were generated. Try adding more lesson content.');
                    }

                    let addedCount = 0;
                    data.questions.forEach((question) => {
                        if (addDraftQuestion(questionsContainer, question)) addedCount += 1;
                    });
                    reindexDraftQuestions(questionsContainer);
                    status.textContent = `Added ${addedCount} question(s). This draft now has ${questionsContainer.children.length}/50 questions.`;
                    status.className = 'text-xs font-semibold text-emerald-700';
                } catch (error) {
                    status.textContent = error.message || 'AI question generation failed.';
                    status.className = 'text-xs text-rose-600';
                } finally {
                    button.disabled = false;
                }
            });
        });

        const appendGeneratedQuestions = (questions) => {
            if (!Array.isArray(questions) || questions.length === 0) {
                aiStatus.textContent = 'No quiz questions were generated. Try a longer lesson summary.';
                aiStatus.className = 'text-xs text-amber-600';
                return;
            }

            const currentCount = quizContainer.children.length;
            questions.forEach((question) => createQuestionRow(question));
            syncQuizBuilder();
            const workType = typeSelect.value;
            const addedCount = quizContainer.children.length - currentCount;
            aiStatus.textContent = addedCount < questions.length
                ? `Added ${addedCount} question(s); ${workType}s are limited to 50 questions.`
                : `${addedCount} question(s) added. ${quizContainer.children.length} question(s) in the ${workType}.`;
            aiStatus.className = addedCount < questions.length ? 'text-xs text-amber-600' : 'text-xs text-emerald-700';
        };

        const syncQuizBuilder = (addInitialQuestion = true) => {
            const hasQuestions = ['quiz', 'exam'].includes(typeSelect.value);
            const isExam = typeSelect.value === 'exam';
            quizBuilder.classList.toggle('hidden', !hasQuestions);
            examDurationField.classList.toggle('hidden', !isExam);
            examDurationInput.disabled = !isExam;
            examDurationInput.required = isExam;
            questionBuilderTitle.textContent = isExam ? 'Exam Questions' : 'Quiz Questions';

            if (hasQuestions && addInitialQuestion && quizContainer.children.length === 0) {
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
                if (!['quiz', 'exam'].includes(typeSelect.value)) {
                    typeSelect.value = 'quiz';
                }
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
