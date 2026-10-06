@extends('layouts.portal', ['title' => 'Department Grade Review'])

@section('content')
<div class="mb-6">
    <p class="text-xs font-black uppercase tracking-[0.18em] text-violet-600">{{ $department->name }}</p>
    <h1 class="mt-1 text-2xl font-black text-slate-900">Department Grade Review</h1>
    <p class="mt-1 text-sm text-slate-500">Review teacher submissions for your department before they go to the Registrar.</p>
</div>

<section class="mb-8">
    <div class="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
            <h2 class="text-lg font-black text-slate-900">Grade Change Requests</h2>
            <p class="mt-1 text-sm text-slate-500">Review corrections to finalized grades from teachers in your department.</p>
        </div>
        <span class="text-xs font-bold uppercase text-slate-400">{{ $changeRequests->total() }} pending</span>
    </div>
    <div class="space-y-4">
        @forelse($changeRequests as $changeRequest)
            @php($changeSubmission = $changeRequest->submission)
            <details class="portal-card group overflow-hidden">
                <summary class="flex cursor-pointer flex-wrap items-center justify-between gap-3 px-5 py-4">
                    <div>
                        <p class="font-black text-slate-900">{{ $changeSubmission->schoolClass?->subject ?? 'Class' }} · {{ $changeSubmission->schoolClass?->section ?? 'Section unavailable' }}</p>
                        <p class="mt-1 text-sm text-slate-500">{{ $changeRequest->teacher?->name ?? 'Account unavailable' }} · Q{{ $changeSubmission->quarter }} · {{ $changeSubmission->school_year }} · Submitted {{ $changeRequest->created_at?->format('M d, Y h:i A') }}</p>
                    </div>
                    <span class="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">Chair review</span>
                </summary>
                <div class="border-t border-slate-100 p-5">
                    <p class="text-sm"><span class="font-bold text-slate-700">Reason:</span> {{ $changeRequest->reason }}</p>
                    <div class="mt-3 overflow-x-auto">
                        <table class="w-full min-w-[420px] text-left text-sm">
                            <thead class="bg-slate-50 text-xs uppercase text-slate-500"><tr><th class="px-4 py-3">Student</th><th class="px-4 py-3">Current</th><th class="px-4 py-3">Requested</th></tr></thead>
                            <tbody class="divide-y divide-slate-100">
                                @foreach($changeRequest->changes ?? [] as $change)
                                    <tr><td class="px-4 py-3"><p class="font-bold text-slate-800">{{ $change['student_name'] }}</p><p class="text-xs text-slate-500">{{ $change['student_code'] }}</p></td><td class="px-4 py-3">{{ number_format((float) $change['old_score'], 2) }}</td><td class="px-4 py-3 font-black text-violet-700">{{ number_format((float) $change['new_score'], 2) }}</td></tr>
                                @endforeach
                            </tbody>
                        </table>
                    </div>
                    <form method="POST" action="{{ route('department-chair.grade-change-requests.review', $changeRequest) }}" class="mt-4 border-t border-slate-100 pt-4">
                        @csrf
                        <label class="block text-xs font-bold uppercase text-slate-500">Review note <span class="normal-case font-medium">(required when rejecting)</span>
                            <textarea name="note" rows="2" maxlength="2000" class="portal-field mt-1 w-full normal-case"></textarea>
                        </label>
                        <div class="mt-3 flex flex-wrap justify-end gap-2">
                            <button type="submit" name="decision" value="reject" class="rounded-lg border border-amber-200 bg-white px-4 py-2 text-sm font-bold text-amber-800 hover:bg-amber-50">Reject</button>
                            <button type="submit" name="decision" value="approve" class="portal-button-primary">Approve for Registrar</button>
                        </div>
                    </form>
                </div>
            </details>
        @empty
            <section class="portal-card px-5 py-6 text-center text-sm text-slate-500">No grade change requests awaiting review.</section>
        @endforelse
    </div>
    @if($changeRequests->hasPages())
        <div class="mt-4">{{ $changeRequests->links() }}</div>
    @endif
</section>

<div class="space-y-4">
    @forelse($submissions as $submission)
        @php($schoolClass = $submission->schoolClass)
        <details class="portal-card group overflow-hidden">
            <summary class="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div class="min-w-0">
                    <p class="truncate font-black text-slate-900">{{ $schoolClass?->subject ?? 'Class' }} · {{ $schoolClass?->section ?? 'Section unavailable' }}</p>
                    <p class="mt-1 text-sm text-slate-500">Teacher: {{ $submission->teacher?->name ?? 'Account unavailable' }} · Q{{ $submission->quarter }} · {{ $submission->school_year }} · College 1–5, 1 highest · Revision {{ $submission->revision }}</p>
                    @if($submission->status === 'registrar_returned')
                        <p class="mt-1 text-sm font-semibold text-amber-700">Registrar note: {{ $submission->registrar_note }}</p>
                    @endif
                </div>
                <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-50 font-black text-violet-700" aria-hidden="true">
                    <span class="group-open:hidden">+</span>
                    <span class="hidden group-open:inline">-</span>
                </span>
            </summary>

            <div class="border-t border-slate-100">
                <div class="overflow-x-auto">
                    <table class="w-full min-w-[620px] text-left text-sm">
                        <thead class="bg-slate-50 text-xs uppercase text-slate-500">
                            <tr><th class="px-5 py-3">Student</th><th class="px-4 py-3">Score</th><th class="px-4 py-3">Remarks</th></tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100">
                            @foreach($submission->grades ?? [] as $gradeLine)
                                <tr>
                                    <td class="px-5 py-3"><p class="font-bold text-slate-900">{{ $gradeLine['student_name'] ?? 'Student' }}</p><p class="text-xs text-slate-500">{{ $gradeLine['student_code'] ?? '' }}</p></td>
                                    <td class="px-4 py-3 font-black text-slate-800">{{ isset($gradeLine['score']) ? number_format((float) $gradeLine['score'], 2) : '-' }}</td>
                                    <td class="px-4 py-3 text-slate-500">{{ $gradeLine['remarks'] ?? '-' }}</td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>

                <div class="border-t border-slate-100 px-5 py-4">
                    <h2 class="text-sm font-black text-slate-800">Review history</h2>
                    <div class="mt-2 divide-y divide-slate-100">
                        @foreach($submission->events as $event)
                            <div class="py-2 text-xs text-slate-500">
                                <span class="font-bold text-slate-700">{{ $event->actor?->name ?? 'System' }}</span>
                                {{ str_replace('_', ' ', $event->action) }} · {{ $event->created_at?->format('M d, Y h:i A') }}
                                @if($event->note)<p class="mt-1">{{ $event->note }}</p>@endif
                            </div>
                        @endforeach
                    </div>
                </div>

                <form method="POST" action="{{ route('department-chair.grades.review', $submission) }}" class="border-t border-slate-100 bg-slate-50 px-5 py-4">
                    @csrf
                    <label class="block text-xs font-bold uppercase text-slate-500">Review note <span class="normal-case font-medium">(required when returning)</span>
                        <textarea name="note" rows="2" maxlength="2000" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900"></textarea>
                    </label>
                    <div class="mt-3 flex flex-wrap justify-end gap-2">
                        @if($submission->status === 'chair_review' || $submission->status === 'registrar_returned')
                            <button name="decision" value="return" class="rounded-lg border border-amber-200 bg-white px-4 py-2 text-sm font-bold text-amber-800 hover:bg-amber-50">Return to Teacher</button>
                            <button type="submit" name="decision" value="approve" class="portal-button-primary min-h-11 whitespace-nowrap">Approve for Registrar</button>
                        @else
                            <button name="decision" value="return" class="rounded-lg border border-amber-200 bg-white px-4 py-2 text-sm font-bold text-amber-800 hover:bg-amber-50">Send Back to Teacher</button>
                        @endif
                    </div>
                </form>
            </div>
        </details>
    @empty
        <section class="portal-card px-5 py-10 text-center">
            <h2 class="font-black text-slate-800">No grade sheets waiting for review</h2>
            <p class="mt-1 text-sm text-slate-500">Teacher submissions for {{ $department->name }} will appear here.</p>
        </section>
    @endforelse
</div>

@if($submissions->hasPages())
    <div class="mt-5">{{ $submissions->links() }}</div>
@endif
@endsection
