@extends('layouts.portal', ['title' => 'Courses'])

@section('content')
<div class="mb-6">
    <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
            <h1 class="text-2xl font-black text-slate-900">Courses</h1>
            <p class="mt-1 text-sm text-slate-500">Manage college courses and SHS strands/programs used during enrollment.</p>
        </div>

        <div class="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
            <form method="GET" class="flex w-full items-center gap-2 md:w-[420px]">
                <div class="relative flex-1">
                    <svg class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="6"/><path stroke-linecap="round" d="M16 16l5 5"/></svg>
                    <input name="search" value="{{ request('search') }}" placeholder="Search course or acronym" class="w-full rounded-lg border border-slate-300 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none">
                </div>
                <button type="submit" class="shrink-0 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800">Search</button>
            </form>

            <div class="flex items-center gap-2">
                <button type="button" data-modal-open="course-filter-modal" class="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50">
                    <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M7 12h10M10 18h4"/></svg>
                    Filters
                </button>
                <button type="button" data-modal-open="course-create-modal" class="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800">
                    <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" d="M12 5v14M5 12h14"/></svg>
                    Add course
                </button>
            </div>
        </div>
    </div>
</div>

<div id="course-filter-modal" data-modal class="fixed inset-0 z-50 hidden items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="course-filter-title" tabindex="-1">
    <section class="w-full max-w-xl overflow-hidden rounded-xl bg-white shadow-2xl">
        <header class="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
            <div>
                <h2 id="course-filter-title" class="text-lg font-black text-slate-900">Filter courses</h2>
                <p class="mt-1 text-sm text-slate-500">Choose the course program and status you want to view.</p>
            </div>
            <button type="button" data-modal-close="course-filter-modal" class="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">Close</button>
        </header>

        <form method="GET" class="grid grid-cols-1 gap-3 p-5 md:grid-cols-2">
            <label class="text-xs font-bold uppercase tracking-wide text-slate-500 md:col-span-2">
                Program
                <select name="program_type" class="mt-1 w-full rounded-lg border-slate-300 text-sm text-slate-900">
                    <option value="">All programs</option>
                    <option value="college" @selected(request('program_type') === 'college')>College</option>
                    <option value="shs" @selected(request('program_type') === 'shs')>SHS</option>
                </select>
            </label>

            <div class="flex items-center justify-end gap-2 pt-2 md:col-span-2">
                <a href="{{ route('registrar.courses.index') }}" class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">Reset</a>
                <button class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white">Apply</button>
            </div>
        </form>
    </section>
</div>

<div class="space-y-5">

    <div id="course-create-modal" data-modal class="fixed inset-0 z-50 hidden items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="course-create-title" tabindex="-1">
        <section class="w-full max-w-xl overflow-hidden rounded-xl bg-white shadow-2xl">
            <header class="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
                <div>
                    <h2 id="course-create-title" class="text-lg font-black text-slate-900">Add course</h2>
                    <p class="mt-1 text-sm text-slate-500">Add a college course or SHS strand.</p>
                </div>
                <button type="button" data-modal-close="course-create-modal" class="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">Close</button>
            </header>
            <form method="POST" action="{{ route('registrar.courses.store') }}" class="max-h-[calc(90vh-5rem)] space-y-3 overflow-y-auto p-5">
                @csrf
                <input data-modal-autofocus name="name" value="{{ old('name') }}" placeholder="Course or strand name" class="w-full rounded-lg border-slate-300 text-sm">
                <input name="acronym" value="{{ old('acronym') }}" placeholder="Acronym, e.g. BSIT" class="w-full rounded-lg border-slate-300 text-sm uppercase">
                <select name="program_type" class="w-full rounded-lg border-slate-300 text-sm">
                    <option value="college">College</option>
                    <option value="shs">SHS</option>
                </select>
                <textarea name="description" rows="3" placeholder="Description" class="w-full rounded-lg border-slate-300 text-sm">{{ old('description') }}</textarea>
                <label class="flex items-center gap-2 text-sm font-bold text-slate-700"><input type="checkbox" name="is_active" value="1" checked class="rounded border-slate-300"> Active</label>
                <button class="w-full rounded-lg bg-slate-950 py-2 text-sm font-bold text-white">Create course</button>
            </form>
        </section>
    </div>

    <section>
        <div class="space-y-3">
            @foreach($courses as $course)
                @php
                    $programLabel = $course->program_type === 'shs' ? 'SHS' : 'College';
                    $statusClass = $course->is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500';
                @endphp
                <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" data-course-card>
                    <button
                        type="button"
                        class="flex w-full items-center justify-between gap-4 p-4 text-left transition-colors hover:bg-slate-50"
                        onclick="this.closest('[data-course-card]').querySelector('[data-course-details]').classList.toggle('hidden'); this.querySelector('[data-arrow]').classList.toggle('rotate-180');"
                    >
                        <div class="flex min-w-0 items-center gap-3">
                            <span class="inline-flex items-center rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-black text-blue-600">
                                {{ $course->acronym ?: 'COURSE' }}
                            </span>
                            <div class="min-w-0">
                                <p class="truncate text-sm font-bold text-slate-900">{{ $course->name }}</p>
                                <p class="mt-0.5 text-xs text-slate-400">{{ $programLabel }} · {{ $course->description ?: 'No description' }}</p>
                            </div>
                        </div>
                        <div class="flex shrink-0 items-center gap-3">
                            <span class="inline-flex items-center rounded-md px-2 py-1 text-xs font-bold {{ $statusClass }}">
                                {{ $course->is_active ? 'Active' : 'Inactive' }}
                            </span>
                            <svg data-arrow class="h-4 w-4 text-slate-400 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                        </div>
                    </button>

                    <div data-course-details class="hidden border-t border-slate-100">
                        <div class="bg-slate-50 px-4 py-3">
                            <div class="flex items-center justify-between gap-4">
                                <div>
                                    <p class="text-xs font-black uppercase tracking-wide text-slate-400">Course details</p>
                                    <p class="mt-1 text-xs text-slate-500">
                                        Created: {{ optional($course->created_at)->format('M d, Y h:i A') }} · Updated: {{ optional($course->updated_at)->format('M d, Y h:i A') }}
                                    </p>
                                </div>
                                <button
                                    type="submit"
                                    form="delete-course-{{ $course->id }}"
                                    class="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700"
                                    onclick="return confirm('Archive and remove {{ addslashes($course->name) }}?');"
                                >
                                    Remove
                                </button>
                            </div>
                        </div>

                        <form method="POST" action="{{ route('registrar.courses.update', $course) }}" class="grid grid-cols-1 gap-4 p-4 md:grid-cols-4 md:items-end">
                            @csrf
                            @method('PUT')
                            <label class="text-xs font-bold uppercase text-slate-500 md:col-span-2">
                                Course or strand name
                                <input name="name" value="{{ $course->name }}" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                            </label>
                            <label class="text-xs font-bold uppercase text-slate-500">
                                Acronym
                                <input name="acronym" value="{{ $course->acronym }}" placeholder="BSIT" class="mt-1 w-full rounded-lg border-slate-300 text-sm uppercase text-slate-900">
                            </label>
                            <label class="text-xs font-bold uppercase text-slate-500">
                                Program type
                                <select name="program_type" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                                    <option value="college" @selected($course->program_type === 'college')>College</option>
                                    <option value="shs" @selected($course->program_type === 'shs')>SHS</option>
                                </select>
                            </label>
                            <label class="text-xs font-bold uppercase text-slate-500 md:col-span-4">
                                Description
                                <textarea name="description" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900" rows="2">{{ $course->description }}</textarea>
                            </label>
                            <label class="flex items-center gap-2 text-sm font-bold text-slate-700 md:pb-2">
                                <input type="checkbox" name="is_active" value="1" @checked($course->is_active) class="rounded border-slate-300"> Active
                            </label>
                            <button class="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white md:col-start-4">Save changes</button>
                        </form>
                    </div>
                </div>
                <form id="delete-course-{{ $course->id }}" method="POST" action="{{ route('registrar.courses.destroy', $course) }}" class="hidden">
                    @csrf
                    @method('DELETE')
                </form>
            @endforeach
            <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">{{ $courses->links() }}</div>
        </div>
    </section>
</div>
@endsection
