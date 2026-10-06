@extends('layouts.portal', ['title' => 'System Controls'])

@section('content')
<div class="mb-6">
    <h1 class="text-2xl font-black text-slate-900">System Controls</h1>
    <p class="mt-1 text-sm text-slate-500">Manage school year, semester, enrollment window, and grade deadlines.</p>
</div>

<div class="grid grid-cols-1 gap-6 lg:grid-cols-[420px_1fr]">
    <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 class="font-black text-slate-800">Academic Term</h2>
        @php
            $selectedSemester = old('semester', $currentTerm?->semester ?? '1st');
        @endphp
        <form method="POST" action="{{ route('admin.controls.store') }}" class="mt-4 space-y-3">
            @csrf
            <label class="block text-xs font-bold uppercase text-slate-500">
                School year
                <input name="school_year" value="{{ old('school_year', $currentTerm?->school_year ?? '2026-2027') }}" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
            </label>

            <label class="block text-xs font-bold uppercase text-slate-500">
                Semester
                <select name="semester" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                    <option value="1st" @selected($selectedSemester === '1st')>1st semester</option>
                    <option value="2nd" @selected($selectedSemester === '2nd')>2nd semester</option>
                    <option value="summer" @selected($selectedSemester === 'summer')>Summer</option>
                </select>
            </label>

            <label class="block text-xs font-bold uppercase text-slate-500">
                Exam date
                <input name="exam_date" value="{{ old('exam_date', $currentTerm?->exam_date?->format('Y-m-d\TH:i')) }}" type="datetime-local" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
            </label>

            <label class="block text-xs font-bold uppercase text-slate-500">
                Grade finalization deadline
                <input name="grade_finalization_deadline" value="{{ old('grade_finalization_deadline', $currentTerm?->grade_finalization_deadline?->format('Y-m-d\TH:i')) }}" type="datetime-local" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
            </label>

            <label class="block text-xs font-bold uppercase text-slate-500">
                Enrollment opens
                <input name="enrollment_opens_at" value="{{ old('enrollment_opens_at', $currentTerm?->enrollment_opens_at?->format('Y-m-d\TH:i')) }}" type="datetime-local" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
            </label>

            <label class="block text-xs font-bold uppercase text-slate-500">
                Enrollment closes
                <input name="enrollment_closes_at" value="{{ old('enrollment_closes_at', $currentTerm?->enrollment_closes_at?->format('Y-m-d\TH:i')) }}" type="datetime-local" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
            </label>

            <label class="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-bold text-slate-700">
                <input name="is_active" type="checkbox" value="1" @checked(old('is_active', $currentTerm?->is_active ?? false)) class="rounded border-slate-300">
                Open enrollment for this term
            </label>

            <button class="w-full rounded-lg bg-slate-950 px-4 py-3 text-sm font-bold text-white">Save controls</button>
        </form>
    </section>

    <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 class="font-black text-slate-800">Configured Terms</h2>
        <div class="mt-4 divide-y divide-slate-100">
            @forelse($terms as $term)
                <div class="py-4">
                    <div class="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p class="font-black text-slate-900">{{ $term->school_year }} · {{ strtoupper($term->semester) }}</p>
                            <p class="mt-1 text-xs font-semibold text-slate-500">{{ $term->is_active ? 'Enrollment allowed' : 'Enrollment closed' }}</p>
                        </div>
                        <span class="rounded-full px-3 py-1 text-xs font-black {{ $term->isEnrollmentOpen() ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700' }}">
                            Enrollment {{ $term->isEnrollmentOpen() ? 'open' : 'closed' }}
                        </span>
                    </div>
                    <dl class="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-600 sm:grid-cols-3">
                        <div><dt class="font-black uppercase text-slate-400">Exam date</dt><dd>{{ $term->exam_date?->format('Y-m-d H:i') ?? 'Not set' }}</dd></div>
                        <div><dt class="font-black uppercase text-slate-400">Grades final</dt><dd>{{ $term->grade_finalization_deadline?->format('Y-m-d H:i') ?? 'Not set' }}</dd></div>
                        <div><dt class="font-black uppercase text-slate-400">Opens</dt><dd>{{ $term->enrollment_opens_at?->format('Y-m-d H:i') ?? 'Anytime' }}</dd></div>
                        <div><dt class="font-black uppercase text-slate-400">Closes</dt><dd>{{ $term->enrollment_closes_at?->format('Y-m-d H:i') ?? 'No close date' }}</dd></div>
                    </dl>
                </div>
            @empty
                <p class="py-8 text-sm text-slate-500">No academic terms configured yet.</p>
            @endforelse
        </div>
    </section>
</div>
@endsection
