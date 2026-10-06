@extends('layouts.portal', ['title' => 'Registrar Dashboard'])

@section('content')
<div class="mb-6">
    <h1 class="text-2xl font-black text-slate-900">Registrar Dashboard</h1>
    <p class="text-sm text-slate-500 mt-1">Enrollment reviews and points verification overview.</p>
</div>

<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
    <x-stat-card label="Pending enrollments" :value="$stats['pending_enrollments']" tone="red" />
    <x-stat-card label="Approved" :value="$stats['approved_enrollments']" tone="emerald" />
    <x-stat-card label="Active students" :value="$stats['active_students']" tone="blue" />
    <x-stat-card label="Points issued" :value="$stats['points_issued']" />
</div>

<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <section class="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div class="flex justify-between items-center mb-4">
            <h2 class="font-black text-slate-800">Recent applications</h2>
            <a href="{{ route('registrar.enrollments.index') }}" class="text-sm text-emerald-700 font-bold hover:underline">Review</a>
        </div>
        <div class="divide-y divide-slate-100">
            @foreach($recentApplications as $application)
                <a href="{{ route('registrar.enrollments.show', $application) }}" class="block py-3 hover:bg-slate-50">
                    <p class="font-bold text-slate-800">{{ $application->full_name }}</p>
                    <p class="text-xs text-slate-500">{{ $application->email }} / {{ ucfirst($application->status) }}</p>
                </a>
            @endforeach
        </div>
    </section>

    <section class="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h2 class="font-black text-slate-800 mb-4">Recent points</h2>
        <div class="divide-y divide-slate-100">
            @forelse($recentPoints as $reward)
                <div class="py-3 flex items-center justify-between">
                    <div>
                        <p class="font-bold text-slate-800">{{ $reward->student?->first_name }} {{ $reward->student?->last_name }}</p>
                        <p class="text-xs text-slate-500">{{ $reward->title }} / {{ str_replace('_', ' ', $reward->source) }}</p>
                    </div>
                    <p class="font-black text-emerald-700">+{{ $reward->points }}</p>
                </div>
            @empty
                <p class="text-sm text-slate-500 py-6">No points issued yet.</p>
            @endforelse
        </div>
    </section>
</div>
@endsection
