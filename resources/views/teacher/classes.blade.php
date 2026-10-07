@extends('layouts.portal', ['title' => 'Classes'])

@section('content')
<div class="mb-6">
    <h1 class="text-2xl font-black text-slate-900">Classes</h1>
    <p class="mt-1 text-sm text-slate-500">
        @if($view === 'past')
            @if($activeTerm)
                Showing classes outside {{ strtoupper($activeTerm->semester) }} semester, A.Y. {{ $activeTerm->school_year }}.
            @else
                No active academic term is configured; showing all assigned classes.
            @endif
        @elseif($activeTerm)
            Showing {{ strtoupper($activeTerm->semester) }} semester classes for A.Y. {{ $activeTerm->school_year }}.
        @else
            No active academic term is configured.
        @endif
        @if($view === 'past')
            Review past class rosters and grades.
        @else
            Open class rosters, attendance, and grade entry.
        @endif
    </p>
</div>

<section class="portal-card overflow-hidden">
    <div class="flex gap-2 border-b border-slate-100 p-4">
        <a
            href="{{ route('teacher.classes', ['view' => 'current']) }}"
            @class([
                'rounded-lg px-4 py-2 text-sm font-bold transition',
                'bg-rose-100 text-rose-700' => $view === 'current',
                'text-slate-500 hover:bg-slate-50' => $view !== 'current',
            ])
            @if($view === 'current') aria-current="page" @endif
        >Current Classes</a>
        <a
            href="{{ route('teacher.classes', ['view' => 'past']) }}"
            @class([
                'rounded-lg px-4 py-2 text-sm font-bold transition',
                'bg-rose-100 text-rose-700' => $view === 'past',
                'text-slate-500 hover:bg-slate-50' => $view !== 'past',
            ])
            @if($view === 'past') aria-current="page" @endif
        >Past Classes</a>
    </div>
    <div class="divide-y divide-slate-100">
        @forelse($classes as $class)
            @php($students = $rosters[$class->id] ?? collect())
            <div class="grid grid-cols-1 gap-3 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                    <button
                        type="button"
                        class="text-left text-lg font-black text-slate-900 transition hover:text-violet-700"
                        data-class-modal-open="class-modal-{{ $class->id }}"
                    >
                        {{ $class->subject }}
                    </button>
                    <p class="mt-1 text-sm text-slate-500">Grade {{ $class->grade_level }} - {{ $class->section }} - {{ $class->school_year }}</p>
                    <p class="mt-1 text-xs font-semibold text-slate-400">{{ $class->room ?: 'No room' }} - {{ $class->schedule ?: 'No schedule' }}</p>
                </div>
                <div class="flex flex-wrap gap-2">
                    <a href="{{ route('teacher.class', ['class' => $class, 'view' => $view]) }}" class="portal-button-secondary">Students</a>
                    <a href="{{ route('teacher.grades', ['class' => $class, 'view' => $view]) }}" class="portal-button-secondary">Grades</a>
                    @if($view === 'current')
                        <a href="{{ route('teacher.attendance', $class) }}" class="portal-button-primary">Attendance</a>
                    @else
                        <a href="{{ route('teacher.attendance', ['class' => $class, 'view' => 'past']) }}" class="portal-button-secondary">Past Attendance</a>
                    @endif
                </div>
            </div>

            <div id="class-modal-{{ $class->id }}" class="fixed inset-0 z-50 hidden items-end bg-slate-950/50 p-4 backdrop-blur-sm sm:items-center sm:justify-center" data-class-modal>
                <div class="max-h-[88vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
                    <div class="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
                        <div>
                            <p class="text-xs font-black uppercase tracking-[0.22em] text-violet-500">Section details</p>
                            <h2 class="mt-2 text-xl font-black text-slate-950">{{ $class->subject }}</h2>
                            <p class="mt-1 text-sm font-semibold text-slate-500">Grade {{ $class->grade_level }} - {{ $class->section }} - {{ $class->school_year }}</p>
                            <p class="mt-1 text-xs font-bold text-slate-400">{{ $class->room ?: 'No room' }} - {{ $class->schedule ?: 'No schedule' }}</p>
                        </div>
                        <button type="button" class="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-50" data-class-modal-close>
                            Close
                        </button>
                    </div>

                    <div class="grid grid-cols-2 gap-3 border-b border-slate-100 p-5 sm:grid-cols-4">
                        <div class="rounded-xl bg-violet-50 p-3">
                            <p class="text-2xl font-black text-violet-700">{{ $students->count() }}</p>
                            <p class="text-xs font-bold uppercase text-violet-500">Students</p>
                        </div>
                        <div class="rounded-xl bg-slate-50 p-3">
                            <p class="text-sm font-black text-slate-800">{{ $class->section }}</p>
                            <p class="text-xs font-bold uppercase text-slate-400">Section</p>
                        </div>
                        <div class="rounded-xl bg-slate-50 p-3">
                            <p class="text-sm font-black text-slate-800">{{ $class->room ?: 'None' }}</p>
                            <p class="text-xs font-bold uppercase text-slate-400">Room</p>
                        </div>
                        <div class="rounded-xl bg-slate-50 p-3">
                            <p class="text-sm font-black text-slate-800">{{ $class->schedule ?: 'None' }}</p>
                            <p class="text-xs font-bold uppercase text-slate-400">Schedule</p>
                        </div>
                    </div>

                    <div class="max-h-[42vh] overflow-y-auto p-5">
                        <h3 class="text-sm font-black text-slate-800">Students</h3>
                        <div class="mt-3 divide-y divide-slate-100">
                            @forelse($students as $student)
                                <div class="flex items-center gap-3 py-3">
                                    <div class="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 text-sm font-black text-violet-700">
                                        {{ strtoupper(substr($student->first_name, 0, 1) . substr($student->last_name, 0, 1)) }}
                                    </div>
                                    <div class="min-w-0">
                                        <p class="truncate text-sm font-black text-slate-900">{{ $student->first_name }} {{ $student->last_name }}</p>
                                        <p class="text-xs font-semibold text-slate-500">{{ $student->student_id }} - {{ $student->email }}</p>
                                    </div>
                                    @if($student->is_irregular)
                                        <span class="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-800">Irregular</span>
                                    @endif
                                </div>
                            @empty
                                <p class="rounded-xl bg-slate-50 p-6 text-center text-sm font-semibold text-slate-500">No students found for this class.</p>
                            @endforelse
                        </div>
                    </div>
                </div>
            </div>
        @empty
            <p class="p-10 text-center text-sm text-slate-500">
                {{ $view === 'past' ? 'No past classes found.' : 'No classes assigned for the current academic term.' }}
            </p>
        @endforelse
    </div>
</section>

<script>
    document.addEventListener('click', (event) => {
        const openButton = event.target.closest('[data-class-modal-open]');
        const closeButton = event.target.closest('[data-class-modal-close]');
        const backdrop = event.target.matches('[data-class-modal]') ? event.target : null;

        if (openButton) {
            const modal = document.getElementById(openButton.dataset.classModalOpen);
            modal?.classList.remove('hidden');
            modal?.classList.add('flex');
        }

        if (closeButton || backdrop) {
            const modal = closeButton?.closest('[data-class-modal]') || backdrop;
            modal?.classList.add('hidden');
            modal?.classList.remove('flex');
        }
    });
</script>
@endsection
