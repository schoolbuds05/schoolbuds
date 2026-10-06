@extends('layouts.portal', ['title' => 'Teacher Dashboard'])

@section('content')
<x-portal-dashboard-hero
    eyebrow="Faculty workspace · {{ now()->format('F j, Y') }}"
    title="Your classes, in one place"
    description="Keep up with your students, attendance, and recent grade activity."
    :action-href="route('teacher.classes')"
    action-label="Open my classes"
/>

<div class="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
    <x-stat-card label="My classes" :value="$classes->count()" tone="blue" />
    <x-stat-card label="Total students" :value="$totalStudents" tone="emerald" />
    <x-stat-card label="Grades entered" :value="$recentGrades->count()" tone="violet" />
</div>

<section class="portal-card mb-6 p-5">
    <div class="mb-4 flex items-center justify-between gap-3">
        <h2 class="font-black text-slate-800">My Classes</h2>
        <a href="{{ route('teacher.classes') }}" class="text-sm font-bold text-violet-700 hover:underline">View all</a>
    </div>
    <div class="divide-y divide-slate-100">
        @forelse($classes as $class)
            <div class="flex flex-col gap-3 py-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <p class="font-bold text-slate-900">{{ $class->subject }}</p>
                    <p class="text-sm text-slate-500">Grade {{ $class->grade_level }} - {{ $class->section }} · {{ $class->room ?: 'No room' }} · {{ $class->schedule ?: 'No schedule' }}</p>
                </div>
                <div class="flex flex-wrap gap-2">
                    <a href="{{ route('teacher.attendance', $class) }}" class="portal-button-secondary">Attendance</a>
                    <a href="{{ route('teacher.grades', $class) }}" class="portal-button-secondary">Grades</a>
                    <a href="{{ route('teacher.class', $class) }}" class="portal-button-secondary">Students</a>
                </div>
            </div>
        @empty
            <p class="py-6 text-center text-sm text-slate-500">No classes assigned yet.</p>
        @endforelse
    </div>
</section>

<section class="portal-card p-5">
    <h2 class="mb-4 font-black text-slate-800">Recently Entered Grades</h2>
    <div class="divide-y divide-slate-100">
        @forelse($recentGrades as $grade)
            <div class="flex items-center justify-between gap-3 py-3">
                <div>
                    <p class="font-bold text-slate-800">{{ $grade->student->first_name }} {{ $grade->student->last_name }}</p>
                    <p class="text-xs text-slate-500">{{ $grade->schoolClass->subject }} · Q{{ $grade->quarter }}</p>
                </div>
                <span class="text-lg font-black {{ $grade->schoolClass?->is_college ? ($grade->score <= 2 ? 'text-emerald-700' : ($grade->score <= 3 ? 'text-blue-700' : 'text-red-600')) : ($grade->score >= 90 ? 'text-emerald-700' : ($grade->score >= 75 ? 'text-blue-700' : 'text-red-600')) }}">{{ $grade->score }}</span>
            </div>
        @empty
            <p class="py-6 text-center text-sm text-slate-500">No grades entered yet.</p>
        @endforelse
    </div>
</section>
@endsection
