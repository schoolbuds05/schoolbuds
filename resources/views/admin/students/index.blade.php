@extends('layouts.portal', ['title' => 'Students'])

@section('content')
<div class="mb-6 flex items-end justify-between gap-4">
    <div>
        <h1 class="text-2xl font-black text-slate-900">Students</h1>
        <p class="mt-1 text-sm text-slate-500">Browse student records, family details, academics, attendance, and fees.</p>
    </div>
</div>

@if (session('status'))
    <div class="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{{ session('status') }}</div>
@endif
@if ($errors->has('file'))
    <div class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{{ $errors->first('file') }}</div>
@endif

<div class="mb-5 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
    <div>
        <p class="text-sm font-bold text-slate-800">Student data CSV</p>
        <p class="mt-1 text-xs text-slate-500">Download the template, import a CSV file, or export the student list.</p>
    </div>
    <div class="flex flex-wrap items-center gap-2">
        <a href="{{ route($routePrefix . '.students.template') }}" class="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">Download template</a>
        <a href="{{ route($routePrefix . '.students.export') }}" class="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">Export CSV</a>
        <form method="POST" action="{{ route($routePrefix . '.students.import') }}" enctype="multipart/form-data" class="flex flex-wrap items-center gap-2">
            @csrf
            <input type="file" name="file" accept=".csv,text/csv" required class="max-w-56 text-xs text-slate-600 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-bold file:text-slate-700">
            <button class="rounded-lg bg-portal-accent px-4 py-2 text-sm font-bold text-white hover:bg-portal-accent-hover">Import CSV</button>
        </form>
    </div>
</div>

<div class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <form method="GET" action="{{ route($routePrefix . '.students.index') }}" class="flex w-full items-center gap-2 sm:max-w-xl">
        <div class="relative flex-1">
            <svg class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="6"/><path stroke-linecap="round" d="M16 16l5 5"/></svg>
            <input name="search" value="{{ request('search') }}" placeholder="Search name or student ID" class="w-full rounded-lg border border-slate-300 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none">
        </div>
        <input type="hidden" name="year_level" value="{{ request('year_level') }}">
        <input type="hidden" name="school_year" value="{{ request('school_year') }}">
        <input type="hidden" name="course" value="{{ request('course') }}">
        <button type="submit" class="shrink-0 rounded-lg bg-portal-accent px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-portal-accent-hover">Search</button>
    </form>

    <details class="group relative z-30 shrink-0">
        <summary class="inline-flex cursor-pointer list-none items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M7 12h10M10 18h4"/></svg>
            Filters
            <svg class="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="m6 9 6 6 6-6"/></svg>
        </summary>
        <form method="GET" action="{{ route($routePrefix . '.students.index') }}" class="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
            <input type="hidden" name="search" value="{{ request('search') }}">
            <h2 class="text-sm font-black text-slate-900">Filter students</h2>
            <p class="mt-1 text-xs text-slate-500">Narrow the list by academic details.</p>
            <div class="mt-4 grid gap-3">
                <label class="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Year level
                    <select name="year_level" class="mt-1 w-full rounded-lg border-slate-300 text-sm text-slate-900">
                        <option value="">All year levels</option>
                        @foreach($yearLevels as $yearLevel)
                            <option value="{{ $yearLevel }}" @selected(request('year_level') === $yearLevel)>{{ $yearLevel }}</option>
                        @endforeach
                    </select>
                </label>
                <label class="text-xs font-bold uppercase tracking-wide text-slate-500">
                    School year
                    <select name="school_year" class="mt-1 w-full rounded-lg border-slate-300 text-sm text-slate-900">
                        <option value="">All school years</option>
                        @foreach($schoolYears as $schoolYear)
                            <option value="{{ $schoolYear }}" @selected(request('school_year') === $schoolYear)>{{ $schoolYear }}</option>
                        @endforeach
                    </select>
                </label>
                <label class="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Course / strand
                    <select name="course" class="mt-1 w-full rounded-lg border-slate-300 text-sm text-slate-900">
                        <option value="">All courses and strands</option>
                        @foreach($courseOptions as $courseOption)
                            <option value="{{ $courseOption }}" @selected(request('course') === $courseOption)>{{ $courseOption }}</option>
                        @endforeach
                    </select>
                </label>
            </div>
            <div class="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-3">
                <a href="{{ route($routePrefix . '.students.index') }}" class="rounded-lg border border-red-700 bg-white px-3 py-2 text-sm font-bold text-red-700 hover:bg-red-50">Reset</a>
                <button type="submit" class="portal-filter-button rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-700">Apply</button>
            </div>
        </form>
    </details>
</div>

<div class="space-y-3">
    @forelse($students as $student)
        @php
            $statusClass = $student->status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600';
            $fullName = trim(implode(' ', array_filter([$student->first_name, $student->middle_name, $student->last_name])));
            $initials = strtoupper(substr($student->first_name, 0, 1) . substr($student->last_name, 0, 1));
        @endphp
        <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" data-student-card>
            <button
                type="button"
                class="flex w-full items-center justify-between gap-4 p-4 text-left transition-colors hover:bg-slate-50"
                onclick="this.closest('[data-student-card]').querySelector('[data-student-details]').classList.toggle('hidden'); this.querySelector('[data-arrow]').classList.toggle('rotate-180');"
            >
                <div class="flex min-w-0 items-center gap-3">
                    <span class="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-violet-100 text-xs font-black text-violet-700" aria-hidden="true">
                        @if($student->user?->profile_photo_url)
                            <img src="{{ $student->user->profile_photo_url }}" alt="" class="h-full w-full object-cover">
                        @else
                            {{ $initials }}
                        @endif
                    </span>
                    <span class="inline-flex items-center rounded-lg bg-portal-accent-soft px-2.5 py-1 text-xs font-black text-portal-accent">{{ $student->student_id }}</span>
                    <div class="min-w-0">
                        <p class="truncate text-sm font-bold text-slate-900">{{ $fullName }}</p>
                        <p class="mt-0.5 text-xs text-slate-400">{{ $student->email }} · {{ $student->grade_level }} · {{ $student->section ?: 'TBA' }} · {{ $student->school_year }}</p>
                    </div>
                </div>
                <div class="flex shrink-0 items-center gap-3">
                    <span class="hidden rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600 sm:inline-flex">{{ $student->gender }}</span>
                    <span class="rounded-full px-2 py-1 text-xs font-bold {{ $statusClass }}">{{ ucfirst($student->status) }}</span>
                    <svg data-arrow class="h-4 w-4 text-slate-400 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                </div>
            </button>

            <div data-student-details class="hidden border-t border-slate-100">
                <div class="bg-slate-50 px-4 py-3">
                    <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p class="text-xs font-black uppercase tracking-wide text-slate-400">Student information</p>
                            <p class="mt-1 text-xs text-slate-500">Phone: {{ $student->phone ?: 'Not set' }} · Birthdate: {{ $student->birthdate ?: 'Not set' }}</p>
                            <p class="mt-1 text-xs text-slate-500">Mother: {{ $student->mother_name ?: 'Not set' }} · Father: {{ $student->father_name ?: 'Not set' }}</p>
                        </div>
                        <a href="{{ route(($routePrefix ?? 'admin') . '.students.show', $student) }}" class="portal-button-primary">Open full record</a>
                    </div>
                </div>

                <div class="grid grid-cols-1 gap-4 p-4 text-sm md:grid-cols-4">
                    <div><p class="text-xs font-black uppercase text-slate-400">Student ID</p><p class="mt-1 font-bold text-slate-800">{{ $student->student_id }}</p></div>
                    <div><p class="text-xs font-black uppercase text-slate-400">First name</p><p class="mt-1 font-bold text-slate-800">{{ $student->first_name }}</p></div>
                    <div><p class="text-xs font-black uppercase text-slate-400">Middle name</p><p class="mt-1 font-bold text-slate-800">{{ $student->middle_name ?: 'Not set' }}</p></div>
                    <div><p class="text-xs font-black uppercase text-slate-400">Last name</p><p class="mt-1 font-bold text-slate-800">{{ $student->last_name }}</p></div>
                    <div><p class="text-xs font-black uppercase text-slate-400">Email</p><p class="mt-1 font-bold text-slate-800">{{ $student->email ?: 'Not set' }}</p></div>
                    <div><p class="text-xs font-black uppercase text-slate-400">Phone</p><p class="mt-1 font-bold text-slate-800">{{ $student->phone ?: 'Not set' }}</p></div>
                    <div><p class="text-xs font-black uppercase text-slate-400">Birthdate</p><p class="mt-1 font-bold text-slate-800">{{ $student->birthdate ?: 'Not set' }}</p></div>
                    <div><p class="text-xs font-black uppercase text-slate-400">Gender</p><p class="mt-1 font-bold text-slate-800">{{ ucfirst($student->gender) }}</p></div>
                    <div><p class="text-xs font-black uppercase text-slate-400">Status</p><p class="mt-1 font-bold text-slate-800">{{ ucfirst($student->status) }}</p></div>
                    <div class="md:col-span-4"><p class="text-xs font-black uppercase text-slate-400">Address</p><p class="mt-1 font-bold text-slate-800">{{ $student->address ?: 'Not set' }}</p></div>
                    <div><p class="text-xs font-black uppercase text-slate-400">Mother name</p><p class="mt-1 font-bold text-slate-800">{{ $student->mother_name ?: 'Not set' }}</p></div>
                    <div><p class="text-xs font-black uppercase text-slate-400">Mother occupation</p><p class="mt-1 font-bold text-slate-800">{{ $student->mother_occupation ?: 'Not set' }}</p></div>
                    <div><p class="text-xs font-black uppercase text-slate-400">Father name</p><p class="mt-1 font-bold text-slate-800">{{ $student->father_name ?: 'Not set' }}</p></div>
                    <div><p class="text-xs font-black uppercase text-slate-400">Father occupation</p><p class="mt-1 font-bold text-slate-800">{{ $student->father_occupation ?: 'Not set' }}</p></div>
                    <div><p class="text-xs font-black uppercase text-slate-400">Grade / year level</p><p class="mt-1 font-bold text-slate-800">{{ $student->grade_level ?: 'Not set' }}</p></div>
                    <div><p class="text-xs font-black uppercase text-slate-400">Section</p><p class="mt-1 font-bold text-slate-800">{{ $student->section ?: 'Not set' }}</p></div>
                    <div><p class="text-xs font-black uppercase text-slate-400">School year</p><p class="mt-1 font-bold text-slate-800">{{ $student->school_year ?: 'Not set' }}</p></div>
                    <div><p class="text-xs font-black uppercase text-slate-400">Academic status</p><p class="mt-1 font-bold text-slate-800">{{ $student->academic_status ?: 'Not set' }}</p></div>
                    <div><p class="text-xs font-black uppercase text-slate-400">Student type</p><p class="mt-1 font-bold text-slate-800">{{ $student->student_type ? str_replace('_', ' ', ucfirst($student->student_type)) : 'Not set' }}</p></div>
                    <div><p class="text-xs font-black uppercase text-slate-400">Previous school</p><p class="mt-1 font-bold text-slate-800">{{ $student->prev_school ?: 'Not set' }}</p></div>
                    <div class="md:col-span-2"><p class="text-xs font-black uppercase text-slate-400">Previous school address</p><p class="mt-1 font-bold text-slate-800">{{ $student->prev_school_address ?: 'Not set' }}</p></div>
                </div>
            </div>
        </div>
    @empty
        <div class="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <p class="text-sm font-black text-slate-800">No students found</p>
            <p class="mt-1 text-sm text-slate-500">Try changing your search or filters.</p>
        </div>
    @endforelse

    <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">{{ $students->links() }}</div>
</div>
@endsection
