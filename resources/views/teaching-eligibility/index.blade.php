@extends('layouts.portal', ['title' => 'Teaching Eligibility'])

@section('content')
<div class="mb-6">
    <div class="flex flex-wrap items-center gap-3">
        <h1 class="text-2xl font-black text-slate-900">{{ $mode === 'ownership' ? 'Subject Departments' : ($mode === 'registrar' ? 'Chair Teaching Requests' : 'Teaching Eligibility') }}</h1>
        @if(in_array($mode, ['registrar', 'chair'], true) && $pendingCount > 0)
            <span class="inline-flex items-center rounded-full bg-portal-accent px-2.5 py-1 text-xs font-black text-white">{{ $pendingCount }} pending approval{{ $pendingCount === 1 ? '' : 's' }}</span>
        @endif
    </div>
    <p class="mt-2 text-sm text-slate-500">
        @if($mode === 'ownership')
            Choose the department responsible for each subject and its teacher approvals. Course and general subject applicability stays separate.
            Changing ownership requires new teaching approvals.
        @elseif($mode === 'chair')
            {{ $department->name }}: review teacher qualifications or approve a teacher directly. Eligibility does not assign a class.
        @elseif($mode === 'registrar')
            Review teaching-eligibility requests submitted by department chairs. Their department chair cannot approve these requests.
        @else
            Request subjects you want to teach. The managing department chair reviews teacher requests; department-chair requests go to the Registrar. Approval does not guarantee a class assignment.
        @endif
    </p>
</div>

@if(in_array($mode, ['chair', 'teacher'], true))
<details class="portal-card group mb-6 p-5" @if($errors->any()) open @endif>
    <summary class="flex cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
        <span>
            <span class="block font-bold">{{ $mode === 'chair' ? 'Approve a teacher directly' : 'Request a subject' }}</span>
            <span class="mt-1 block text-sm font-normal text-slate-500">{{ $mode === 'chair' ? 'Choose a subject and teacher to approve.' : 'Choose a subject to request eligibility.' }}</span>
        </span>
        <span class="shrink-0 text-sm font-bold text-slate-500 group-open:hidden">Open form</span>
        <span class="hidden shrink-0 text-sm font-bold text-slate-500 group-open:inline">Close form</span>
    </summary>
    <div class="mt-5 border-t border-slate-100 pt-5">
    <form method="POST" action="{{ route($mode === 'chair' ? 'teaching-eligibility.grant' : 'teaching-eligibility.store') }}" class="grid gap-4 md:grid-cols-2">
        @csrf
        <label class="text-sm font-bold">Filter subjects by year level
            <select data-teaching-year-filter class="mt-1 w-full rounded-lg border-slate-300">
                <option value="">All year levels</option>
                @foreach($subjects->pluck('year_level')->filter()->unique()->sort() as $yearLevel)
                    <option value="{{ $yearLevel }}">{{ ['1' => '1st year', '2' => '2nd year', '3' => '3rd year', '4' => '4th year'][(string) $yearLevel] ?? 'Year '.$yearLevel }}</option>
                @endforeach
            </select>
        </label>
        <label class="text-sm font-bold">Subject
            <select name="subject_id" data-teaching-subject-select required class="mt-1 w-full rounded-lg border-slate-300">
                <option value="">Select a subject</option>
                @foreach($subjects as $subject)
                    <option value="{{ $subject->id }}" data-year-level="{{ $subject->year_level }}" @selected((string) old('subject_id') === (string) $subject->id)>{{ $subject->code }} — {{ $subject->name }} · {{ $subject->semester ? ucfirst($subject->semester).' semester' : 'Any semester' }}</option>
                @endforeach
            </select>
        </label>
        @if($mode === 'chair')
        <label class="text-sm font-bold">Teacher
            <select name="teacher_id" required class="mt-1 w-full rounded-lg border-slate-300">
                <option value="">Select a teacher</option>
                @foreach($teachers as $teacher)
                    <option value="{{ $teacher->id }}" @selected((string) old('teacher_id') === (string) $teacher->id)>{{ $teacher->name }} · {{ $teacher->email }}</option>
                @endforeach
            </select>
        </label>
        @endif
        <label class="text-sm font-bold md:col-span-2">{{ $mode === 'chair' ? 'Basis for approval' : 'Qualifications and teaching experience' }}
            <textarea name="{{ $mode === 'chair' ? 'remarks' : 'qualification' }}" required maxlength="{{ $mode === 'chair' ? 2000 : 4000 }}" rows="3" class="mt-1 w-full rounded-lg border-slate-300">{{ old($mode === 'chair' ? 'remarks' : 'qualification') }}</textarea>
        </label>
        <div><button class="rounded-lg bg-portal-accent px-4 py-2 text-sm font-bold text-white">{{ $mode === 'chair' ? 'Approve eligibility' : 'Send request' }}</button></div>
    </form>
    @if($subjects->isEmpty())
        <p class="mt-3 text-sm text-slate-500">No subjects available. Subjects need an active managing department; pending or approved requests cannot be submitted again.</p>
    @endif
    </div>
</details>
@endif

@if($mode === 'ownership')
<form method="GET" action="{{ route('teaching-eligibility.owners') }}" class="portal-card mb-5 flex flex-wrap items-end gap-3 p-4">
    <label class="text-sm font-bold text-slate-700">
        Filter by subject scope
        <select name="subject_type" class="mt-1 block min-w-56 rounded-lg border-slate-300">
            <option value="">All subject scopes</option>
            <option value="general" @selected(request('subject_type') === 'general')>General subjects</option>
            <option value="course" @selected(request('subject_type') === 'course')>Course/strand-specific subjects</option>
        </select>
    </label>
    <label class="text-sm font-bold text-slate-700">
        Filter by department
        <select name="department_id" class="mt-1 block min-w-64 rounded-lg border-slate-300">
            <option value="">All departments</option>
            @foreach($departments as $department)
                <option value="{{ $department->id }}" @selected((string) request('department_id') === (string) $department->id)>{{ $department->name }}{{ $department->is_active ? '' : ' (inactive)' }}</option>
            @endforeach
            <option value="unassigned" @selected(request('department_id') === 'unassigned')>Unassigned</option>
        </select>
    </label>
    <button class="rounded-lg bg-portal-accent px-4 py-2 text-sm font-bold text-white">Apply filter</button>
    @if(request()->filled('department_id') || request()->filled('subject_type'))
        <a href="{{ route('teaching-eligibility.owners') }}" class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">Clear</a>
    @endif
</form>
@endif

@if($mode === 'ownership')
<form method="POST" action="{{ route('teaching-eligibility.update-owners') }}" class="space-y-4" data-owner-bulk-form>
    @csrf
    @method('PUT')
    <input type="hidden" name="scroll_y" value="0" data-scroll-position>
@endif
<div class="space-y-4">
@forelse($rows as $row)
    <article class="portal-card p-5">
        @if($mode === 'ownership')
            <h2 class="font-bold">{{ $row->code }} — {{ $row->name }}</h2>
            <p class="mt-1 text-sm text-slate-500">{{ $row->course ?: ($row->strand ?: 'General subject') }} · Current department: {{ $row->department?->name ?? 'Unassigned' }}</p>
            @php($linkedCourse = $row->program_type === 'college' ? ($courseByScope[$row->course] ?? null) : null)
            @if($linkedCourse)
                <p class="mt-3 text-sm font-bold text-slate-700">
                    Managing department: {{ $linkedCourse->department?->name ?? 'Unassigned' }}
                    <span class="font-normal text-slate-500">(inherited from {{ $linkedCourse->name }})</span>
                </p>
            @else
                <div class="mt-3 flex flex-wrap items-center gap-3">
                    <input type="hidden" name="assignments[{{ $loop->index }}][subject_id]" value="{{ $row->id }}">
                    <label class="text-sm font-bold">Managing department
                        <select name="assignments[{{ $loop->index }}][department_id]" class="ml-2 rounded-lg border-slate-300">
                            <option value="">Unassigned</option>
                            @foreach($departments as $department)
                                <option value="{{ $department->id }}" @selected((int) $row->department_id === (int) $department->id)>{{ $department->name }}{{ $department->is_active ? '' : ' (inactive)' }}</option>
                            @endforeach
                        </select>
                    </label>
                    <button
                        type="button"
                        data-save-subject-department="{{ $loop->index }}"
                        class="rounded-lg border border-portal-accent px-4 py-2 text-sm font-bold text-portal-accent hover:bg-portal-accent-soft"
                    >Save department</button>
                </div>
            @endif
        @else
            @if($mode === 'chair')
                <details class="group" @if($errors->any()) open @endif>
                    <summary class="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                        <span class="min-w-0">
                            <span class="block truncate font-bold">{{ $row->subject->code }} — {{ $row->subject->name }}</span>
                            <span class="mt-1 block truncate text-sm font-normal text-slate-500">{{ $row->teacher->name }} · {{ $row->teacher->email }}</span>
                        </span>
                        <span class="flex shrink-0 items-center gap-2">
                            <span class="rounded-lg bg-slate-100 px-3 py-1 text-xs font-bold uppercase">{{ $row->status }}</span>
                            <span class="text-sm font-bold text-slate-500 group-open:hidden">Details</span>
                            <span class="hidden text-sm font-bold text-slate-500 group-open:inline">Close</span>
                        </span>
                    </summary>
                    <div class="mt-4 border-t border-slate-100 pt-4">
                        <p class="text-sm text-slate-500">{{ $row->subject->department?->name ?? 'No managing department' }} · {{ $row->source === 'chair_assignment' ? 'Chair assignment' : ($row->teacher->position === 'head_department' ? 'Department chair request · Registrar review' : 'Teacher request') }}</p>
                        @if($row->qualification)<p class="mt-3 whitespace-pre-wrap text-sm text-slate-700">Qualifications: {{ $row->qualification }}</p>@endif
                        @if($row->remarks)<p class="mt-2 whitespace-pre-wrap text-sm text-slate-700">Remarks: {{ $row->remarks }}</p>@endif
                        @if($row->reviewer)<p class="mt-2 text-xs text-slate-500">Reviewed by {{ $row->reviewer->name }} · {{ $row->reviewed_at?->format('M j, Y H:i') }}</p>@endif
                        @if($row->status === 'pending' && $row->teacher->position === 'head_department')
                            <p class="mt-4 text-sm font-bold text-amber-700">Awaiting Registrar approval.</p>
                        @endif
                        @if(in_array($row->status, ['pending', 'approved']) && $row->teacher_id !== auth()->id() && $row->teacher->position !== 'head_department')
                            <form method="POST" action="{{ route($row->status === 'pending' ? 'teaching-eligibility.review' : 'teaching-eligibility.revoke', $row) }}" class="mt-4 grid gap-3">
                                @csrf
                                <label class="text-sm font-bold">Decision remarks {{ $row->status === 'pending' ? '(required for rejection)' : '(required)' }}
                                    <textarea name="remarks" maxlength="2000" rows="2" @required($row->status === 'approved') class="mt-1 w-full rounded-lg border-slate-300"></textarea>
                                </label>
                                <div class="flex gap-3">
                                    @if($row->status === 'pending')
                                        <button name="decision" value="approve" class="rounded-lg bg-portal-accent px-4 py-2 text-sm font-bold text-white">Approve</button>
                                        <button name="decision" value="reject" class="rounded-lg border border-red-300 px-4 py-2 text-sm font-bold text-red-700">Reject</button>
                                    @else
                                        <button class="rounded-lg border border-red-300 px-4 py-2 text-sm font-bold text-red-700">Revoke eligibility</button>
                                    @endif
                                </div>
                            </form>
                        @endif
                    </div>
                </details>
            @elseif($mode === 'registrar')
                <div class="flex flex-wrap items-center justify-between gap-2">
                    <h2 class="font-bold">{{ $row->subject->code }} — {{ $row->subject->name }}</h2>
                    <span class="rounded-lg bg-slate-100 px-3 py-1 text-xs font-bold uppercase">{{ $row->status }}</span>
                </div>
                <p class="mt-1 text-sm text-slate-500">{{ $row->teacher->name }} · {{ $row->teacher->email }} · {{ $row->subject->department?->name ?? 'No managing department' }}</p>
                @if($row->qualification)<p class="mt-3 whitespace-pre-wrap text-sm text-slate-700">Qualifications: {{ $row->qualification }}</p>@endif
                @if($row->remarks)<p class="mt-2 whitespace-pre-wrap text-sm text-slate-700">Remarks: {{ $row->remarks }}</p>@endif
                @if($row->reviewer)<p class="mt-2 text-xs text-slate-500">Reviewed by {{ $row->reviewer->name }} · {{ $row->reviewed_at?->format('M j, Y H:i') }}</p>@endif
                @if($row->status === 'pending')
                    <form method="POST" action="{{ route('registrar.teaching-eligibility.review', $row) }}" class="mt-4 grid gap-3">
                        @csrf
                        <label class="text-sm font-bold">Decision remarks (required for rejection)
                            <textarea name="remarks" maxlength="2000" rows="2" class="mt-1 w-full rounded-lg border-slate-300"></textarea>
                        </label>
                        <div class="flex gap-3">
                            <button name="decision" value="approve" class="rounded-lg bg-portal-accent px-4 py-2 text-sm font-bold text-white">Approve</button>
                            <button name="decision" value="reject" class="rounded-lg border border-red-300 px-4 py-2 text-sm font-bold text-red-700">Reject</button>
                        </div>
                    </form>
                @endif
            @else
                <div class="flex flex-wrap items-center justify-between gap-2">
                    <h2 class="font-bold">{{ $row->subject->code }} — {{ $row->subject->name }}</h2>
                    <span class="rounded-lg bg-slate-100 px-3 py-1 text-xs font-bold uppercase">{{ $row->status }}</span>
                </div>
                <p class="mt-1 text-sm text-slate-500">{{ $row->subject->department?->name ?? 'No managing department' }} · {{ $row->source === 'chair_assignment' ? 'Chair assignment' : 'Teacher request' }}</p>
                @if($row->qualification)<p class="mt-3 whitespace-pre-wrap text-sm text-slate-700">Qualifications: {{ $row->qualification }}</p>@endif
                @if($row->remarks)<p class="mt-2 whitespace-pre-wrap text-sm text-slate-700">Remarks: {{ $row->remarks }}</p>@endif
                @if($row->reviewer)<p class="mt-2 text-xs text-slate-500">Reviewed by {{ $row->reviewer->name }} · {{ $row->reviewed_at?->format('M j, Y H:i') }}</p>@endif
            @endif
        @endif
    </article>
@empty
    <p class="portal-card p-6 text-sm text-slate-500">{{ $mode === 'ownership' ? 'No subjects found.' : 'No teaching eligibility records yet.' }}</p>
@endforelse
</div>
@if($mode === 'ownership')
    @if($manualOwnerCount > 0)
        <div class="flex justify-end">
            <button class="rounded-lg bg-portal-accent px-4 py-2 text-sm font-bold text-white">Save all department changes</button>
        </div>
    @endif
</form>
@endif
<div class="mt-5">{{ $rows->links() }}</div>
@if($mode === 'ownership')
<script>
    const contentScroller = document.querySelector('.portal-content-scroll');
    const usesContentScroller = contentScroller && window.getComputedStyle(contentScroller).overflowY === 'auto';
    const getScrollPosition = () => usesContentScroller ? contentScroller.scrollTop : window.scrollY;

    document.querySelectorAll('[data-owner-bulk-form]').forEach((form) => {
        form.addEventListener('submit', () => {
            const scrollPosition = form.querySelector('[data-scroll-position]');
            if (scrollPosition) {
                scrollPosition.value = getScrollPosition();
            }
        });

        form.querySelectorAll('[data-save-subject-department]').forEach((button) => {
            button.addEventListener('click', () => {
                const selectedIndex = button.dataset.saveSubjectDepartment;
                form.querySelectorAll('[name^="assignments["]').forEach((input) => {
                    input.disabled = !input.name.startsWith(`assignments[${selectedIndex}]`);
                });
                form.requestSubmit();
            });
        });
    });

    const savedScrollPosition = @json(session('scroll_y'));
    if (savedScrollPosition !== null) {
        const restoreScrollPosition = () => {
            if (usesContentScroller) {
                contentScroller.scrollTop = Number(savedScrollPosition);
            } else {
                window.scrollTo(0, Number(savedScrollPosition));
            }
        };

        restoreScrollPosition();
        window.requestAnimationFrame(restoreScrollPosition);
    }
</script>
@endif
@if(in_array($mode, ['chair', 'teacher'], true))
<script>
    (() => {
        const yearFilter = document.querySelector('[data-teaching-year-filter]');
        const subjectSelect = document.querySelector('[data-teaching-subject-select]');
        if (!yearFilter || !subjectSelect) return;

        const subjectOptions = Array.from(subjectSelect.options).filter((option) => option.value);
        const applyYearFilter = () => {
            subjectOptions.forEach((option) => {
                const visible = !yearFilter.value || option.dataset.yearLevel === yearFilter.value;
                option.hidden = !visible;
                option.disabled = !visible;
            });

            if (subjectSelect.selectedOptions[0]?.disabled) {
                subjectSelect.value = '';
            }
        };

        yearFilter.addEventListener('change', applyYearFilter);
        applyYearFilter();
    })();
</script>
@endif
@endsection
