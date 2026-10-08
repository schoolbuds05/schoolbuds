@extends('layouts.portal', ['title' => 'Subjects'])

@section('content')
<div class="mb-6">
    <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
            <h1 class="text-2xl font-black text-slate-900">Subjects</h1>
            <p class="mt-1 text-sm text-slate-500">Maintain subject codes, units, program scope, and semester.</p>
        </div>

        <div class="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
            <form method="GET" action="{{ route('registrar.subjects.index') }}" class="flex w-full items-center gap-2 md:w-[420px]">
                <div class="relative flex-1">
                    <svg class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="6"/><path stroke-linecap="round" d="M16 16l5 5"/></svg>
                    <input type="text" name="search" value="{{ request('search') }}" placeholder="Search by code or name..." class="w-full rounded-lg border border-slate-300 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none">
                </div>
                <button type="submit" class="shrink-0 rounded-lg bg-portal-accent px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-portal-accent-hover">Search</button>
            </form>

            <div class="flex items-center gap-2">
                <details class="group relative z-30">
                    <summary class="inline-flex cursor-pointer list-none items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
                        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M7 12h10M10 18h4"/></svg>
                        Filters
                        <svg class="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="m6 9 6 6 6-6"/></svg>
                    </summary>
                    <form method="GET" action="{{ route('registrar.subjects.index') }}" class="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
                        <input type="hidden" name="search" value="{{ request('search') }}">
                        <h2 class="text-sm font-black text-slate-900">Filter subjects</h2>
                        <p class="mt-1 text-xs text-slate-500">Narrow by program and scope.</p>
                        <div class="mt-4 grid gap-3">
                            <label class="text-xs font-bold uppercase tracking-wide text-slate-500">
                                Program type
                                <select name="program_type" class="mt-1 w-full rounded-lg border-slate-300 text-sm text-slate-900">
                                    <option value="">All</option>
                                    <option value="college" @selected(request('program_type') === 'college')>College</option>
                                    <option value="shs" @selected(request('program_type') === 'shs')>SHS</option>
                                </select>
                            </label>
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
                                Course / strand
                                <select name="course" class="mt-1 w-full rounded-lg border-slate-300 text-sm text-slate-900">
                                    <option value="">All courses and strands</option>
                                    <optgroup label="College courses">
                                        <option value="__general__" @selected(request('course') === '__general__')>General college</option>
                                        @foreach($collegeScopes as $collegeScope)
                                            <option value="{{ $collegeScope }}" @selected(request('course') === $collegeScope)>{{ $collegeScope }}</option>
                                        @endforeach
                                    </optgroup>
                                    <optgroup label="SHS strands">
                                        <option value="__general_shs__" @selected(request('course') === '__general_shs__')>General SHS</option>
                                        @foreach($shsStrands as $strandScope)
                                            <option value="{{ $strandScope }}" @selected(request('course') === $strandScope)>{{ $strandScope }}</option>
                                        @endforeach
                                    </optgroup>
                                </select>
                            </label>
                            <label class="text-xs font-bold uppercase tracking-wide text-slate-500">
                                Semester
                                <select name="semester" class="mt-1 w-full rounded-lg border-slate-300 text-sm text-slate-900">
                                    <option value="">All semesters</option>
                                    <option value="1st" @selected(request('semester') === '1st')>1st</option>
                                    <option value="2nd" @selected(request('semester') === '2nd')>2nd</option>
                                    <option value="summer" @selected(request('semester') === 'summer')>Summer</option>
                                </select>
                            </label>
                        </div>
                        <div class="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-3">
                            <a href="{{ route('registrar.subjects.index') }}" class="rounded-lg border border-red-700 bg-white px-3 py-2 text-sm font-bold text-red-700 hover:bg-red-50">Reset</a>
                            <button type="submit" class="rounded-lg bg-portal-accent px-3 py-2 text-sm font-bold text-white hover:bg-portal-accent-hover">Apply</button>
                        </div>
                    </form>
                </details>
                <button type="button" data-modal-open="subject-create-modal" class="inline-flex items-center gap-2 rounded-lg bg-portal-accent px-4 py-2.5 text-sm font-bold text-white hover:bg-portal-accent-hover">
                    <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" d="M12 5v14M5 12h14"/></svg>
                    Add subject
                </button>
            </div>
        </div>
    </div>
</div>

<div id="subject-create-modal" data-modal class="fixed inset-0 z-50 hidden items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="subject-create-title" tabindex="-1">
    <section class="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <header class="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
            <div>
                <h2 id="subject-create-title" class="text-lg font-black text-slate-900">Create subject</h2>
                <p class="mt-1 text-sm text-slate-500">Enter subject details and enrollment scope.</p>
            </div>
            <button type="button" data-modal-close="subject-create-modal" class="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">Close</button>
        </header>
<form method="POST" action="{{ route('registrar.subjects.store') }}" class="subject-form min-h-0 flex-1 overflow-y-auto p-5">
    @csrf
    <div class="grid grid-cols-1 gap-4 md:grid-cols-4">
        <label class="text-xs font-bold uppercase text-slate-500">
            Subject code
            <input name="code" maxlength="20" required placeholder="e.g. IT101" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
        </label>
        <label class="text-xs font-bold uppercase text-slate-500 md:col-span-2">
            Subject name
            <input name="name" maxlength="255" required placeholder="e.g. Introduction to Programming" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
        </label>
        <label class="text-xs font-bold uppercase text-slate-500 md:col-span-4">
            Description
            <textarea name="description" rows="2" placeholder="Optional description" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900"></textarea>
        </label>
        <label class="text-xs font-bold uppercase text-slate-500">
            Program type
            <select name="program_type" required class="program-type mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900"><option value="college">College</option><option value="shs">SHS</option></select>
        </label>
        <label class="course-wrap text-xs font-bold uppercase text-slate-500">
            College course
            <select name="course" class="course-field mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                <option value="">General (all college courses)</option>
                @foreach($courses as $course)
                    <option value="{{ $course->name }}">{{ $course->name }}</option>
                @endforeach
            </select>
            <span class="mt-1 block text-[11px] font-normal normal-case text-slate-400">General subjects are available to every college course at the matching year and semester.</span>
        </label>
        <label class="strand-wrap text-xs font-bold uppercase text-slate-500">
            SHS strand
            <select name="strand" class="strand-field mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                <option value="">General (all SHS strands)</option>
                @foreach(['STEM', 'ABM', 'HUMSS', 'TVL', 'GAS'] as $strand)
                    <option value="{{ $strand }}">{{ $strand }}</option>
                @endforeach
            </select>
        </label>
        <label class="text-xs font-bold uppercase text-slate-500">
            Year / grade level
            <input name="year_level" placeholder="College: 1-4, SHS: 11-12" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
        </label>
        <label class="text-xs font-bold uppercase text-slate-500">
            Semester
            <select name="semester" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900"><option value="1st">1st</option><option value="2nd">2nd</option><option value="summer">Summer</option></select>
        </label>
        <label class="text-xs font-bold uppercase text-slate-500">
            Lecture units
            <input name="units_lec" type="number" min="0" step="any" value="3" placeholder="e.g. 3" required class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
        </label>
        <label class="text-xs font-bold uppercase text-slate-500">
            Lab units
            <input name="units_lab" type="number" min="0" step="any" value="0" placeholder="e.g. 0" required class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
        </label>
        <div class="md:col-span-4">
            <p class="text-xs font-bold uppercase text-slate-500 mb-2">Prerequisites</p>
            <p class="text-xs text-slate-400 mb-2">Select subjects that must be completed before this one.</p>
            <div class="prereq-list max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2 grid grid-cols-1 gap-1 md:grid-cols-3">
                @foreach($allSubjects as $prereqSubject)
                    <label class="prereq-option flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-white cursor-pointer transition-colors" data-program="{{ $prereqSubject->program_type }}">
                        <input type="checkbox" name="prerequisite_ids[]" value="{{ $prereqSubject->id }}" class="rounded border-slate-300 text-portal-accent">
                        <span class="font-semibold text-portal-accent">{{ $prereqSubject->code }}</span>
                        <span class="truncate">{{ $prereqSubject->name }}</span>
                    </label>
                @endforeach
            </div>
        </div>
        <label class="flex items-center gap-2 text-sm font-bold text-slate-700 md:pt-6"><input type="checkbox" name="is_active" value="1" checked class="rounded border-slate-300"> Active for enrollment</label>
        <button class="rounded-lg bg-portal-accent px-4 py-2 text-sm font-bold text-white hover:bg-portal-accent-hover md:mt-5">Create subject</button>
    </div>
</form>
    </section>
</div>

<div class="space-y-3">
    @foreach($subjects as $subject)
        @php
            $isCollege = $subject->program_type === 'college';
            $programLabel = $isCollege ? 'College' : 'SHS';
            $scopeLabel = $isCollege
                ? ($subject->course ?: 'General')
                : ($subject->strand ?: 'General');
            $levelLabel = $subject->year_level
                ? ($isCollege ? 'Year '.$subject->year_level : 'Grade '.$subject->year_level)
                : 'Any level';
            $semesterLabel = $subject->semester ? ucfirst($subject->semester).' sem' : '—';
            $totalUnits = (float) $subject->units_lec + (float) $subject->units_lab;
        @endphp
        <div class="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden" data-subject-card>
            {{-- ── Collapsed summary row (always visible) ── --}}
            <button
                type="button"
                class="subject-toggle flex w-full items-center justify-between gap-4 p-4 text-left hover:bg-slate-50 transition-colors"
                onclick="this.closest('[data-subject-card]').querySelector('[data-subject-details]').classList.toggle('hidden'); this.querySelector('[data-arrow]').classList.toggle('rotate-180');"
            >
                <div class="flex items-center gap-3 min-w-0">
                    <span class="inline-flex items-center rounded-lg bg-portal-accent-soft px-2.5 py-1 text-xs font-black text-portal-accent whitespace-nowrap">{{ $subject->code }}</span>
                    <div class="min-w-0">
                        <p class="text-sm font-bold text-slate-900 truncate">{{ $subject->name }}</p>
                        <p class="text-xs text-slate-400 mt-0.5">{{ $programLabel }} · {{ $scopeLabel }} · {{ $levelLabel }} · {{ $semesterLabel }}</p>
                    </div>
                </div>
                <div class="flex items-center gap-3 shrink-0">
                    <span class="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{{ $totalUnits }} units</span>
                    <span class="inline-flex items-center rounded-md px-2 py-1 text-xs font-bold {{ $subject->is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500' }}">
                        {{ $subject->is_active ? 'Active' : 'Inactive' }}
                    </span>
                    <svg data-arrow class="h-4 w-4 text-slate-400 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                </div>
            </button>

            {{-- ── Expanded details (hidden by default) ── --}}
            <div data-subject-details class="hidden border-t border-slate-100">
                <div class="bg-slate-50 px-4 py-3">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-xs font-black uppercase tracking-wide text-slate-400">Subject details</p>
                            <p class="mt-1 text-xs text-slate-500">
                                Lecture: {{ $subject->units_lec }} unit(s) · Lab: {{ $subject->units_lab }} unit(s) · Total: {{ $totalUnits }} units
                            </p>
                        </div>
                        <button
                            type="submit"
                            form="delete-subject-{{ $subject->id }}"
                            class="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700"
                            onclick="return confirm('Remove {{ addslashes($subject->code) }} - {{ addslashes($subject->name) }}? This will also remove it from assigned sections.');"
                        >
                            Remove
                        </button>
                    </div>
                </div>
                <form method="POST" action="{{ route('registrar.subjects.update', $subject) }}" class="subject-form grid grid-cols-1 gap-4 p-4 md:grid-cols-6 md:items-end">
                    @csrf
                    @method('PUT')
                    <label class="text-xs font-bold uppercase text-slate-500">
                        Subject code
                        <input name="code" maxlength="20" value="{{ $subject->code }}" required class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                    </label>
                    <label class="text-xs font-bold uppercase text-slate-500 md:col-span-2">
                        Subject name
                        <input name="name" maxlength="255" value="{{ $subject->name }}" required class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                    </label>
                    <label class="text-xs font-bold uppercase text-slate-500 md:col-span-6">
                        Description
                        <textarea name="description" rows="2" placeholder="Optional description" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">{{ $subject->description }}</textarea>
                    </label>
                    <label class="text-xs font-bold uppercase text-slate-500">
                        Program type
                        <select name="program_type" required class="program-type mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900"><option value="college" @selected($subject->program_type === 'college')>College</option><option value="shs" @selected($subject->program_type === 'shs')>SHS</option></select>
                    </label>
                    <label class="text-xs font-bold uppercase text-slate-500">
                        Lecture units
                        <input name="units_lec" type="number" min="0" step="any" value="{{ $subject->units_lec }}" required class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                    </label>
                    <label class="text-xs font-bold uppercase text-slate-500">
                        Lab units
                        <input name="units_lab" type="number" min="0" step="any" value="{{ $subject->units_lab }}" required class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                    </label>
                    <label class="course-wrap text-xs font-bold uppercase text-slate-500 md:col-span-2">
                        College course
                        <select name="course" class="course-field mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                            <option value="" @selected(!$subject->course)>General (all college courses)</option>
                            @foreach($courses as $course)
                                <option value="{{ $course->name }}" @selected($subject->course === $course->name)>{{ $course->name }}</option>
                            @endforeach
                        </select>
                    </label>
                    <label class="strand-wrap text-xs font-bold uppercase text-slate-500 md:col-span-2">
                        SHS strand
                        <select name="strand" class="strand-field mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                            <option value="" @selected(!$subject->strand)>General (all SHS strands)</option>
                            @foreach(['STEM', 'ABM', 'HUMSS', 'TVL', 'GAS'] as $strand)
                                <option value="{{ $strand }}" @selected($subject->strand === $strand)>{{ $strand }}</option>
                            @endforeach
                        </select>
                    </label>
                    <label class="text-xs font-bold uppercase text-slate-500">
                        Year / grade level
                        <input name="year_level" value="{{ $subject->year_level }}" placeholder="Year/Grade" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                    </label>
                    <label class="text-xs font-bold uppercase text-slate-500">
                        Semester
                        <select name="semester" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900"><option value="1st" @selected($subject->semester === '1st')>1st</option><option value="2nd" @selected($subject->semester === '2nd')>2nd</option><option value="summer" @selected($subject->semester === 'summer')>Summer</option></select>
                    </label>
                    <div class="md:col-span-6">
                        <p class="text-xs font-bold uppercase text-slate-500 mb-2">Prerequisites</p>
                        @if($subject->prerequisites->isNotEmpty())
                            <div class="flex flex-wrap gap-1 mb-2">
                                @foreach($subject->prerequisites as $pr)
                                    <span class="inline-flex items-center rounded-md bg-portal-accent-soft px-2 py-1 text-xs font-bold text-portal-accent">{{ $pr->code }}</span>
                                @endforeach
                            </div>
                        @endif
                        <div class="prereq-list max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2 grid grid-cols-1 gap-1 md:grid-cols-3">
                            @php $currentPrereqIds = $subject->prerequisites->pluck('id')->toArray(); @endphp
                            @foreach($allSubjects->where('id', '!=', $subject->id) as $prereqSubject)
                                <label class="prereq-option flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-white cursor-pointer transition-colors" data-program="{{ $prereqSubject->program_type }}">
                                    <input type="checkbox" name="prerequisite_ids[]" value="{{ $prereqSubject->id }}" @checked(in_array($prereqSubject->id, $currentPrereqIds)) class="rounded border-slate-300 text-portal-accent">
                                    <span class="font-semibold text-portal-accent">{{ $prereqSubject->code }}</span>
                                    <span class="truncate">{{ $prereqSubject->name }}</span>
                                </label>
                            @endforeach
                        </div>
                    </div>
                    <label class="flex items-center gap-2 text-sm font-bold text-slate-700 md:pb-2"><input type="checkbox" name="is_active" value="1" @checked($subject->is_active) class="rounded border-slate-300"> Active</label>
                    <button class="rounded-lg bg-portal-accent px-4 py-2 text-sm font-bold text-white hover:bg-portal-accent-hover">Save changes</button>
                </form>
            </div>
        </div>
        <form id="delete-subject-{{ $subject->id }}" method="POST" action="{{ route('registrar.subjects.destroy', $subject) }}" class="hidden">
            @csrf
            @method('DELETE')
        </form>
    @endforeach
    <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">{{ $subjects->links() }}</div>
</div>

<script>
    document.querySelectorAll('.subject-form').forEach((form) => {
        const programType = form.querySelector('.program-type');
        const courseField = form.querySelector('.course-field');
        const strandField = form.querySelector('.strand-field');
        const courseWrap = form.querySelector('.course-wrap') || courseField;
        const strandWrap = form.querySelector('.strand-wrap') || strandField;
        const prereqOptions = form.querySelectorAll('.prereq-option');

        const syncProgramFields = () => {
            const isCollege = programType.value === 'college';

            courseWrap.classList.toggle('hidden', !isCollege);
            courseField.disabled = !isCollege;
            strandWrap.classList.toggle('hidden', isCollege);
            strandField.disabled = isCollege;

            if (isCollege) {
                strandField.value = '';
            } else {
                courseField.value = '';
            }

            // Filter prerequisites by matching program type
            prereqOptions.forEach((option) => {
                const matchesProgram = option.dataset.program === programType.value;
                option.classList.toggle('hidden', !matchesProgram);
                if (!matchesProgram) {
                    const checkbox = option.querySelector('input[type="checkbox"]');
                    if (checkbox) checkbox.checked = false;
                }
            });
        };

        programType.addEventListener('change', syncProgramFields);
        syncProgramFields();
    });
</script>
@endsection
