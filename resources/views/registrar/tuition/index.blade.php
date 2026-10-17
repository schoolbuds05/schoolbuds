@extends('layouts.portal', ['title' => 'Post Tuition'])

@section('content')
<div class="space-y-5">
    <div>
        <h1 class="text-2xl font-black text-slate-900">Post tuition</h1>
        <p class="mt-1 text-sm text-slate-500">Post the same tuition fee to multiple active students at once.</p>
    </div>

    @if($errors->any())
        <div class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            <p class="font-black">Please review the form:</p>
            <ul class="mt-1 list-inside list-disc">
                @foreach($errors->all() as $error)
                    <li>{{ $error }}</li>
                @endforeach
            </ul>
        </div>
    @endif

    <form method="GET" action="{{ route('registrar.tuition.index') }}" class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div class="grid gap-3 md:grid-cols-[minmax(220px,1fr)_180px_180px_auto_auto] md:items-end">
            <label class="text-xs font-bold uppercase tracking-wide text-slate-500">
                Search students
                <input name="search" value="{{ request('search') }}" placeholder="Name, student ID, or email" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
            </label>
            <label class="text-xs font-bold uppercase tracking-wide text-slate-500">
                Grade / year
                <select name="grade_level" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                    <option value="">All grades</option>
                    @foreach($gradeLevels as $gradeLevel)
                        <option value="{{ $gradeLevel }}" @selected(request('grade_level') === $gradeLevel)>{{ $gradeLevel }}</option>
                    @endforeach
                </select>
            </label>
            <label class="text-xs font-bold uppercase tracking-wide text-slate-500">
                Section
                <select name="section" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                    <option value="">All sections</option>
                    @foreach($sections as $section)
                        <option value="{{ $section }}" @selected(request('section') === $section)>{{ $section }}</option>
                    @endforeach
                </select>
            </label>
            <button type="submit" class="rounded-lg bg-portal-accent px-4 py-2.5 text-sm font-bold text-white hover:bg-portal-accent-hover">Filter</button>
            <a href="{{ route('registrar.tuition.index') }}" class="rounded-lg border border-slate-300 px-4 py-2.5 text-center text-sm font-bold text-slate-600 hover:bg-slate-50">Reset</a>
        </div>
    </form>

    <form id="batch-tuition-form" method="POST" action="{{ route('registrar.tuition.store') }}" class="space-y-5">
        @csrf
        <input type="hidden" name="search" value="{{ request('search') }}">
        <input type="hidden" name="grade_level" value="{{ request('grade_level') }}">
        <input type="hidden" name="section" value="{{ request('section') }}">

        <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div class="mb-4">
                <h2 class="text-base font-black text-slate-900">Fee details</h2>
                <p class="mt-1 text-xs text-slate-500">These details will be applied to each selected student.</p>
            </div>
            <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label class="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Fee name
                    <input name="type" value="{{ old('type', 'Tuition Fee') }}" required maxlength="255" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                </label>
                <label class="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Amount (PHP)
                    <input name="amount" value="{{ old('amount') }}" type="number" min="1" max="10000000" step="0.01" required placeholder="e.g. 5000" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                </label>
                <label class="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Due date
                    <input name="due_date" value="{{ old('due_date') }}" type="date" required class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                </label>
                <label class="text-xs font-bold uppercase tracking-wide text-slate-500">
                    School year
                    <input name="school_year" value="{{ old('school_year', $schoolYear) }}" required maxlength="255" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                </label>
                <label class="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Semester
                    <select name="semester" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                        <option value="">No semester</option>
                        <option value="1st" @selected(old('semester') === '1st')>1st semester</option>
                        <option value="2nd" @selected(old('semester') === '2nd')>2nd semester</option>
                        <option value="summer" @selected(old('semester') === 'summer')>Summer</option>
                    </select>
                </label>
                <label class="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Quarter
                    <select name="quarter" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                        <option value="">No quarter</option>
                        @foreach(['1', '2', '3', '4'] as $quarter)
                            <option value="{{ $quarter }}" @selected(old('quarter') === $quarter)>Quarter {{ $quarter }}</option>
                        @endforeach
                    </select>
                </label>
                <label class="text-xs font-bold uppercase tracking-wide text-slate-500 sm:col-span-2">
                    Payment instructions / note
                    <input name="notes" value="{{ old('notes', 'Please pay at the bank, then go to the registrar for confirmation.') }}" maxlength="1000" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                </label>
            </div>
        </section>

        <section class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div>
                    <h2 class="font-black text-slate-900">Select students</h2>
                    <p class="mt-1 text-xs text-slate-500">{{ $students->count() }} active student(s) match these filters.</p>
                </div>
                <div class="flex items-center gap-3">
                    <label class="flex items-center gap-2 text-sm font-bold text-slate-700">
                        <input id="select-all-students" type="checkbox" class="rounded border-slate-300 text-portal-accent">
                        Select all shown
                    </label>
                    <span id="selected-student-count" class="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">0 selected</span>
                </div>
            </div>

            <div class="max-h-[32rem] overflow-auto">
                <table class="w-full min-w-[650px] text-left text-sm">
                    <thead class="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                            <th class="w-12 px-5 py-3">Select</th>
                            <th class="px-5 py-3">Student</th>
                            <th class="px-5 py-3">Grade / year</th>
                            <th class="px-5 py-3">Section</th>
                            <th class="px-5 py-3">Current school year</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                        @forelse($students as $student)
                            <tr class="hover:bg-slate-50">
                                <td class="px-5 py-3">
                                    <input type="checkbox" name="student_ids[]" value="{{ $student->id }}" class="student-checkbox rounded border-slate-300 text-portal-accent" @checked(in_array((string) $student->id, (array) old('student_ids', []), true))>
                                </td>
                                <td class="px-5 py-3">
                                    <p class="font-bold text-slate-800">{{ $student->first_name }} {{ $student->last_name }}</p>
                                    <p class="text-xs text-slate-500">{{ $student->student_id }} · {{ $student->email }}</p>
                                </td>
                                <td class="px-5 py-3 text-slate-600">{{ $student->grade_level ?: '—' }}</td>
                                <td class="px-5 py-3 text-slate-600">{{ $student->section ?: '—' }}</td>
                                <td class="px-5 py-3 text-slate-600">{{ $student->school_year ?: '—' }}</td>
                            </tr>
                        @empty
                            <tr>
                                <td colspan="5" class="px-5 py-10 text-center text-sm text-slate-500">No active students match these filters.</td>
                            </tr>
                        @endforelse
                    </tbody>
                </table>
            </div>

            <div class="flex flex-col gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p class="text-xs text-slate-500">Existing fees with the same name and academic period will be skipped to avoid duplicates.</p>
                <button id="post-tuition-button" type="submit" disabled class="rounded-lg bg-portal-accent px-5 py-2.5 text-sm font-bold text-white opacity-50 hover:bg-portal-accent-hover disabled:cursor-not-allowed">
                    Post fee to selected students
                </button>
            </div>
        </section>
    </form>
</div>

<div id="tuition-confirmation-modal" class="fixed inset-0 z-[100] hidden items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="tuition-confirmation-title">
    <div class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-portal-accent-soft text-portal-accent">
            <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.3 3.86 1.82 18.5A2 2 0 0 0 3.55 21h16.9a2 2 0 0 0 1.73-2.5L13.7 3.86a2 2 0 0 0-3.4 0Z"/></svg>
        </div>
        <h2 id="tuition-confirmation-title" class="mt-4 text-lg font-black text-slate-900">Confirm tuition posting</h2>
        <p class="mt-1 text-sm text-slate-500">Review this batch before adding fees to student records.</p>
        <div class="mt-4 space-y-2 rounded-xl bg-slate-50 p-4">
            <p id="tuition-confirmation-count" class="text-sm font-bold text-slate-800"></p>
            <p id="tuition-confirmation-fee" class="text-sm text-slate-600"></p>
            <p id="tuition-confirmation-total" class="border-t border-slate-200 pt-2 text-base font-black text-slate-900"></p>
        </div>
        <p class="mt-3 text-xs leading-5 text-slate-500">Duplicate fees for the same academic period will be skipped.</p>
        <div class="mt-6 flex justify-end gap-2">
            <button id="cancel-tuition-confirmation" type="button" class="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">Review selection</button>
            <button id="confirm-tuition-post" type="button" class="rounded-lg bg-portal-accent px-4 py-2.5 text-sm font-bold text-white hover:bg-portal-accent-hover">Post tuition</button>
        </div>
    </div>
</div>

<script>
    (() => {
        const form = document.getElementById('batch-tuition-form');
        if (!form) return;

        const checkboxes = Array.from(form.querySelectorAll('.student-checkbox'));
        const selectAll = document.getElementById('select-all-students');
        const selectedCount = document.getElementById('selected-student-count');
        const submitButton = document.getElementById('post-tuition-button');
        const confirmationModal = document.getElementById('tuition-confirmation-modal');
        const confirmationCount = document.getElementById('tuition-confirmation-count');
        const confirmationFee = document.getElementById('tuition-confirmation-fee');
        const confirmationTotal = document.getElementById('tuition-confirmation-total');
        const cancelConfirmation = document.getElementById('cancel-tuition-confirmation');
        const confirmPost = document.getElementById('confirm-tuition-post');
        let confirmed = false;

        const updateSelection = () => {
            const selected = checkboxes.filter(checkbox => checkbox.checked).length;
            selectedCount.textContent = `${selected} selected`;
            submitButton.disabled = selected === 0;
            submitButton.classList.toggle('opacity-50', selected === 0);
            selectAll.checked = checkboxes.length > 0 && selected === checkboxes.length;
            selectAll.indeterminate = selected > 0 && selected < checkboxes.length;
        };

        const closeConfirmation = () => {
            confirmationModal.classList.add('hidden');
            confirmationModal.classList.remove('flex');
        };

        checkboxes.forEach(checkbox => checkbox.addEventListener('change', updateSelection));
        selectAll.addEventListener('change', () => {
            checkboxes.forEach(checkbox => { checkbox.checked = selectAll.checked; });
            updateSelection();
        });

        form.addEventListener('submit', event => {
            if (confirmed) {
                confirmed = false;
                return;
            }

            const selected = checkboxes.filter(checkbox => checkbox.checked).length;
            if (!selected) {
                event.preventDefault();
                return;
            }

            event.preventDefault();
            const feeName = form.elements.namedItem('type').value.trim() || 'Tuition fee';
            const amount = Number(form.elements.namedItem('amount').value) || 0;
            confirmationCount.textContent = `${selected} student${selected === 1 ? '' : 's'} selected`;
            confirmationFee.textContent = `${feeName} · PHP ${amount.toFixed(2)} per student`;
            confirmationTotal.textContent = `PHP ${(amount * selected).toFixed(2)} total`;
            confirmationModal.classList.remove('hidden');
            confirmationModal.classList.add('flex');
            cancelConfirmation.focus();
        });

        cancelConfirmation.addEventListener('click', closeConfirmation);
        confirmationModal.addEventListener('click', event => {
            if (event.target === confirmationModal) closeConfirmation();
        });
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && !confirmationModal.classList.contains('hidden')) {
                closeConfirmation();
            }
        });
        confirmPost.addEventListener('click', () => {
            confirmed = true;
            closeConfirmation();
            form.requestSubmit();
        });
        updateSelection();
    })();
</script>
@endsection
