@extends('layouts.portal', ['title' => 'Profile'])

@section('content')
<div class="mb-6">
    <h1 class="text-2xl font-black text-slate-900">Profile</h1>
    <p class="mt-1 text-sm text-slate-500">Your teacher portal account details.</p>
</div>

<div class="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
    <section class="portal-card p-5">
        <div class="flex items-center gap-4">
            <div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-600 text-xl font-black text-white">
                {{ strtoupper(substr($teacher->name, 0, 2)) }}
            </div>
            <div>
                <p class="text-xl font-black text-slate-900">{{ $teacher->name }}</p>
                <p class="text-sm text-slate-500">{{ $teacher->email }}</p>
                <p class="mt-1 text-xs font-black uppercase text-violet-500">{{ ucwords(str_replace('_', ' ', $teacher->position ?: $teacher->role)) }}</p>
            </div>
        </div>
    </section>

    <section class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <x-stat-card label="Assigned classes" :value="$classes->count()" tone="blue" />
        <x-stat-card label="Class work posted" :value="$assignmentsCount" tone="violet" />
    </section>
</div>
@endsection
