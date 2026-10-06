@extends('layouts.portal', ['title' => 'Admin Dashboard'])

@section('content')
<x-portal-dashboard-hero
    eyebrow="School administration · {{ now()->format('F j, Y') }}"
    title="Your campus, at a glance"
    description="Monitor students, staff, and school finances from one workspace."
    :action-href="route('admin.students.index')"
    action-label="Browse students"
/>

<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
    <x-stat-card label="Students" :value="$stats['total_students']" />
    <x-stat-card label="Active" :value="$stats['active_students']" tone="emerald" />
    <x-stat-card label="Teachers" :value="$stats['total_teachers']" tone="blue" />
    <x-stat-card label="Collected" value="PHP {{ number_format($stats['total_collected']) }}" tone="blue" />
    <x-stat-card label="Outstanding" value="PHP {{ number_format($stats['total_fees_due']) }}" tone="red" />
</div>

<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <section class="portal-card p-5">
        <div class="flex items-center justify-between mb-4">
            <h2 class="font-bold text-slate-800">Recent students</h2>
            <a href="{{ route('admin.students.index') }}" class="text-sm text-blue-700 hover:underline">View all</a>
        </div>
        <div class="divide-y divide-slate-100">
            @forelse($recentStudents as $student)
                <a href="{{ route('admin.students.show', $student) }}" class="flex items-center justify-between py-3 hover:bg-slate-50">
                    <div>
                        <p class="font-semibold text-slate-800">{{ $student->first_name }} {{ $student->last_name }}</p>
                        <p class="text-xs text-slate-500">{{ $student->student_id }} / {{ $student->section ?: 'No section' }}</p>
                    </div>
                    <span class="text-xs rounded-full px-2 py-1 {{ $student->status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600' }}">{{ ucfirst($student->status) }}</span>
                </a>
            @empty
                <p class="py-6 text-sm text-slate-500">No students yet.</p>
            @endforelse
        </div>
    </section>

    <section class="portal-card p-5">
        <h2 class="font-bold text-slate-800 mb-4">Outstanding fees</h2>
        <div class="divide-y divide-slate-100">
            @forelse($unpaidFees as $fee)
                <div class="flex items-center justify-between py-3">
                    <div>
                        <p class="font-semibold text-slate-800">{{ $fee->student?->first_name }} {{ $fee->student?->last_name }}</p>
                        <p class="text-xs text-slate-500">{{ $fee->type }} / {{ ucfirst($fee->status) }}</p>
                    </div>
                    <p class="font-black text-red-600">PHP {{ number_format($fee->amount) }}</p>
                </div>
            @empty
                <p class="py-6 text-sm text-slate-500">No outstanding fees.</p>
            @endforelse
        </div>
    </section>
</div>
@endsection
