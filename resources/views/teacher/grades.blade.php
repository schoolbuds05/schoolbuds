@extends('layouts.portal', ['title' => 'Grade Entry'])

@section('content')
<a href="{{ route('teacher.classes') }}" class="text-sm font-bold text-violet-700 hover:underline">Back to classes</a>

<div class="mt-4 mb-6">
    <h1 class="text-2xl font-black text-slate-900">Grade Entry</h1>
    <p class="mt-1 text-sm text-slate-500">{{ $class->subject }} · Grade {{ $class->grade_level }} - {{ $class->section }} · {{ $isCollege ? 'College scale: 1.00–5.00 (1 is highest)' : 'SHS scale: 1–100' }}</p>
</div>

@php
    $quarterLabels = $isCollege
        ? ['Prelim', 'Midterm', 'Prefinal', 'Final']
        : ['Quarter 1', 'Quarter 2', 'Quarter 3', 'Quarter 4'];
@endphp

<div class="mb-6 flex flex-wrap gap-2" id="quarter-tabs">
    @foreach([1,2,3,4] as $q)
        <button type="button" onclick="switchQuarter({{ $q }})" id="tab-{{ $q }}"
            class="rounded-xl border px-5 py-2 text-sm font-bold transition {{ $q === 1 ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-600 border-violet-100 hover:bg-violet-50' }}">
            {{ $quarterLabels[$q - 1] ?? 'Quarter ' . $q }}
        </button>
    @endforeach
</div>

@foreach([1,2,3,4] as $quarter)
    <div id="quarter-{{ $quarter }}" class="{{ $quarter !== 1 ? 'hidden' : '' }}">
        @php
            $submission = $submissions->get((string) $quarter) ?? $submissions->get($quarter);
            $submissionGrades = collect($submission?->grades ?? [])->keyBy('student_id');
            $latestChangeRequest = $submission ? $changeRequests->get($submission->id) : null;
            $hasOpenChangeRequest = $latestChangeRequest && in_array($latestChangeRequest->status, ['chair_review', 'registrar_review'], true);
            $isLocked = $submission && !in_array($submission->status, ['draft', 'teacher_revision'], true);
            $statusLabels = ['draft' => 'Draft', 'chair_review' => 'Waiting for Department Chair', 'teacher_revision' => 'Returned for correction', 'registrar_review' => 'Waiting for Registrar', 'registrar_returned' => 'Returned by Registrar', 'finalized' => 'Finalized'];
        @endphp
        @if($submission)
            <div class="mb-4 rounded-xl border border-violet-100 bg-white px-4 py-3 text-sm">
                <p class="font-black text-slate-800">{{ $statusLabels[$submission->status] ?? ucfirst(str_replace('_', ' ', $submission->status)) }} · Revision {{ $submission->revision }}</p>
                @if($submission->chair_note)
                    <p class="mt-1 text-slate-600">Chair note: {{ $submission->chair_note }}</p>
                @endif
                @if($submission->registrar_note)
                    <p class="mt-1 text-slate-600">Registrar note: {{ $submission->registrar_note }}</p>
                @endif
            </div>
        @endif
        <form method="POST" action="{{ route('teacher.grades.store', $class) }}">
            @csrf
            <input type="hidden" name="quarter_display" value="{{ $quarter }}">
            <section class="portal-card overflow-hidden">
                <table class="w-full text-sm">
                    <thead class="bg-slate-50 text-xs uppercase text-slate-500">
                        <tr>
                            <th class="px-5 py-3 text-left">Student</th>
                            <th class="px-5 py-3 text-center">{{ $isCollege ? 'College grade (1–5)' : 'SHS score (1–100)' }}</th>
                            <th class="px-5 py-3 text-center">Current</th>
                            <th class="px-5 py-3 text-center">Remarks</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                        @foreach($students as $i => $student)
                            @php
                                $key = $student->id . '_' . $quarter;
                                $existing = $submissionGrades->get($student->id) ?? $grades->get($key);
                                $existingScore = is_array($existing) ? ($existing['score'] ?? null) : $existing?->score;
                                $existingRemarks = is_array($existing) ? ($existing['remarks'] ?? null) : $existing?->remarks;
                            @endphp
                            <tr>
                                <td class="px-5 py-3">
                                    <input type="hidden" name="grades[{{ $i }}][student_id]" value="{{ $student->id }}">
                                    <input type="hidden" name="grades[{{ $i }}][quarter]" value="{{ $quarter }}">
                                    <div class="flex flex-wrap items-center gap-2">
                                        <p class="font-bold text-slate-800">{{ $student->first_name }} {{ $student->last_name }}</p>
                                        @if($student->is_irregular)
                                            <span class="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase text-amber-800">Irregular</span>
                                        @endif
                                    </div>
                                    <p class="text-xs text-slate-500">{{ $student->student_id }}</p>
                                </td>
                                <td class="px-5 py-3 text-center">
                                    <input type="number" name="grades[{{ $i }}][score]" value="{{ $existingScore ?? '' }}" min="1" max="{{ $isCollege ? '5' : '100' }}" step="{{ $isCollege ? '0.25' : '1' }}" placeholder="-" @disabled($isLocked) class="portal-field w-24 text-center">
                                </td>
                                <td class="px-5 py-3 text-center font-black {{ $existingScore !== null && ($isCollege ? $existingScore <= 2 : $existingScore >= 90) ? 'text-emerald-700' : ($existingScore !== null && ($isCollege ? $existingScore <= 3 : $existingScore >= 75) ? 'text-blue-700' : 'text-slate-400') }}">
                                    {{ $existingScore ?? '-' }}
                                </td>
                                <td class="px-5 py-3 text-center text-xs font-semibold text-slate-500">{{ $existingRemarks ?? '-' }}</td>
                            </tr>
                        @endforeach
                    </tbody>
                </table>
                @if(!$isLocked)
                    <div class="flex flex-wrap justify-end gap-2 border-t border-violet-100 px-5 py-4">
                        <button name="intent" value="draft" class="portal-button-secondary">Save Draft</button>
                        <button name="intent" value="submit" class="portal-button-primary">Submit to Chair</button>
                    </div>
                @endif
            </section>
        </form>

                @if($submission?->status === 'finalized' && $isCollege)
                    @if($latestChangeRequest)
                        <section class="portal-card mt-4 p-5">
                            <h2 class="text-sm font-black text-slate-800">Latest grade change request · {{ ucfirst(str_replace('_', ' ', $latestChangeRequest->status)) }}</h2>
                            <p class="mt-2 text-sm text-slate-600">Reason: {{ $latestChangeRequest->reason }}</p>
                            @if($latestChangeRequest->chair_note)
                                <p class="mt-1 text-sm text-slate-600">Chair note: {{ $latestChangeRequest->chair_note }}</p>
                            @endif
                            @if($latestChangeRequest->registrar_note)
                                <p class="mt-1 text-sm text-slate-600">Registrar note: {{ $latestChangeRequest->registrar_note }}</p>
                            @endif
                            <div class="mt-3 divide-y divide-slate-100 border-t border-slate-100">
                                @foreach($latestChangeRequest->events as $event)
                                    <p class="py-2 text-xs text-slate-500"><span class="font-bold text-slate-700">{{ $event->actor?->name ?? 'System' }}</span> · {{ str_replace('_', ' ', $event->action) }} · {{ $event->created_at?->format('M d, Y h:i A') }}</p>
                                @endforeach
                            </div>
                        </section>
                    @endif

                    @if($hasOpenChangeRequest)
                        <p class="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">This quarter already has a change request under review.</p>
                    @else
                        <form method="POST" action="{{ route('teacher.grades.change-request', [$class, $submission]) }}" class="portal-card mt-4 p-5">
                            @csrf
                            <h2 class="font-black text-slate-800">Request a grade change</h2>
                            <p class="mt-1 text-sm text-slate-500">Enter a new score only for students whose published grade needs correction.</p>
                            <div class="mt-4 overflow-x-auto">
                                <table class="w-full min-w-[480px] text-left text-sm">
                                    <thead class="bg-slate-50 text-xs uppercase text-slate-500">
                                        <tr><th class="px-4 py-3">Student</th><th class="px-4 py-3">Published</th><th class="px-4 py-3">Requested</th></tr>
                                    </thead>
                                    <tbody class="divide-y divide-slate-100">
                                        @foreach($submission->grades ?? [] as $gradeLine)
                                            <tr>
                                                <td class="px-4 py-3"><p class="font-bold text-slate-800">{{ $gradeLine['student_name'] ?? 'Student' }}</p><p class="text-xs text-slate-500">{{ $gradeLine['student_code'] ?? '' }}</p></td>
                                                <td class="px-4 py-3 font-black text-slate-700">{{ isset($gradeLine['score']) ? number_format((float) $gradeLine['score'], 2) : '-' }}</td>
                                                <td class="px-4 py-3"><input type="number" name="changes[{{ $gradeLine['student_id'] }}]" min="1" max="{{ $isCollege ? '5' : '100' }}" step="{{ $isCollege ? '0.25' : '1' }}" placeholder="No change" class="portal-field w-32"></td>
                                            </tr>
                                        @endforeach
                                    </tbody>
                                </table>
                            </div>
                            <label class="mt-4 block text-xs font-bold uppercase text-slate-500">Reason for correction
                                <textarea name="reason" rows="3" maxlength="2000" required class="portal-field mt-1 w-full normal-case"></textarea>
                            </label>
                            <div class="mt-4 flex justify-end">
                                <button type="submit" class="portal-button-primary">Send Change Request</button>
                            </div>
                        </form>
                    @endif
                @endif
    </div>
@endforeach

<script>
function switchQuarter(q) {
    [1, 2, 3, 4].forEach((i) => {
        document.getElementById('quarter-' + i).classList.add('hidden');
        document.getElementById('tab-' + i).className = 'rounded-xl border px-5 py-2 text-sm font-bold transition bg-white text-slate-600 border-violet-100 hover:bg-violet-50';
    });
    document.getElementById('quarter-' + q).classList.remove('hidden');
    document.getElementById('tab-' + q).className = 'rounded-xl border px-5 py-2 text-sm font-bold transition bg-violet-600 text-white border-violet-600';
}
</script>
@endsection
