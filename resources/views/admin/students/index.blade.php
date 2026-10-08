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
            $fullName = trim($student->first_name . ' ' . $student->last_name);
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
                        <a href="{{ route(($routePrefix ?? 'admin') . '.students.show', $student) }}" class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white">Open full record</a>
                    </div>
                </div>

                <form method="POST" action="{{ route(($routePrefix ?? 'admin') . '.students.update', $student) }}" class="grid grid-cols-1 gap-4 p-4 md:grid-cols-4 md:items-end">
                    @csrf
                    @method('PUT')

                    <label class="text-xs font-bold uppercase text-slate-500">
                        Student ID
                        <input name="student_id" value="{{ old('student_id', $student->student_id) }}" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                    </label>
                    <label class="text-xs font-bold uppercase text-slate-500">
                        First name
                        <input name="first_name" value="{{ old('first_name', $student->first_name) }}" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                    </label>
                    <label class="text-xs font-bold uppercase text-slate-500">
                        Last name
                        <input name="last_name" value="{{ old('last_name', $student->last_name) }}" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                    </label>
                    <label class="text-xs font-bold uppercase text-slate-500">
                        Email
                        <input name="email" value="{{ old('email', $student->email) }}" type="email" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                    </label>

                    <label class="text-xs font-bold uppercase text-slate-500">
                        Phone
                        <input name="phone" value="{{ old('phone', $student->phone) }}" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                    </label>
                    <label class="text-xs font-bold uppercase text-slate-500">
                        Birthdate
                        <input name="birthdate" value="{{ old('birthdate', $student->birthdate) }}" type="date" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                    </label>
                    <label class="text-xs font-bold uppercase text-slate-500">
                        Gender
                        <select name="gender" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                            <option value="male" @selected(old('gender', $student->gender) === 'male')>Male</option>
                            <option value="female" @selected(old('gender', $student->gender) === 'female')>Female</option>
                        </select>
                    </label>
                    <label class="text-xs font-bold uppercase text-slate-500">
                        Status
                        <select name="status" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                            <option value="active" @selected(old('status', $student->status) === 'active')>Active</option>
                            <option value="inactive" @selected(old('status', $student->status) === 'inactive')>Inactive</option>
                            <option value="graduated" @selected(old('status', $student->status) === 'graduated')>Graduated</option>
                        </select>
                    </label>

                    <label class="text-xs font-bold uppercase text-slate-500 md:col-span-4">
                        Address
                        <input name="address" value="{{ old('address', $student->address) }}" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                    </label>

                    <label class="text-xs font-bold uppercase text-slate-500">
                        Mother name
                        <input name="mother_name" value="{{ old('mother_name', $student->mother_name) }}" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                    </label>
                    <label class="text-xs font-bold uppercase text-slate-500">
                        Mother occupation
                        <input name="mother_occupation" value="{{ old('mother_occupation', $student->mother_occupation) }}" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                    </label>
                    <label class="text-xs font-bold uppercase text-slate-500">
                        Father name
                        <input name="father_name" value="{{ old('father_name', $student->father_name) }}" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                    </label>
                    <label class="text-xs font-bold uppercase text-slate-500">
                        Father occupation
                        <input name="father_occupation" value="{{ old('father_occupation', $student->father_occupation) }}" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                    </label>

                    <label class="text-xs font-bold uppercase text-slate-500">
                        Grade / year level
                        <input name="grade_level" value="{{ old('grade_level', $student->grade_level) }}" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                    </label>
                    <label class="text-xs font-bold uppercase text-slate-500">
                        Section
                        <input name="section" value="{{ old('section', $student->section) }}" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                    </label>
                    <label class="text-xs font-bold uppercase text-slate-500">
                        School year
                        <input name="school_year" value="{{ old('school_year', $student->school_year) }}" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                    </label>
                    <label class="text-xs font-bold uppercase text-slate-500">
                        Academic status
                        <select name="academic_status" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                            <option value="">Not set</option>
                            <option value="Regular" @selected(old('academic_status', $student->academic_status) === 'Regular')>Regular</option>
                            <option value="Irregular" @selected(old('academic_status', $student->academic_status) === 'Irregular')>Irregular</option>
                        </select>
                    </label>

                    <label class="text-xs font-bold uppercase text-slate-500">
                        Student type
                        <select name="student_type" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                            <option value="">Not set</option>
                            <option value="new_student" @selected(old('student_type', $student->student_type) === 'new_student')>New student</option>
                            <option value="old_student" @selected(old('student_type', $student->student_type) === 'old_student')>Old student</option>
                            <option value="transferee" @selected(old('student_type', $student->student_type) === 'transferee')>Transferee</option>
                            <option value="shiftee" @selected(old('student_type', $student->student_type) === 'shiftee')>Shiftee</option>
                            <option value="returnee" @selected(old('student_type', $student->student_type) === 'returnee')>Returnee</option>
                        </select>
                    </label>
                    <label class="text-xs font-bold uppercase text-slate-500">
                        Previous school
                        <input name="prev_school" value="{{ old('prev_school', $student->prev_school) }}" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                    </label>
                    <label class="text-xs font-bold uppercase text-slate-500 md:col-span-2">
                        Previous school address
                        <input name="prev_school_address" value="{{ old('prev_school_address', $student->prev_school_address) }}" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                    </label>

                    <button class="rounded-lg bg-portal-accent px-4 py-2 text-sm font-bold text-white hover:bg-portal-accent-hover md:col-start-4">Save changes</button>
                </form>
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
