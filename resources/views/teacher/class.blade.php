@extends('layouts.portal', ['title' => $class->subject . ' Students'])

@section('content')
@php
    $fromPastClasses = request('view') === 'past';
@endphp
<nav aria-label="Breadcrumb" class="mb-4 text-sm">
    <ol class="flex flex-wrap items-center gap-2">
        <li><a href="{{ route('teacher.dashboard') }}" class="font-bold text-rose-700 hover:underline">Teacher Dashboard</a></li>
        <li aria-hidden="true" class="text-slate-400">/</li>
        <li>
            <a
                href="{{ route('teacher.classes', $fromPastClasses ? ['view' => 'past'] : ['view' => 'current']) }}"
                class="font-bold text-rose-700 hover:underline"
            >{{ $fromPastClasses ? 'Past Classes' : 'Classes' }}</a>
        </li>
        <li aria-hidden="true" class="text-slate-400">/</li>
        <li aria-current="page" class="font-semibold text-slate-600">{{ $class->subject }}</li>
    </ol>
</nav>

<div class="mb-6">
    <h1 class="text-2xl font-black text-slate-900">{{ $class->subject }}</h1>
    <p class="mt-1 text-sm text-slate-500">Grade {{ $class->grade_level }} - {{ $class->section }} · {{ $class->room ?: 'No room' }} · {{ $class->schedule ?: 'No schedule' }} · {{ $isCollege ? 'College 1–5 scale (1 is highest)' : 'SHS 1–100 scale' }}</p>
</div>

<div class="mb-5 flex flex-wrap gap-2">
    <a href="{{ route('teacher.grades', ['class' => $class, 'view' => $fromPastClasses ? 'past' : 'current']) }}" class="portal-button-primary">Enter grades</a>
    @unless($fromPastClasses)
        <a href="{{ route('teacher.attendance', $class) }}" class="portal-button-secondary">Mark attendance</a>
    @endunless
</div>

<section class="portal-card overflow-hidden">
    <table class="w-full text-sm">
        <thead class="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
                <th class="px-5 py-3 text-left">Student</th>
                <th class="px-5 py-3 text-center">Q1</th>
                <th class="px-5 py-3 text-center">Q2</th>
                <th class="px-5 py-3 text-center">Q3</th>
                <th class="px-5 py-3 text-center">Q4</th>
                <th class="px-5 py-3 text-center">Average</th>
            </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
            @forelse($students as $student)
                @php
                    $sg  = $grades[$student->id] ?? collect();
                    $avg = $sg->count() ? round($sg->avg('score'), 1) : null;
                @endphp
                <tr>
                    <td class="px-5 py-3">
                        <div class="flex flex-wrap items-center gap-2">
                            <p class="font-bold text-slate-800">{{ $student->first_name }} {{ $student->last_name }}</p>
                            @if($student->is_irregular)
                                <span class="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase text-amber-800">Irregular</span>
                            @endif
                        </div>
                        <p class="text-xs text-slate-500">{{ $student->student_id }}</p>
                    </td>
                    @foreach([1,2,3,4] as $q)
                        @php($g = $sg->firstWhere('quarter', $q))
                        <td class="px-5 py-3 text-center font-bold {{ $g && ($isCollege ? $g->score <= 2 : $g->score >= 90) ? 'text-emerald-700' : ($g && ($isCollege ? $g->score <= 3 : $g->score >= 75) ? 'text-portal-accent' : 'text-slate-400') }}">
                            {{ $g?->score ?? '-' }}
                        </td>
                    @endforeach
                    <td class="px-5 py-3 text-center font-black {{ $avg !== null && ($isCollege ? $avg <= 2 : $avg >= 90) ? 'text-emerald-700' : ($avg !== null && ($isCollege ? $avg <= 3 : $avg >= 75) ? 'text-portal-accent' : 'text-slate-400') }}">{{ $avg ?? '-' }}</td>
                </tr>
            @empty
                <tr><td colspan="6" class="px-5 py-10 text-center text-slate-500">No students found.</td></tr>
            @endforelse
        </tbody>
    </table>
</section>
@endsection
