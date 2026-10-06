@extends('layouts.portal', ['title' => $title])

@section('content')
<div class="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
    <div>
        <p class="text-xs font-black uppercase tracking-[0.18em] text-violet-600">{{ $department->name }}</p>
        <h1 class="mt-1 text-2xl font-black text-slate-900">{{ $title }}</h1>
        <p class="mt-1 text-sm text-slate-500">{{ $courses->count() }} college course(s) in this department</p>
    </div>
    @if($page === 'reports')
        <button type="button" onclick="window.print()" class="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-black text-white shadow-sm hover:bg-violet-700 print:hidden">Print / Save PDF</button>
    @endif
</div>

@if($page === 'teachers')
    <section class="portal-card overflow-hidden">
        <div class="border-b border-slate-100 px-5 py-4">
            <h2 class="font-black text-slate-800">Teachers assigned to {{ $department->name }}</h2>
        </div>
        <div class="divide-y divide-slate-100">
            @forelse($teachers as $teacher)
                <div class="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <p class="font-bold text-slate-900">{{ $teacher->name }}</p>
                    <p class="text-sm text-slate-500">{{ $teacher->email }}</p>
                </div>
            @empty
                <p class="px-5 py-8 text-center text-sm text-slate-500">No teachers are assigned to this department yet.</p>
            @endforelse
        </div>
        @if($teachers->hasPages())
            <div class="border-t border-slate-100 px-5 py-4">{{ $teachers->links() }}</div>
        @endif
    </section>
@elseif($page === 'students')
    @if($students->isNotEmpty())
        <div class="space-y-5">
            @foreach($students as $studentRow)
                @php($student = $studentRow['student'])
                @php($studentRecord = $student->student)
                <details class="portal-card group overflow-hidden">
                    <summary class="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-5 py-4">
                        <div class="flex min-w-0 items-center gap-3">
                            <span class="inline-flex shrink-0 items-center rounded-lg bg-violet-50 px-2.5 py-1 text-xs font-black text-violet-700">{{ $studentRecord?->student_id ?? 'No ID' }}</span>
                            <div class="min-w-0">
                                <p class="truncate text-sm font-bold text-slate-900">{{ $student->name }}</p>
                                <p class="mt-0.5 text-xs text-slate-500">{{ $student->email }} · {{ $studentRow['courses']->join(', ') }}</p>
                            </div>
                        </div>
                        <span aria-hidden="true" class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-50 font-black text-violet-700">
                            <span class="group-open:hidden">+</span>
                            <span class="hidden group-open:inline">-</span>
                        </span>
                    </summary>
                    <div class="border-t border-slate-100 bg-slate-50 px-5 py-4">
                        <h3 class="text-xs font-black uppercase tracking-wide text-slate-500">Student information</h3>
                        <div class="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                            <div>
                                <p class="text-xs font-bold uppercase text-slate-400">Enrolled course(s)</p>
                                <p class="mt-1 font-semibold text-slate-800">{{ $studentRow['courses']->join(', ') }}</p>
                            </div>
                            <div>
                                <p class="text-xs font-bold uppercase text-slate-400">Year / grade</p>
                                <p class="mt-1 font-semibold text-slate-800">{{ $studentRecord?->grade_level ?: 'Not set' }}</p>
                            </div>
                            <div>
                                <p class="text-xs font-bold uppercase text-slate-400">Section</p>
                                <p class="mt-1 font-semibold text-slate-800">{{ $studentRecord?->section ?: 'Not set' }}</p>
                            </div>
                            <div>
                                <p class="text-xs font-bold uppercase text-slate-400">Academic status</p>
                                <p class="mt-1 font-semibold text-slate-800">{{ $studentRecord?->academic_status ?: 'Not set' }}</p>
                            </div>
                            <div>
                                <p class="text-xs font-bold uppercase text-slate-400">Email</p>
                                <p class="mt-1 font-semibold text-slate-800">{{ $student->email }}</p>
                            </div>
                            <div>
                                <p class="text-xs font-bold uppercase text-slate-400">Enrollment status</p>
                                <p class="mt-1 font-semibold text-emerald-700">Enrolled</p>
                            </div>
                        </div>
                    </div>
                </details>
            @endforeach
        </div>
    @else
        <section class="portal-card px-5 py-10 text-center">
            <h2 class="font-black text-slate-800">No enrolled students</h2>
            <p class="mt-1 text-sm text-slate-500">Students enrolled in this department's college courses will appear here.</p>
        </section>
    @endif
@else
    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        @foreach([
            ['Teachers', $summary['teachers']],
            ['College courses', $summary['courses']],
            ['Sections', $summary['sections']],
            ['Enrolled students', $summary['students']],
            ['Grade records', $summary['grades']],
            ['Average grade', number_format($summary['average'], 1)],
        ] as [$label, $value])
            <div class="portal-card p-5">
                <p class="text-xs font-black uppercase tracking-wider text-slate-500">{{ $label }}</p>
                <p class="mt-2 text-2xl font-black text-slate-900">{{ $value }}</p>
            </div>
        @endforeach
    </div>

    <section class="portal-card mt-5 overflow-hidden">
        <div class="border-b border-slate-100 px-5 py-4">
            <h2 class="font-black text-slate-800">Course summary</h2>
        </div>
        <div class="divide-y divide-slate-100">
            @forelse($courseReports as $report)
                <div class="grid gap-2 px-5 py-4 sm:grid-cols-5 sm:items-center">
                    <p class="font-bold text-slate-900 sm:col-span-2">{{ $report['course']->name }}</p>
                    <p class="text-sm text-slate-500">{{ $report['sections'] }} sections</p>
                    <p class="text-sm text-slate-500">{{ $report['students'] }} students</p>
                    <p class="text-sm font-bold text-slate-700">Avg {{ number_format($report['average'], 1) }} · {{ $report['grades'] }} grades</p>
                </div>
            @empty
                <p class="px-5 py-8 text-center text-sm text-slate-500">No college courses are assigned to this department.</p>
            @endforelse
        </div>
    </section>
@endif
@endsection
