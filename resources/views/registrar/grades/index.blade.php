@extends('layouts.portal', ['title' => ($showStudentGrades ?? false) ? 'Grades' : ($showApproved ? 'History' : 'Requests')])

@section('content')
<div class="mb-6 flex flex-wrap items-end justify-between gap-3">
    <div>
        <h1 class="text-2xl font-black text-slate-900">{{ $showStudentGrades ? 'Grades' : ($showApproved ? 'History' : 'Requests') }}</h1>
        <p class="mt-1 text-sm text-slate-500">{{ $showStudentGrades ? 'Look up published grades by student name or ID.' : ($showApproved ? 'Review finalized grade sheets and completed grade change requests.' : 'Review chair-approved grade sheets and grade change requests before finalizing.') }}</p>
    </div>
    @if($showStudentGrades)
        <div class="flex flex-wrap items-start gap-2">
            <p class="w-full text-xs text-slate-500 sm:text-right">Import finalized grade records from CSV, or export published grades for College and SHS.</p>
            <form method="POST" action="{{ route('registrar.grades.import') }}" enctype="multipart/form-data" class="flex flex-wrap items-start gap-2">
                @csrf
                <label class="sr-only" for="grades-file">Grade CSV file</label>
                <div class="grade-import-file-picker flex flex-col items-start gap-1">
                    <input id="grades-file" name="grades_file" type="file" accept=".csv,text/csv" required class="max-w-56 text-xs text-slate-600 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-bold file:text-slate-700">
                </div>
                <button type="submit" class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">Import CSV</button>
            </form>
            <a href="{{ route('registrar.grades.export', ['program_type' => 'college']) }}" class="rounded-lg bg-portal-accent px-4 py-2 text-sm font-bold text-white hover:bg-portal-accent-hover">Export College CSV</a>
            <a href="{{ route('registrar.grades.export', ['program_type' => 'shs']) }}" class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">Export SHS CSV</a>
        </div>
    @endif
</div>

@if($showStudentGrades)
    <form method="GET" action="{{ route('registrar.grades.index') }}" class="mb-5 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row">
        <input type="hidden" name="view" value="students">
        <label for="student-grade-search" class="sr-only">Search by student name or ID</label>
        <input id="student-grade-search" type="search" name="search" value="{{ $studentSearch }}" placeholder="Search by student name or ID" class="min-w-0 flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm">
        <button type="submit" class="rounded-lg bg-portal-accent px-5 py-2.5 text-sm font-bold text-white hover:bg-portal-accent-hover">Search</button>
        @if($studentSearch !== '')
            <a href="{{ route('registrar.grades.index', ['view' => 'students']) }}" class="rounded-lg border border-slate-300 px-4 py-2.5 text-center text-sm font-bold text-slate-600 hover:bg-slate-50">Clear</a>
        @endif
    </form>

    <div class="space-y-3">
        @forelse($studentGrades as $student)
            <details class="portal-card group overflow-hidden">
                <summary class="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-5 py-4">
                    <div>
                        <p class="font-black text-slate-900">{{ trim($student->first_name . ' ' . $student->last_name) }}</p>
                        <p class="mt-1 text-sm text-slate-500">{{ $student->student_id ?: 'No student ID' }} · {{ $student->grades->count() }} published {{ \Illuminate\Support\Str::plural('grade', $student->grades->count()) }}</p>
                    </div>
                    <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-50 font-black text-violet-700" aria-hidden="true"><span class="group-open:hidden">+</span><span class="hidden group-open:inline">−</span></span>
                </summary>
                @php($gradesByPeriod = $student->grades->groupBy(function ($grade) {
                    $schoolClass = $grade->schoolClass;
                    $quarter = (int) $grade->quarter;
                    $period = $schoolClass?->is_college ? (['Prelim', 'Midterm', 'Prefinal', 'Final'][$quarter - 1] ?? 'Quarter ' . $quarter) : 'Q' . $quarter;
                    return ($grade->school_year ?: 'Unknown school year') . '|' . $period;
                }))
                <div class="space-y-2 border-t border-slate-100 bg-slate-50/60 p-3 sm:p-4">
                    @foreach($gradesByPeriod as $periodKey => $periodGrades)
                        @php([$schoolYearLabel, $periodLabel] = explode('|', $periodKey, 2))
                        <details class="overflow-hidden rounded-xl border border-slate-200 bg-white">
                            <summary class="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-bold text-slate-700 hover:bg-slate-50">
                                <span>{{ $periodLabel }} <span class="font-normal text-slate-500">· {{ $schoolYearLabel }} · {{ $periodGrades->count() }} {{ \Illuminate\Support\Str::plural('subject', $periodGrades->count()) }}</span></span>
                                <span class="text-slate-400" aria-hidden="true">⌄</span>
                            </summary>
                            <div class="overflow-x-auto border-t border-slate-100">
                                <table class="w-full min-w-[620px] text-left text-sm">
                                    <thead class="bg-slate-50 text-xs uppercase text-slate-500"><tr><th class="px-5 py-3">Subject · Section</th><th class="px-4 py-3">School year · Period</th><th class="px-4 py-3">Remarks</th><th class="px-4 py-3 text-right">Score</th></tr></thead>
                                    <tbody class="divide-y divide-slate-100">
                            @foreach($periodGrades as $grade)
                                @php($schoolClass = $grade->schoolClass)
                                @php($quarter = (int) $grade->quarter)
                                @php($period = $schoolClass?->is_college ? (['Prelim', 'Midterm', 'Prefinal', 'Final'][$quarter - 1] ?? 'Quarter ' . $quarter) : 'Q' . $quarter)
                                <tr>
                                    <td class="px-5 py-3"><p class="font-bold text-slate-900">{{ $schoolClass?->subject ?? 'Subject' }} · {{ $schoolClass?->section ?? 'Section' }}</p><p class="text-xs text-slate-500">{{ $schoolClass?->grade_level ? 'Grade ' . $schoolClass->grade_level : '' }}</p></td>
                                    <td class="px-4 py-3 text-slate-600">{{ $grade->school_year }} · {{ $period }}</td>
                                    <td class="px-4 py-3 text-slate-500">{{ $grade->remarks ?: 'No remarks' }}</td>
                                    <td class="px-4 py-3 text-right font-black text-slate-800">{{ $grade->score === null ? '—' : number_format((float) $grade->score, 2) }}</td>
                                </tr>
                            @endforeach
                                    </tbody>
                                </table>
                            </div>
                        </details>
                    @endforeach
                </div>
            </details>
        @empty
            <section class="portal-card px-5 py-10 text-center">
                <h2 class="font-black text-slate-800">No published grades found</h2>
                <p class="mt-1 text-sm text-slate-500">Search by a student’s name or ID, or check again after grades are finalized.</p>
            </section>
        @endforelse
    </div>
    @if($studentGrades->hasPages())
        <div class="mt-5">{{ $studentGrades->links() }}</div>
    @endif
@else
<div class="space-y-4">
    @forelse($submissions as $submission)
        @php($schoolClass = $submission->schoolClass)
        @php($quarterLabel = $schoolClass?->is_college ? ['Prelim', 'Midterm', 'Prefinal', 'Final'][(int) $submission->quarter - 1] ?? 'Q' . $submission->quarter : 'Q' . $submission->quarter)
        <details class="portal-card group overflow-hidden">
            <summary class="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div class="min-w-0">
                    <p class="truncate font-black text-slate-900">{{ $schoolClass?->subject ?? 'Class' }} · {{ $schoolClass?->section ?? 'Section unavailable' }}</p>
                    <p class="mt-1 text-sm text-slate-500">Teacher: {{ $submission->teacher?->name ?? 'Account unavailable' }} · {{ $quarterLabel }} · {{ $submission->school_year }} · {{ $schoolClass?->is_college ? 'College 1–5, 1 highest' : 'SHS 1–100' }} · Revision {{ $submission->revision }}@if($showApproved) · Approved {{ $submission->finalized_at?->format('M d, Y h:i A') ?? 'date unavailable' }}@endif</p>
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
                    <h2 class="text-sm font-black text-slate-800">Approval history</h2>
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

                @unless($showApproved)
                    <form method="POST" action="{{ route('registrar.grades.review', $submission) }}" class="border-t border-slate-100 bg-slate-50 px-5 py-4">
                        @csrf
                        <label class="block text-xs font-bold uppercase text-slate-500">Review note <span class="normal-case font-medium">(required when returning)</span>
                            <textarea name="note" rows="2" maxlength="2000" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900"></textarea>
                        </label>
                        <div class="mt-3 flex flex-wrap justify-end gap-2">
                            <button name="decision" value="return" class="rounded-lg border border-amber-200 bg-white px-4 py-2 text-sm font-bold text-amber-800 hover:bg-amber-50">Return to Chair</button>
                            <button name="decision" value="approve" class="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800">Finalize Grades</button>
                        </div>
                    </form>
                @endunless
            </div>
        </details>
    @empty
        @if($showApproved || $changeRequests->count() === 0)
            <section class="portal-card px-5 py-10 text-center">
                <h2 class="font-black text-slate-800">{{ $showApproved ? 'No approved grade sheets yet' : 'Nothing awaiting Registrar approval' }}</h2>
                <p class="mt-1 text-sm text-slate-500">{{ $showApproved ? 'Grade sheets finalized by the Registrar will appear here.' : 'Chair-approved grade sheets and grade-change requests will appear here.' }}</p>
            </section>
        @endif
    @endforelse
</div>

@if($submissions->hasPages())
    <div class="mt-5">{{ $submissions->links() }}</div>
@endif

    <section class="mt-8">
        <div class="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
                <h2 class="text-lg font-black text-slate-900">{{ $showApproved ? 'Grade Change Request History' : 'Grade Change Requests' }}</h2>
                <p class="mt-1 text-sm text-slate-500">{{ $showApproved ? 'Completed corrections to published grades.' : 'Chair-approved corrections to already published grades awaiting Registrar review.' }}</p>
            </div>
            <span class="text-xs font-bold uppercase text-slate-400">{{ $changeRequests->total() }} {{ $showApproved ? 'completed' : 'pending' }}</span>
        </div>
        <div class="space-y-4">
            @forelse($changeRequests as $changeRequest)
                @php($submission = $changeRequest->submission)
                @php($schoolClass = $submission->schoolClass)
                @php($quarterLabel = $schoolClass?->is_college ? ['Prelim', 'Midterm', 'Prefinal', 'Final'][(int) $submission->quarter - 1] ?? 'Q' . $submission->quarter : 'Q' . $submission->quarter)
                <details class="portal-card group overflow-hidden">
                    <summary class="flex cursor-pointer flex-wrap items-center justify-between gap-3 px-5 py-4">
                        <div>
                            <p class="font-black text-slate-900">{{ $schoolClass?->subject ?? 'Class' }} · {{ $schoolClass?->section ?? 'Section unavailable' }}</p>
                            <p class="mt-1 text-sm text-slate-500">{{ $changeRequest->teacher?->name ?? 'Account unavailable' }} · {{ $quarterLabel }} · {{ $submission->school_year }} · Chair approved {{ $changeRequest->chair_reviewed_at?->format('M d, Y h:i A') }}</p>
                        </div>
                        @if($showApproved)
                            @php($requestWasApproved = $changeRequest->status === \App\Models\GradeChangeRequest::STATUS_APPROVED)
                            <span class="rounded-full px-3 py-1 text-xs font-bold {{ $requestWasApproved ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800' }}">{{ $requestWasApproved ? 'Approved' : 'Rejected' }}</span>
                        @else
                            <span class="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">Grade change</span>
                        @endif
                    </summary>
                    <div class="border-t border-slate-100 p-5">
                        <p class="text-sm"><span class="font-bold text-slate-700">Teacher's reason:</span> {{ $changeRequest->reason }}</p>
                        @if($changeRequest->chair_note)<p class="mt-1 text-sm text-slate-600"><span class="font-bold">Chair note:</span> {{ $changeRequest->chair_note }}</p>@endif
                        <div class="mt-3 overflow-x-auto">
                            <table class="w-full min-w-[480px] text-left text-sm">
                                <thead class="bg-slate-50 text-xs uppercase text-slate-500"><tr><th class="px-4 py-3">Student</th><th class="px-4 py-3">Published</th><th class="px-4 py-3">Requested</th><th class="px-4 py-3">New remarks</th></tr></thead>
                                <tbody class="divide-y divide-slate-100">
                                    @foreach($changeRequest->changes ?? [] as $change)
                                        <tr><td class="px-4 py-3"><p class="font-bold text-slate-800">{{ $change['student_name'] }}</p><p class="text-xs text-slate-500">{{ $change['student_code'] }}</p></td><td class="px-4 py-3">{{ number_format((float) $change['old_score'], 2) }}</td><td class="px-4 py-3 font-black text-violet-700">{{ number_format((float) $change['new_score'], 2) }}</td><td class="px-4 py-3 text-slate-500">{{ $change['new_remarks'] }}</td></tr>
                                    @endforeach
                                </tbody>
                            </table>
                        </div>
                        <div class="mt-4 border-t border-slate-100 pt-3">
                            <h3 class="text-sm font-black text-slate-800">Request history</h3>
                            <div class="mt-2 divide-y divide-slate-100">
                                @foreach($changeRequest->events as $event)
                                    <p class="py-2 text-xs text-slate-500"><span class="font-bold text-slate-700">{{ $event->actor?->name ?? 'System' }}</span> · {{ str_replace('_', ' ', $event->action) }} · {{ $event->created_at?->format('M d, Y h:i A') }}@if($event->note) · {{ $event->note }}@endif</p>
                                @endforeach
                            </div>
                        </div>
                        @unless($showApproved)
                        <form method="POST" action="{{ route('registrar.grade-change-requests.review', $changeRequest) }}" class="mt-4 border-t border-slate-100 pt-4">
                            @csrf
                            <label class="block text-xs font-bold uppercase text-slate-500">Review note <span class="normal-case font-medium">(required when rejecting)</span>
                                <textarea name="note" rows="2" maxlength="2000" class="portal-field mt-1 w-full normal-case"></textarea>
                            </label>
                            <div class="mt-3 flex flex-wrap justify-end gap-2">
                                <button type="submit" name="decision" value="reject" class="rounded-lg border border-amber-200 bg-white px-4 py-2 text-sm font-bold text-amber-800 hover:bg-amber-50">Reject</button>
                                <button type="submit" name="decision" value="approve" class="portal-button-primary">Approve and Publish</button>
                            </div>
                        </form>
                        @endunless
                    </div>
                </details>
            @empty
                <section class="portal-card px-5 py-6 text-center text-sm text-slate-500">{{ $showApproved ? 'No completed grade change requests yet.' : 'No grade change requests awaiting review.' }}</section>
            @endforelse
        </div>
        @if($changeRequests->hasPages())
            <div class="mt-4">{{ $changeRequests->links() }}</div>
        @endif
    </section>
@endif
@endsection
