@extends('layouts.portal', ['title' => 'Sections'])

@section('content')
<div class="mb-6">
    <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
            <h1 class="text-2xl font-black text-slate-900">Sections</h1>
            <p class="mt-1 text-sm text-slate-500">Create class sections and review assigned schedules.</p>
        </div>

        <div class="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
            <form method="GET" class="flex w-full items-center gap-2 md:w-[420px]">
                <div class="relative flex-1">
                    <svg class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="6"/><path stroke-linecap="round" d="M16 16l5 5"/></svg>
                    <input name="search" value="{{ request('search') }}" placeholder="Search section, course, or strand" class="w-full rounded-lg border border-slate-300 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none">
                </div>
                <button type="submit" class="shrink-0 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800">Search</button>
            </form>

            <div class="flex items-center gap-2">
                <details class="group relative z-30">
                    <summary class="inline-flex cursor-pointer list-none items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
                        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M7 12h10M10 18h4"/></svg>
                        Filters
                        <svg class="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="m6 9 6 6 6-6"/></svg>
                    </summary>
                    <form method="GET" class="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
                        <input type="hidden" name="search" value="{{ request('search') }}">
                        <h2 class="text-sm font-black text-slate-900">Filter sections</h2>
                        <p class="mt-1 text-xs text-slate-500">Narrow by section details and academic period.</p>
                        <div class="mt-4 grid gap-3">
                            <label class="text-xs font-bold uppercase tracking-wide text-slate-500">
                                Program
                                <select name="program_type" class="mt-1 w-full rounded-lg border-slate-300 text-sm text-slate-900">
                                    <option value="">All programs</option>
                                    <option value="college" @selected(request('program_type') === 'college')>College</option>
                                    <option value="shs" @selected(request('program_type') === 'shs')>SHS</option>
                                </select>
                            </label>
                            <label class="text-xs font-bold uppercase tracking-wide text-slate-500">
                                Course
                                <select name="course" class="mt-1 w-full rounded-lg border-slate-300 text-sm text-slate-900">
                                    <option value="">All courses</option>
                                    @foreach($courses as $course)
                                        <option value="{{ $course->name }}" @selected(request('course') === $course->name)>{{ $course->name }}</option>
                                    @endforeach
                                </select>
                            </label>
                            <label class="text-xs font-bold uppercase tracking-wide text-slate-500">
                                School year
                                <select name="school_year" class="mt-1 w-full rounded-lg border-slate-300 text-sm text-slate-900">
                                    <option value="">All school years</option>
                                    @foreach($schoolYears as $year)
                                        <option value="{{ $year }}" @selected(request('school_year') === $year)>{{ $year }}</option>
                                    @endforeach
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
                            <label class="text-xs font-bold uppercase tracking-wide text-slate-500">
                                Status
                                <select name="is_active" class="mt-1 w-full rounded-lg border-slate-300 text-sm text-slate-900">
                                    <option value="">All status</option>
                                    <option value="1" @selected(request('is_active') === '1')>Active</option>
                                    <option value="0" @selected(request('is_active') === '0')>Inactive</option>
                                </select>
                            </label>
                        </div>
                        <div class="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-3">
                            <a href="{{ route('registrar.sections.index') }}" class="rounded-lg border border-red-700 bg-white px-3 py-2 text-sm font-bold text-red-700 hover:bg-red-50">Reset</a>
                            <button type="submit" class="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-700">Apply</button>
                        </div>
                    </form>
                </details>
                <button type="button" data-modal-open="section-create-modal" class="inline-flex shrink-0 items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800">
                    <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" d="M12 5v14M5 12h14"/></svg>
                    Add section
                </button>
            </div>
        </div>
    </div>
</div>

<div id="section-create-modal" data-modal class="fixed inset-0 z-50 hidden items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="section-create-title" tabindex="-1">
    <section class="w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-2xl">
        <header class="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
            <div>
                <h2 id="section-create-title" class="text-lg font-black text-slate-900">Create section</h2>
                <p class="mt-1 text-sm text-slate-500">Set the section's academic term and enrollment capacity.</p>
            </div>
            <button type="button" data-modal-close="section-create-modal" class="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">Close</button>
        </header>
<form method="POST" action="{{ route('registrar.sections.store') }}" class="section-form max-h-[calc(90vh-5rem)] grid grid-cols-1 gap-3 overflow-y-auto p-5 md:grid-cols-4">
    @csrf
    <label class="text-xs font-bold uppercase text-slate-500">
        Section name
        <input name="name" placeholder="Section name" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
    </label>
    <label class="text-xs font-bold uppercase text-slate-500">
        Program type
        <select name="program_type" class="program-type mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900"><option value="college">College</option><option value="shs">SHS</option></select>
    </label>
    <label class="course-field text-xs font-bold uppercase text-slate-500">
        College course
        <select name="course" class="course-field mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
            <option value="">Select course</option>
            @foreach($courses as $course)
                <option value="{{ $course->name }}">{{ $course->name }}</option>
            @endforeach
        </select>
    </label>
    <label class="strand-field text-xs font-bold uppercase text-slate-500">
        SHS strand
        <select name="strand" class="strand-field mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
            <option value="">Select strand</option>
            @foreach(['STEM', 'ABM', 'HUMSS', 'TVL', 'GAS'] as $strand)
                <option value="{{ $strand }}">{{ $strand }}</option>
            @endforeach
        </select>
    </label>
    <label class="text-xs font-bold uppercase text-slate-500">
        Year / grade level
        <select name="year_level" class="year-level-field mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
            <option value="">Select year/grade</option>
        </select>
    </label>
    <label class="text-xs font-bold uppercase text-slate-500">
        School year
        <input name="school_year" value="{{ date('Y') }}-{{ date('Y') + 1 }}" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
    </label>
    <label class="text-xs font-bold uppercase text-slate-500">
        Semester
        <select name="semester" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900"><option value="1st">1st</option><option value="2nd">2nd</option><option value="summer">Summer</option></select>
    </label>
    <label class="text-xs font-bold uppercase text-slate-500">
        Max students
        <input name="max_students" value="40" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
    </label>
    <label class="flex items-center gap-2 text-sm font-bold text-slate-700 md:pt-5"><input type="checkbox" name="is_active" value="1" checked class="rounded border-slate-300"> Active</label>
    <button class="rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white md:mt-5 md:col-span-3">Create section</button>
</form>
    </section>
</div>

<div class="grid grid-cols-1 gap-4">
    @foreach($sections as $section)
        @php
            $enrolledIds = $section->students->pluck('id');
            $assignedSubjectIds = $section->sectionSubjects->pluck('subject_id');
            $eligibleStudents = $students
                ->reject(fn ($student) => $enrolledIds->contains($student->user_id))
                ->filter(fn ($student) => !$section->year_level || !$student->grade_level || (string) $student->grade_level === (string) $section->year_level);
            $eligibleSubjects = $subjects
                ->where('program_type', $section->program_type)
                ->reject(fn ($subject) => $assignedSubjectIds->contains($subject->id))
                ->filter(function ($subject) use ($section) {
                    if ($section->program_type === 'college') {
                        $matchesScope = !$section->course || !$subject->course
                            || trim((string) $subject->course) === trim((string) $section->course);
                    } else {
                        $matchesScope = !$section->strand || !$subject->strand
                            || trim((string) $subject->strand) === trim((string) $section->strand);
                    }
                    $matchesYear = !$section->year_level || !$subject->year_level
                        || trim((string) $subject->year_level) === trim((string) $section->year_level);
                    $matchesSemester = !$section->semester || !$subject->semester
                        || trim((string) $subject->semester) === trim((string) $section->semester);

                    return $matchesScope && $matchesYear && $matchesSemester;
                });
        @endphp
        @php
            $isCollege = $section->program_type === 'college';
            $programLabel = $isCollege ? 'College' : 'SHS';
            $scopeLabel = $isCollege ? ($section->course ?: 'No course') : ($section->strand ?: 'No strand');
            $scopeCode = null;

            if ($isCollege && $section->course) {
                $scopeCode = collect($courses)
                    ->first(fn ($course) => trim((string) $course->name) === trim((string) $section->course))?->acronym;

                if (!$scopeCode) {
                    $scopeCode = strtoupper(implode('', array_map(
                        fn ($word) => mb_substr($word, 0, 1),
                        preg_split('/\s+/', trim((string) $section->course))
                    )));
                }
            } elseif (!$isCollege && $section->strand) {
                $scopeCode = strtoupper((string) $section->strand);
            }

            $levelLabel = $section->year_level
                ? ($isCollege ? 'Year '.$section->year_level : 'Grade '.$section->year_level)
                : 'Any level';
            $semesterLabel = $section->semester ? ucfirst($section->semester).' sem' : '—';
            $studentCount = $section->students->count();
            $subjectCount = $section->sectionSubjects->count();
        @endphp
        <div class="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden" data-section-card>
            {{-- ── Collapsed summary row (always visible) ── --}}
            <button
                type="button"
                class="flex w-full items-center justify-between gap-4 p-4 text-left hover:bg-slate-50 transition-colors"
                onclick="this.closest('[data-section-card]').querySelector('[data-section-details]').classList.toggle('hidden'); this.querySelector('[data-arrow]').classList.toggle('rotate-180');"
            >
                <div class="flex items-center gap-3 min-w-0">
                    <span class="inline-flex items-center rounded-lg bg-violet-50 px-2.5 py-1 text-xs font-black text-violet-600 whitespace-nowrap">{{ $section->name }}</span>
                    <div class="min-w-0">
                        <p class="text-sm font-bold text-slate-900 truncate">{{ $programLabel }} · {{ $scopeCode ?: $scopeLabel }}</p>
                        <p class="text-xs text-slate-400 mt-0.5">{{ $levelLabel }} · {{ $semesterLabel }} · {{ $section->school_year }}</p>
                    </div>
                </div>
                <div class="flex items-center gap-3 shrink-0">
                    <span class="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{{ $subjectCount }} subj</span>
                    <span class="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{{ $studentCount }}/{{ $section->max_students }}</span>
                    <span class="inline-flex items-center rounded-md px-2 py-1 text-xs font-bold {{ $section->is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500' }}">
                        {{ $section->is_active ? 'Active' : 'Inactive' }}
                    </span>
                    <svg data-arrow class="h-4 w-4 text-slate-400 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                </div>
            </button>

            {{-- ── Expanded details (hidden by default) ── --}}
            <div data-section-details class="hidden border-t border-slate-100">
                {{-- Edit form --}}
                <div class="bg-slate-50 px-4 py-3">
                    <p class="text-xs font-black uppercase tracking-wide text-slate-400 mb-3">Section details</p>
                    <form method="POST" action="{{ route('registrar.sections.update', $section) }}" class="section-form grid grid-cols-1 gap-3 md:grid-cols-4 md:items-end">
                        @csrf
                        @method('PUT')
                        <label class="text-xs font-bold uppercase text-slate-500">
                            Section name
                            <input name="name" value="{{ $section->name }}" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                        </label>
                        <label class="text-xs font-bold uppercase text-slate-500">
                            Program type
                            <select name="program_type" class="program-type mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900"><option value="college" @selected($section->program_type === 'college')>College</option><option value="shs" @selected($section->program_type === 'shs')>SHS</option></select>
                        </label>
                        <label class="course-field text-xs font-bold uppercase text-slate-500">
                            College course
                            <select name="course" class="course-field mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                                <option value="">Select course</option>
                                @foreach($courses as $course)
                                    <option value="{{ $course->name }}" @selected($section->course === $course->name)>{{ $course->name }}</option>
                                @endforeach
                            </select>
                        </label>
                        <label class="strand-field text-xs font-bold uppercase text-slate-500">
                            SHS strand
                            <select name="strand" class="strand-field mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                                <option value="">Select strand</option>
                                @foreach(['STEM', 'ABM', 'HUMSS', 'TVL', 'GAS'] as $strand)
                                    <option value="{{ $strand }}" @selected($section->strand === $strand)>{{ $strand }}</option>
                                @endforeach
                            </select>
                        </label>
                        <label class="text-xs font-bold uppercase text-slate-500">
                            Year / grade level
                            <select name="year_level" data-current-value="{{ $section->year_level }}" class="year-level-field mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                                <option value="">Select year/grade</option>
                            </select>
                        </label>
                        <label class="text-xs font-bold uppercase text-slate-500">
                            School year
                            <input name="school_year" value="{{ $section->school_year }}" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                        </label>
                        <label class="text-xs font-bold uppercase text-slate-500">
                            Semester
                            <select name="semester" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900"><option value="1st" @selected($section->semester === '1st')>1st</option><option value="2nd" @selected($section->semester === '2nd')>2nd</option><option value="summer" @selected($section->semester === 'summer')>Summer</option></select>
                        </label>
                        <label class="text-xs font-bold uppercase text-slate-500">
                            Max students
                            <input name="max_students" value="{{ $section->max_students }}" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                        </label>
                        <label class="flex items-center gap-2 text-sm font-bold text-slate-700 md:pt-5"><input type="checkbox" name="is_active" value="1" @checked($section->is_active) class="rounded border-slate-300"> Active</label>
                        <button class="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white md:mt-5">Save changes</button>
                        <button
                            type="submit"
                            form="delete-section-{{ $section->id }}"
                            class="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white md:mt-5"
                            onclick="return confirm('Archive and remove section {{ addslashes($section->name) }}? This also removes its subject and student assignments.');"
                        >
                            Remove
                        </button>
                    </form>
                    <form id="delete-section-{{ $section->id }}" method="POST" action="{{ route('registrar.sections.destroy', $section) }}" class="hidden">
                        @csrf
                        @method('DELETE')
                    </form>
                </div>

                {{-- Assigned subjects --}}
                <div class="px-4 py-3 border-t border-slate-100">
                    <div class="flex items-center justify-between gap-3">
                        <div>
                            <p class="text-xs font-black uppercase text-slate-400">Assigned subjects</p>
                            <p class="mt-1 text-sm font-bold text-slate-700">{{ $subjectCount }} subject(s)</p>
                        </div>
                        <button type="button" data-modal-open="subjects-modal-{{ $section->id }}" class="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-black text-white shadow-sm transition hover:bg-emerald-800">
                            Manage subjects
                        </button>
                    </div>
                    <div class="mt-2 divide-y divide-slate-200">
                        @forelse($section->sectionSubjects as $assignment)
                            <div class="grid grid-cols-1 gap-3 py-3 md:grid-cols-[1fr_auto] md:items-center">
                                <div>
                                    <p class="text-sm font-bold text-slate-800">{{ $assignment->subject?->code }} - {{ $assignment->subject?->name }}</p>
                                    <p class="mt-1 text-xs font-semibold text-slate-500">
                                        {{ $assignment->teacher?->name ?? 'No teacher' }}
                                        @if($assignment->day) · {{ $assignment->day }} @endif
                                        @if($assignment->time_start || $assignment->time_end) · {{ $assignment->time_start }}-{{ $assignment->time_end }} @endif
                                        @if($assignment->room) · {{ $assignment->room }} @endif
                                    </p>
                                </div>
                                <form method="POST" action="{{ route('registrar.sections.subjects.destroy', [$section, $assignment]) }}">
                                    @csrf
                                    @method('DELETE')
                                    <button class="rounded-lg bg-red-50 px-3 py-2 text-xs font-black text-red-700">Remove</button>
                                </form>
                            </div>
                        @empty
                            <p class="py-3 text-sm text-slate-500">No subjects assigned yet.</p>
                        @endforelse
                    </div>
                </div>

                {{-- Enrolled students --}}
                <div class="px-4 py-3 border-t border-slate-100">
                    <div class="flex items-center justify-between gap-3">
                        <div>
                            <p class="text-xs font-black uppercase text-slate-400">Enrolled students</p>
                            <p class="mt-1 text-sm font-bold text-slate-700">{{ $studentCount }}/{{ $section->max_students }} students</p>
                        </div>
                        <button type="button" data-modal-open="students-modal-{{ $section->id }}" class="rounded-lg bg-violet-600 px-3 py-2 text-xs font-black text-white shadow-sm transition hover:bg-violet-700">
                            Manage students
                        </button>
                    </div>
                </div>
            </div>

            {{-- Subjects modal --}}
            <div id="subjects-modal-{{ $section->id }}" class="fixed inset-0 z-50 hidden items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" data-modal>
                <div class="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-slate-100 shadow-2xl">
                    <div class="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 p-5">
                        <div>
                            <p class="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-500">{{ $section->name }}</p>
                            <h2 class="mt-1 text-xl font-black text-slate-900">Manage subjects</h2>
                            <p class="mt-1 text-sm text-slate-500">{{ $subjectCount }} assigned subject(s)</p>
                        </div>
                        <button type="button" data-modal-close="subjects-modal-{{ $section->id }}" class="rounded-xl bg-slate-100 px-3 py-2 text-sm font-black text-slate-600 hover:bg-slate-200">Close</button>
                    </div>
                    <div class="grid max-h-[calc(90vh-90px)] gap-5 overflow-y-auto p-5 xl:grid-cols-[1fr_1.15fr]">
                        <div>
                            <h3 class="text-sm font-black text-slate-900">Add subject schedule</h3>
                            <form method="POST" action="{{ route('registrar.sections.subjects.store', $section) }}" class="mt-3 space-y-3">
                                @csrf
                                <select name="subject_id" class="w-full rounded-lg border-slate-300 text-sm" required>
                                    <option value="">Select subject</option>
                                    @foreach($eligibleSubjects as $subject)
                                        @php
                                            $scope = $isCollege ? ($subject->course ?: 'Any course') : ($subject->strand ?: 'Any strand');
                                            $level = $subject->year_level ?: 'Any level';
                                        @endphp
                                        <option value="{{ $subject->id }}">{{ $subject->code }} - {{ $subject->name }} ({{ $scope }}, {{ $level }})</option>
                                    @endforeach
                                </select>
                                @if($eligibleSubjects->isEmpty())
                                    <p class="rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">No available subjects match this section course/strand, year/grade and semester.</p>
                                @endif
                                <select name="teacher_id" class="w-full rounded-lg border-slate-300 text-sm">
                                    <option value="">No teacher</option>
                                    @foreach($teachers as $teacher)
                                        <option value="{{ $teacher->id }}">{{ $teacher->name }}</option>
                                    @endforeach
                                </select>
                                <div class="grid grid-cols-2 gap-2 rounded-lg border border-slate-300 bg-white p-3 text-sm sm:grid-cols-4">
                                    @foreach(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as $day)
                                        <label class="flex items-center gap-2 font-semibold text-slate-600">
                                            <input type="checkbox" name="days[]" value="{{ $day }}" class="rounded border-slate-300 text-violet-600 focus:ring-violet-500">
                                            <span>{{ $day }}</span>
                                        </label>
                                    @endforeach
                                </div>
                                <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <input type="time" name="time_start" class="rounded-lg border-slate-300 text-sm">
                                    <input type="time" name="time_end" class="rounded-lg border-slate-300 text-sm">
                                </div>
                                <input name="room" placeholder="Room" class="w-full rounded-lg border-slate-300 text-sm">
                                <button class="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50" @disabled($eligibleSubjects->isEmpty())>
                                    Assign subject
                                </button>
                            </form>
                        </div>
                        <div>
                            <h3 class="text-sm font-black text-slate-900">Currently assigned</h3>
                            <div class="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-100">
                                @forelse($section->sectionSubjects as $assignment)
                                    <div class="flex items-center justify-between gap-3 p-3">
                                        <div class="min-w-0">
                                            <p class="truncate text-sm font-black text-slate-800">{{ $assignment->subject?->code }} - {{ $assignment->subject?->name }}</p>
                                            <p class="truncate text-xs font-semibold text-slate-500">
                                                {{ $assignment->teacher?->name ?? 'No teacher' }}
                                                @if($assignment->day) · {{ $assignment->day }} @endif
                                                @if($assignment->time_start || $assignment->time_end) · {{ $assignment->time_start }}-{{ $assignment->time_end }} @endif
                                                @if($assignment->room) · {{ $assignment->room }} @endif
                                            </p>
                                        </div>
                                        <form method="POST" action="{{ route('registrar.sections.subjects.destroy', [$section, $assignment]) }}">
                                            @csrf
                                            @method('DELETE')
                                            <button class="rounded-lg bg-red-50 px-3 py-2 text-xs font-black text-red-700">Remove</button>
                                        </form>
                                    </div>
                                @empty
                                    <p class="p-4 text-sm font-semibold text-slate-500">No subjects assigned yet.</p>
                                @endforelse
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {{-- Students modal --}}
            <div id="students-modal-{{ $section->id }}" class="fixed inset-0 z-50 hidden items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" data-modal>
                <div class="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-slate-100 shadow-2xl">
                    <div class="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 p-5">
                        <div>
                            <p class="text-[10px] font-black uppercase tracking-[0.18em] text-violet-400">{{ $section->name }}</p>
                            <h2 class="mt-1 text-xl font-black text-slate-900">Manage students</h2>
                            <p class="mt-1 text-sm text-slate-500">{{ $studentCount }}/{{ $section->max_students }} enrolled</p>
                        </div>
                        <button type="button" data-modal-close="students-modal-{{ $section->id }}" class="rounded-xl bg-slate-100 px-3 py-2 text-sm font-black text-slate-600 hover:bg-slate-200">Close</button>
                    </div>
                    <div class="grid max-h-[calc(90vh-90px)] gap-5 overflow-y-auto p-5 lg:grid-cols-2">
                        <div>
                            <h3 class="text-sm font-black text-slate-900">Add student</h3>
                            <form method="POST" action="{{ route('registrar.sections.students.store', $section) }}" class="mt-3 space-y-3">
                                @csrf
                                <select name="user_id" required class="w-full rounded-lg border-slate-300 text-sm">
                                    <option value="">Select student</option>
                                    @foreach($eligibleStudents as $student)
                                        <option value="{{ $student->user_id }}">
                                            {{ trim($student->first_name.' '.$student->last_name) ?: $student->user?->name }}
                                            @if($student->student_id) - {{ $student->student_id }} @endif
                                        </option>
                                    @endforeach
                                </select>
                                @if($eligibleStudents->isEmpty())
                                    <p class="rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">No available active students match this section level.</p>
                                @endif
                                <button class="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50" @disabled($eligibleStudents->isEmpty())>
                                    Add to section
                                </button>
                            </form>
                        </div>
                        <div>
                            <h3 class="text-sm font-black text-slate-900">Currently enrolled</h3>
                            <div class="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-100">
                                @forelse($section->students as $student)
                                    <div class="flex items-center justify-between gap-3 p-3">
                                        <div class="min-w-0">
                                            <p class="truncate text-sm font-black text-slate-800">{{ $student->name }}</p>
                                            <p class="truncate text-xs font-semibold text-slate-500">{{ $student->email }}</p>
                                        </div>
                                        <form method="POST" action="{{ route('registrar.sections.students.destroy', [$section, $student]) }}">
                                            @csrf
                                            @method('DELETE')
                                            <button class="rounded-lg bg-red-50 px-3 py-2 text-xs font-black text-red-700">Remove</button>
                                        </form>
                                    </div>
                                @empty
                                    <p class="p-4 text-sm font-semibold text-slate-500">No students enrolled yet.</p>
                                @endforelse
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    @endforeach
    {{ $sections->links() }}
</div>

<script>
    document.querySelectorAll('.section-form').forEach((form) => {
        const programType = form.querySelector('select.program-type');
        const courseWrap = form.querySelector('label.course-field');
        const strandWrap = form.querySelector('label.strand-field');
        const courseSelect = form.querySelector('select.course-field');
        const strandSelect = form.querySelector('select.strand-field');
        const yearLevelField = form.querySelector('.year-level-field');

        const syncProgramFields = () => {
            const isCollege = programType.value === 'college';
            const currentYearLevel = yearLevelField.dataset.currentValue || yearLevelField.value;
            const levels = isCollege
                ? [
                    ['1', '1st Year'],
                    ['2', '2nd Year'],
                    ['3', '3rd Year'],
                    ['4', '4th Year'],
                ]
                : [
                    ['11', 'Grade 11'],
                    ['12', 'Grade 12'],
                ];

            if (courseWrap) courseWrap.classList.toggle('hidden', !isCollege);
            if (courseSelect) courseSelect.disabled = !isCollege;
            if (strandWrap) strandWrap.classList.toggle('hidden', isCollege);
            if (strandSelect) strandSelect.disabled = isCollege;
            yearLevelField.innerHTML = '<option value="">Select year/grade</option>';
            levels.forEach(([value, label]) => {
                const option = document.createElement('option');
                option.value = value;
                option.textContent = label;
                option.selected = String(currentYearLevel) === value;
                yearLevelField.appendChild(option);
            });
            yearLevelField.dataset.currentValue = '';

            if (isCollege) {
                if (strandSelect) strandSelect.value = '';
            } else {
                if (courseSelect) courseSelect.value = '';
            }
        };

        programType.addEventListener('change', syncProgramFields);
        syncProgramFields();
    });
</script>
@endsection
