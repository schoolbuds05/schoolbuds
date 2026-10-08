@extends('layouts.portal', ['title' => 'Points Verification'])

@section('content')
<section>
    @if(session('points_cap_warning'))
        <div class="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900" role="status">
            {{ session('points_cap_warning') }}
        </div>
    @endif
    <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
            <h1 class="text-2xl font-black text-slate-900">Points Ledger</h1>
            <p class="text-sm text-slate-500 mt-1">Audit trail of earned and verified student points.</p>
        </div>
        <button type="button" data-modal-open="verify-points-modal" class="inline-flex items-center justify-center gap-2 rounded-lg bg-portal-accent px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-portal-accent-hover">
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" d="M12 5v14M5 12h14"/></svg>
            Give points
        </button>
    </div>

    <div id="verify-points-modal" data-modal class="fixed inset-0 z-50 hidden items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="verify-points-title" tabindex="-1">
        <section class="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl">
            <header class="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
                <div>
                    <h2 id="verify-points-title" class="text-lg font-black text-slate-900">Give verified points</h2>
                    <p class="mt-1 text-sm text-slate-500">Record donation, event, early enrollment, or early payment points.</p>
                </div>
                <button type="button" data-modal-close="verify-points-modal" class="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">Close</button>
            </header>
            <form id="give-points-form" method="POST" action="{{ route('registrar.points.store') }}" class="max-h-[calc(90vh-5rem)] space-y-3 overflow-y-auto p-5">
                @csrf
                <select data-modal-autofocus name="student_id" class="w-full rounded-lg border-slate-300 text-sm" required>
                    <option value="">Select student</option>
                    @foreach($students as $student)
                        <option value="{{ $student->id }}" @selected(old('student_id') == $student->id)>{{ $student->last_name }}, {{ $student->first_name }} · {{ $student->student_id }}</option>
                    @endforeach
                </select>
                <select name="source" class="w-full rounded-lg border-slate-300 text-sm" required>
                    @foreach(['donations' => 'Donation', 'events' => 'School event', 'early_enrollment' => 'Early enrollment', 'early_payment' => 'Early payment', 'manual_adjustment' => 'Verified adjustment'] as $value => $label)
                        <option value="{{ $value }}" @selected(old('source', 'donations') === $value)>{{ $label }}</option>
                    @endforeach
                </select>
                <input name="points" type="number" min="1" max="100000" value="{{ old('points', $defaultPoints) }}" placeholder="Points" class="w-full rounded-lg border-slate-300 text-sm" required>
                <div id="points-cap-preview" class="hidden rounded-lg border px-3 py-2 text-sm" role="status" aria-live="polite"></div>
                <input name="title" value="{{ old('title') }}" placeholder="Title" class="w-full rounded-lg border-slate-300 text-sm" required>
                <input name="reference_no" value="{{ old('reference_no') }}" placeholder="Reference no. optional" class="w-full rounded-lg border-slate-300 text-sm">
                <textarea name="description" rows="3" placeholder="Verification notes" class="w-full rounded-lg border-slate-300 text-sm">{{ old('description') }}</textarea>
                <div class="flex justify-end gap-2 border-t border-slate-100 pt-3">
                    <button type="button" data-modal-close="verify-points-modal" class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
                    <button type="submit" class="rounded-lg bg-portal-accent px-4 py-2 text-sm font-bold text-white hover:bg-portal-accent-hover">Record points</button>
                </div>
            </form>
        </section>
    </div>

    <div class="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100">
        @php
            $rewardsByStudent = $rewards->getCollection()->groupBy(
                fn ($reward) => $reward->student?->id ?? 'unknown-' . $reward->id
            );
        @endphp
        @forelse($rewardsByStudent as $studentRewards)
            @php
                $student = $studentRewards->first()->student;
                $studentName = trim(($student?->first_name ?? '') . ' ' . ($student?->last_name ?? '')) ?: 'Unknown student';
            @endphp
            <details class="group">
                <summary class="flex cursor-pointer list-none items-center justify-between gap-4 p-4 transition hover:bg-rose-50/50 [&::-webkit-details-marker]:hidden">
                    <span class="flex min-w-0 items-center gap-3">
                        <svg class="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                            <path stroke-linecap="round" stroke-linejoin="round" d="m9 18 6-6-6-6"/>
                        </svg>
                        <span class="min-w-0">
                            <span class="block truncate font-bold text-slate-800">{{ $studentName }}</span>
                            <span class="mt-0.5 block text-xs text-slate-500">{{ $studentRewards->count() }} {{ \Illuminate\Support\Str::plural('point entry', $studentRewards->count()) }}</span>
                        </span>
                    </span>
                    <span class="shrink-0 text-lg font-black text-emerald-700">+{{ $studentRewards->sum('points') }}</span>
                </summary>
                <div class="divide-y divide-slate-100 border-t border-slate-100 bg-slate-50/60 pl-11">
                    @foreach($studentRewards as $reward)
                        <div class="flex items-center justify-between gap-4 px-4 py-3">
                            <div class="min-w-0">
                                <p class="truncate text-sm font-semibold text-slate-800">{{ $reward->title }}</p>
                                <p class="mt-0.5 text-xs text-slate-500">{{ str_replace('_', ' ', ucfirst($reward->source)) }} · {{ $reward->created_at->format('M d, Y') }} · {{ $reward->awardedBy?->name ?: 'System' }}</p>
                            </div>
                            <p class="shrink-0 text-base font-black text-emerald-700">+{{ $reward->points }}</p>
                        </div>
                    @endforeach
                </div>
            </details>
        @empty
            <p class="p-8 text-center text-slate-500">No points recorded yet.</p>
        @endforelse
        <div class="p-4">{{ $rewards->links() }}</div>
    </div>
</section>
<script>
    (() => {
        const form = document.getElementById('give-points-form');
        const preview = document.getElementById('points-cap-preview');
        if (!form || !preview) return;

        const studentBalances = @json($pointsPreview);
        const caps = @json($pointsCaps);
        const earlyEnrollmentPoints = @json((int) app(\App\Services\PointsConfiguration::class)->get('early_enrollment_points'));
        const studentField = form.elements.student_id;
        const sourceField = form.elements.source;
        const pointsField = form.elements.points;

        const updatePreview = () => {
            const student = studentBalances[studentField.value];
            if (!student) {
                preview.classList.add('hidden');
                return;
            }

            const source = sourceField.value;
            const requested = source === 'early_enrollment'
                ? earlyEnrollmentPoints
                : Math.max(0, Number.parseInt(pointsField.value, 10) || 0);
            const semesterRemaining = Math.max(0, caps.semester - student.earned);
            const eventRemaining = Math.max(0, caps.events - student.events);
            const sourceRemaining = source === 'events' ? eventRemaining : Number.POSITIVE_INFINITY;
            const awardable = Math.min(requested, semesterRemaining, sourceRemaining);
            const capped = awardable < requested;
            const reasons = [];

            if (semesterRemaining < requested) reasons.push(`semester cap has ${semesterRemaining} point(s) remaining`);
            if (source === 'events' && eventRemaining < requested) reasons.push(`event cap has ${eventRemaining} point(s) remaining`);

            preview.classList.remove('hidden');
            preview.className = capped
                ? 'rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900'
                : 'rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700';
            preview.textContent = capped
                ? `Cap warning: ${requested} point(s) requested; at most ${awardable} can be awarded because the ${reasons.join(' and ')}.`
                : `Semester points: ${student.earned} of ${caps.semester}. ${source === 'events' ? `Event points: ${student.events} of ${caps.events}.` : ''}`;
        };

        form.addEventListener('input', updatePreview);
        form.addEventListener('change', updatePreview);
        updatePreview();
    })();
</script>
@endsection
