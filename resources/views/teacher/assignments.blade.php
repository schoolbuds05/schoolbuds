@extends('layouts.portal', ['title' => 'Class Work'])

@section('content')
<div class="mb-6">
    <h1 class="text-2xl font-black text-slate-900">Class Work</h1>
    <p class="mt-1 text-sm text-slate-500">Create assignments and quizzes for assigned section subjects.</p>
</div>

<div class="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
    <section class="portal-card h-fit p-5">
        <h2 class="font-black text-slate-800">New Work</h2>
        <form method="POST" action="{{ route('teacher.assignments.store') }}" class="mt-4 space-y-3">
            @csrf
            <select name="section_subject_id" class="portal-field w-full" required>
                <option value="">Choose class subject</option>
                @foreach($sectionSubjects as $sectionSubject)
                    <option value="{{ $sectionSubject->id }}">
                        {{ $sectionSubject->section?->name }} - {{ $sectionSubject->subject?->name }}
                    </option>
                @endforeach
            </select>
            <select name="type" class="portal-field w-full" required>
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
                            <p class="mt-1 text-sm text-slate-500">
                                {{ ucfirst($assignment->type) }} · {{ $assignment->sectionSubject?->section?->name }} - {{ $assignment->sectionSubject?->subject?->name }}
                            </p>
                        </div>
                        <span class="rounded-full bg-violet-50 px-3 py-1 text-xs font-black text-violet-700">{{ ucfirst($assignment->status) }}</span>
                    </div>
                    <p class="mt-3 text-sm text-slate-600">{{ $assignment->instructions ?: 'No instructions.' }}</p>
                    <p class="mt-3 text-xs font-bold text-slate-400">
                        {{ (float) $assignment->points_possible }} points · {{ $assignment->submissions_count }} submissions · Due {{ $assignment->due_at?->format('Y-m-d H:i') ?? 'anytime' }}
                    </p>
                </div>
            @empty
                <p class="p-10 text-center text-sm text-slate-500">No class work posted yet.</p>
            @endforelse
        </div>
    </section>
</div>
@endsection
