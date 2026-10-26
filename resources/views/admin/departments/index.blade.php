@extends('layouts.portal', ['title' => 'Departments'])

@section('content')
<div class="mb-6 flex flex-wrap items-center justify-between gap-4">
    <div>
        <h1 class="text-2xl font-black text-slate-900">Departments</h1>
        <p class="mt-1 text-sm text-slate-500">Create course or general subject departments, assign a chair, and manage their teachers and subjects.</p>
    </div>
    <div class="flex w-full flex-wrap items-center gap-2 sm:w-auto">
        <form method="GET" action="{{ route('admin.departments.index') }}" class="flex min-w-0 flex-1 gap-2 sm:flex-none">
            <input name="search" value="{{ request('search') }}" placeholder="Search departments" aria-label="Search departments" class="min-w-0 flex-1 rounded-lg border-slate-300 text-sm sm:w-56 sm:flex-none">
            <select name="program_type" aria-label="Filter by program type" class="min-w-28 rounded-lg border-slate-300 text-sm">
                <option value="">All programs</option>
                <option value="college" @selected(request('program_type') === 'college')>College</option>
                <option value="shs" @selected(request('program_type') === 'shs')>SHS</option>
            </select>
            <select name="type" aria-label="Filter by department type" class="rounded-lg border-slate-300 text-sm">
                <option value="">All department types</option>
                <option value="course" @selected(request('type') === 'course')>Course department</option>
                <option value="general" @selected(request('type') === 'general')>General subject department</option>
            </select>
            <button type="submit" class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">Search</button>
        </form>
        <button type="button" data-department-modal-open class="portal-button-primary">Create Department</button>
    </div>
</div>

<div id="create-department-modal" class="fixed inset-0 {{ old('form_context') === 'create_department' ? 'flex' : 'hidden' }} items-center justify-center p-4" style="z-index: 9998; background: rgba(15, 23, 42, 0.82); backdrop-filter: blur(3px);" data-department-modal role="dialog" aria-modal="true" aria-labelledby="create-department-title">
    <div class="max-h-[90vh] w-[min(92vw,560px)] overflow-y-auto rounded-xl bg-white shadow-2xl">
        <div class="flex items-start justify-between gap-4 border-b border-violet-200 bg-violet-50 p-5">
            <div>
                <p class="text-[10px] font-black uppercase tracking-[0.18em] text-violet-500">New department</p>
                <h2 id="create-department-title" class="mt-1 text-lg font-black text-slate-900">Create Department</h2>
            </div>
            <button type="button" data-department-modal-close class="rounded-lg bg-white px-3 py-2 text-xs font-black text-slate-600 shadow-sm hover:bg-slate-50">Close</button>
        </div>

        <form method="POST" action="{{ route('admin.departments.store') }}" class="space-y-4 p-5" data-department-form>
            @csrf
            <input type="hidden" name="form_context" value="create_department">
            <label class="block text-sm font-bold text-slate-700">Department type
                <select name="type" class="mt-1 w-full rounded-lg border-slate-300 text-sm" data-department-type>
                    <option value="course" @selected(old('type', 'course') === 'course')>Course department</option>
                    <option value="general" @selected(old('type') === 'general')>General subject department</option>
                </select>
                <span class="mt-1 block text-xs font-normal text-slate-500">Course departments manage programs and sections. General subject departments manage subjects and teachers.</span>
            </label>


            <div class="space-y-2">
                <label class="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Department name</label>
                <input name="name" value="{{ old('form_context') === 'create_department' ? old('name') : '' }}" placeholder="e.g. Computing" class="w-full rounded-lg border-slate-300 text-sm">
            </div>

            <div class="space-y-2">
                <label class="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Department code</label>
                <input name="code" value="{{ old('form_context') === 'create_department' ? old('code') : '' }}" placeholder="e.g. CCIS" class="w-full rounded-lg border-slate-300 text-sm uppercase">
            </div>

            <div class="space-y-2">
                <label class="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Chair</label>
                <select name="chair_user_id" class="w-full rounded-lg border-slate-300 text-sm">
                    <option value="">Assign chair later</option>
                    @foreach($chairs as $chair)
                        <option value="{{ $chair->id }}" @selected(old('chair_user_id') == $chair->id)>{{ $chair->name }} — {{ $chair->email }}</option>
                    @endforeach
                </select>
            </div>

            <div class="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div class="mb-2 flex items-center justify-between gap-3">
                    <p class="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Available teachers</p>
                    <div class="flex items-center gap-3">
                        <span class="text-xs text-slate-500" data-teacher-selection-count>0 selected</span>
                        <button type="button" data-select-all-teachers class="text-xs font-bold text-violet-700 hover:text-violet-900">Select all</button>
                    </div>
                </div>
                <details class="rounded-lg border border-slate-200 bg-white">
                    <summary class="cursor-pointer list-none px-3 py-2 text-sm font-semibold text-slate-700 [&::-webkit-details-marker]:hidden">
                        Choose teachers <span class="ml-1 text-xs font-normal text-slate-500">({{ $availableTeachers->count() }} available)</span>
                    </summary>
                    <div class="max-h-52 space-y-1 overflow-y-auto border-t border-slate-100 p-2" data-teacher-options>
                        @forelse($availableTeachers as $teacher)
                            <label class="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm transition hover:bg-violet-50">
                                <input type="checkbox" name="teacher_ids[]" value="{{ $teacher->id }}" @checked(in_array($teacher->id, old('teacher_ids', []))) class="rounded border-slate-300 text-violet-700 focus:ring-violet-500">
                                <span class="min-w-0">
                                    <span class="block font-semibold text-slate-800">{{ $teacher->name }}</span>
                                    <span class="block truncate text-xs text-slate-500">{{ $teacher->email }}</span>
                                </span>
                            </label>
                        @empty
                            <p class="px-2 py-3 text-sm text-slate-500">No unassigned teachers available.</p>
                        @endforelse
                    </div>
                </details>
                <p class="mt-2 text-xs text-slate-500">Choose one or more teachers for this department.</p>
            </div>

            <div class="rounded-xl border border-slate-200 bg-slate-50 p-3" data-department-programs>
                <p class="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Programs</p>
                <div class="max-h-40 space-y-2 overflow-y-auto pr-1">
                    @forelse($courses as $course)
                        <label class="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" name="course_ids[]" value="{{ $course->id }}" @checked(in_array($course->id, old('course_ids', []))) class="rounded border-slate-300"> {{ $course->acronym ?: $course->name }}</label>
                    @empty
                        <p class="text-sm text-slate-500">Create a college program in Registrar → Courses first.</p>
                    @endforelse
                </div>
            </div>

            <label class="flex items-center gap-2 text-sm font-bold text-slate-700"><input type="checkbox" name="is_active" value="1" @checked(old('form_context') === 'create_department' ? old('is_active') : true) class="rounded border-slate-300"> Active</label>
            <div class="flex justify-end gap-3 pt-1">
                <button type="button" data-department-modal-close class="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
                <button type="submit" class="portal-button-primary">Create Department</button>
            </div>
        </form>
    </div>
</div>

<section class="space-y-4">
        @forelse($departments as $department)
            <details class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <summary class="flex cursor-pointer list-none items-center justify-between gap-4 p-4 hover:bg-slate-50">
                    <div class="min-w-0">
                        <p class="text-sm font-black text-slate-900">{{ $department->name }}</p>
                        <p class="mt-1 text-xs font-semibold text-slate-500">{{ $department->code }} · {{ $department->type === 'general' ? 'General subject department' : 'Course department' }} · {{ $department->courses->count() }} programs · {{ $department->faculty_count }} faculty</p>
                        <p class="mt-1 text-xs text-slate-500">{{ $department->subjects->count() }} managed subjects</p>
                        @if($department->chair)
                            <p class="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-violet-700">Head: {{ $department->chair->name }}</p>
                        @else
                            <p class="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Head: Unassigned</p>
                        @endif
                    </div>
                    <span class="rounded-full px-3 py-1 text-xs font-black {{ $department->is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500' }}">{{ $department->is_active ? 'Active' : 'Inactive' }}</span>
                </summary>

                <form method="POST" action="{{ route('admin.departments.update', $department) }}" class="space-y-4 border-t border-slate-100 p-4" data-department-form>
                    @csrf @method('PUT')
                    <label class="block text-sm font-bold text-slate-700">Department type
                        <select name="type" class="mt-1 w-full rounded-lg border-slate-300 text-sm" data-department-type>
                            <option value="course" @selected($department->type === 'course')>Course department</option>
                            <option value="general" @selected($department->type === 'general')>General subject department</option>
                        </select>
                        <span class="mt-1 block text-xs font-normal text-slate-500">Reassign existing programs and sections before changing to a general subject department.</span>
                    </label>


                    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div class="space-y-2">
                            <label class="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Department name</label>
                            <input name="name" value="{{ $department->name }}" class="w-full rounded-lg border-slate-300 text-sm">
                        </div>
                        <div class="space-y-2">
                            <label class="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Department code</label>
                            <input name="code" value="{{ $department->code }}" class="w-full rounded-lg border-slate-300 text-sm uppercase">
                        </div>
                    </div>

                    <div class="space-y-2">
                        <label class="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Chair</label>
                        <select name="chair_user_id" class="w-full rounded-lg border-slate-300 text-sm">
                            <option value="">Assign chair later</option>
                            @foreach($chairs as $chair)
                                <option value="{{ $chair->id }}" @selected($department->chair_user_id === $chair->id)>{{ $chair->name }} — {{ $chair->email }}</option>
                            @endforeach
                        </select>
                    </div>

                    <div class="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div class="mb-2 flex items-center justify-between gap-3">
                            <p class="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Add teachers</p>
                            <div class="flex items-center gap-3">
                                <span class="text-xs text-slate-500" data-teacher-selection-count>0 selected</span>
                                <button type="button" data-select-all-teachers class="text-xs font-bold text-violet-700 hover:text-violet-900">Select all</button>
                            </div>
                        </div>
                        @php
                            $assignedTeachers = $department->teachers;
                            $assignedTeacherIds = $assignedTeachers->pluck('id')->all();
                            $teacherOptions = collect($availableTeachers)->sortBy('name');
                        @endphp

                        <details class="rounded-lg border border-slate-200 bg-white">
                            <summary class="cursor-pointer list-none px-3 py-2 text-sm font-semibold text-slate-700 [&::-webkit-details-marker]:hidden">
                                Choose teachers <span class="ml-1 text-xs font-normal text-slate-500">({{ $teacherOptions->count() }} available)</span>
                            </summary>
                            <div class="max-h-52 space-y-1 overflow-y-auto border-t border-slate-100 p-2" data-teacher-options>
                                @forelse($teacherOptions as $teacher)
                                    <label class="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm transition hover:bg-violet-50">
                                        <input type="checkbox" name="teacher_ids[]" value="{{ $teacher->id }}" class="rounded border-slate-300 text-violet-700 focus:ring-violet-500">
                                        <span class="min-w-0">
                                            <span class="block font-semibold text-slate-800">{{ $teacher->name }}</span>
                                            <span class="block truncate text-xs text-slate-500">{{ $teacher->email }}</span>
                                        </span>
                                    </label>
                                @empty
                                    <p class="px-2 py-3 text-sm text-slate-500">No unassigned teachers available.</p>
                                @endforelse
                            </div>
                        </details>
                        <p class="mt-2 text-xs text-slate-500">Choose the teachers to add to this department.</p>
                    </div>

                    <div class="rounded-xl border border-slate-200 bg-slate-50 p-3" data-department-programs>
                        <p class="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Programs</p>
                        <div class="grid gap-2 sm:grid-cols-2">@foreach($courses as $course)<label class="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" name="course_ids[]" value="{{ $course->id }}" @checked($course->department_id === $department->id) class="rounded border-slate-300"> {{ $course->acronym ?: $course->name }}</label>@endforeach</div>
                    </div>

                    <div class="flex items-center justify-between gap-3 pt-1">
                        <label class="flex items-center gap-2 text-sm font-bold text-slate-700"><input type="checkbox" name="is_active" value="1" @checked($department->is_active) class="rounded border-slate-300"> Active</label>
                        <button type="submit" class="rounded-lg bg-portal-accent px-4 py-2 text-sm font-bold text-white hover:bg-portal-accent-hover">Save changes</button>
                    </div>
                </form>

                <div class="border-t border-slate-100 p-4">
                    <h3 class="text-sm font-bold text-slate-700">Managed subjects</h3>
                    <p class="mt-1 text-sm text-slate-500">@forelse($department->subjects as $subject){{ $subject->code }} — {{ $subject->name }}{{ $loop->last ? '' : ', ' }}@empty No subjects assigned yet. @endforelse</p>
                    <a href="{{ route('teaching-eligibility.owners', ['department_id' => $department->id]) }}" class="mt-2 inline-block text-sm font-bold text-violet-700">Manage subject ownership</a>
                </div>

                @if($assignedTeachers->isNotEmpty())
                    <div class="border-t border-slate-100 px-4 pb-4 pt-3">
                        <p class="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Assigned teacher</p>
                        <div class="space-y-2">
                            @foreach($assignedTeachers as $teacher)
                                <div class="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                                    <span class="text-sm font-semibold text-slate-700">{{ $teacher->name }} — {{ $teacher->email }}</span>
                                    <form method="POST" action="{{ route('admin.departments.teachers.remove', [$department, $teacher]) }}" onsubmit="return confirm('Remove {{ addslashes($teacher->name) }} from this department?');" class="inline">
                                        @csrf
                                        <button type="submit" class="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-red-600 hover:bg-red-100">
                                            Remove
                                        </button>
                                    </form>
                                </div>
                            @endforeach
                        </div>
                    </div>
                @endif
            </details>
        @empty
            <div class="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm font-semibold text-slate-500">No departments yet.</div>
        @endforelse
    </section>

<script>
    document.querySelectorAll('[data-select-all-teachers]').forEach((button) => {
        const options = button.closest('.rounded-xl')?.querySelector('[data-teacher-options]');
        const checkboxes = Array.from(options?.querySelectorAll('input[type="checkbox"]:not(:disabled)') ?? []);
        const selectionCount = button.parentElement.querySelector('[data-teacher-selection-count]');
        const updateSelectionState = () => {
            const selectedCount = checkboxes.filter((checkbox) => checkbox.checked).length;
            if (selectionCount) {
                selectionCount.textContent = `${selectedCount} selected`;
            }
            button.textContent = checkboxes.length > 0 && selectedCount === checkboxes.length
                ? 'Clear selection'
                : 'Select all';
        };

        checkboxes.forEach((checkbox) => checkbox.addEventListener('change', updateSelectionState));
        button.addEventListener('click', () => {
            const selectAll = checkboxes.some((checkbox) => !checkbox.checked);
            checkboxes.forEach((checkbox) => {
                checkbox.checked = selectAll;
            });
            updateSelectionState();
        });
        updateSelectionState();
    });

    document.querySelectorAll('[data-department-form]').forEach((form) => {
        const type = form.querySelector('[data-department-type]');
        const programs = form.querySelector('[data-department-programs]');
        const syncType = () => {
            const general = type.value === 'general';
            programs.classList.toggle('hidden', general);
            programs.querySelectorAll('input').forEach((input) => { input.disabled = general; });
        };
        type.addEventListener('change', syncType);
        syncType();
    });

    const departmentModal = document.getElementById('create-department-modal');

    document.querySelector('[data-department-modal-open]')?.addEventListener('click', () => {
        departmentModal?.classList.remove('hidden');
        departmentModal?.classList.add('flex');
    });

    document.querySelectorAll('[data-department-modal-close]').forEach((button) => {
        button.addEventListener('click', () => {
            departmentModal?.classList.add('hidden');
            departmentModal?.classList.remove('flex');
        });
    });

    departmentModal?.addEventListener('click', (event) => {
        if (event.target === departmentModal) {
            departmentModal.classList.add('hidden');
            departmentModal.classList.remove('flex');
        }
    });
</script>
@endsection
