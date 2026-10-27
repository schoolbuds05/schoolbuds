@extends('layouts.portal', ['title' => 'Profile'])

@section('content')
@php
    $displayName = collect([$user->first_name, $user->middle_name, $user->last_name])->filter()->implode(' ');
    $displayName = $displayName ?: $user->name;
    $departmentName = $user->academicDepartment?->name ?: $user->department;
@endphp

<div class="mb-6">
    <h1 class="text-2xl font-black text-slate-900">My profile</h1>
    <p class="mt-1 text-sm text-slate-500">Your personal details and registrar account information.</p>
</div>

<div class="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,.85fr)]">
    <section class="overflow-hidden rounded-2xl border border-portal-border bg-portal-card shadow-sm">
        <div class="bg-gradient-to-br from-rose-50 via-white to-orange-50 p-6 sm:p-8">
            <div class="flex flex-col gap-5 sm:flex-row sm:items-center">
                <form method="POST" action="{{ route('registrar.profile.photo.update') }}" enctype="multipart/form-data" class="relative h-24 w-24 shrink-0">
                    @csrf
                    <input id="registrar_profile_photo" name="profile_photo" type="file" accept="image/*" required class="sr-only" onchange="this.form.submit()">
                    <label for="registrar_profile_photo" class="group relative flex h-24 w-24 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-portal-accent-soft text-2xl font-black text-portal-accent ring-4 ring-white shadow-sm" title="Change profile photo" aria-label="Change profile photo">
                        @if($user->profile_photo_url)
                            <img src="{{ $user->profile_photo_url }}" alt="Profile photo for {{ $displayName }}" class="h-full w-full object-cover">
                        @else
                            {{ strtoupper(collect(explode(' ', $displayName))->filter()->take(2)->map(fn ($part) => mb_substr($part, 0, 1))->implode('')) }}
                        @endif
                        <span class="absolute inset-0 flex items-center justify-center bg-slate-950/45 text-xs font-bold text-white opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">Change</span>
                    </label>
                    <span class="pointer-events-none absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-[3px] border-white bg-portal-accent text-white shadow-md" aria-hidden="true">
                        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M14 4H10L8.5 6H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3.5L14 4Z"/><circle cx="12" cy="12.5" r="3.2"/></svg>
                    </span>
                    @error('profile_photo')<p class="absolute left-0 top-full mt-2 w-64 text-xs font-semibold text-red-700" role="alert">{{ $message }}</p>@enderror
                </form>
                <div class="min-w-0 flex-1">
                    <p class="text-xs font-black uppercase tracking-[.18em] text-portal-accent">Your profile</p>
                    <h2 class="mt-1 break-words text-2xl font-black text-slate-900">{{ $displayName }}</h2>
                    <p class="mt-1 break-all text-sm text-slate-600">{{ $user->email }}</p>
                    <span class="mt-3 inline-flex rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700 shadow-sm">{{ ucwords(str_replace('_', ' ', $user->position ?: $user->role)) }}</span>
                </div>
            </div>
        </div>

        <div class="p-6 sm:p-8">
            <h3 class="text-base font-black text-slate-900">Personal information</h3>
            <p class="mt-1 text-sm text-slate-500">Details currently saved on your account.</p>
            <dl class="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div class="rounded-xl bg-slate-50 p-4"><dt class="text-xs font-bold uppercase tracking-wide text-slate-500">Full name</dt><dd class="mt-1 break-words font-bold text-slate-900">{{ $displayName }}</dd></div>
                <div class="rounded-xl bg-slate-50 p-4"><dt class="text-xs font-bold uppercase tracking-wide text-slate-500">Email address</dt><dd class="mt-1 break-all font-bold text-slate-900">{{ $user->email }}</dd></div>
                <div class="rounded-xl bg-slate-50 p-4"><dt class="text-xs font-bold uppercase tracking-wide text-slate-500">Department</dt><dd class="mt-1 font-bold text-slate-900">{{ $departmentName ?: 'Not assigned' }}</dd></div>
                <div class="rounded-xl bg-slate-50 p-4"><dt class="text-xs font-bold uppercase tracking-wide text-slate-500">Account type</dt><dd class="mt-1 font-bold text-slate-900">{{ ucwords(str_replace('_', ' ', $user->role)) }}</dd></div>
                <div class="rounded-xl bg-slate-50 p-4 sm:col-span-2"><dt class="text-xs font-bold uppercase tracking-wide text-slate-500">Member since</dt><dd class="mt-1 font-bold text-slate-900">{{ $user->created_at?->format('F Y') ?: 'Not available' }}</dd></div>
            </dl>
        </div>
    </section>

    <aside class="space-y-6">
        <section class="rounded-2xl border border-portal-border bg-portal-card p-6 shadow-sm">
            <h3 class="text-base font-black text-slate-900">Account details</h3>
            <dl class="mt-4 space-y-4">
                <div class="flex items-start justify-between gap-4"><dt class="text-sm text-slate-500">Portal access</dt><dd class="text-right text-sm font-bold text-slate-900">Registrar</dd></div>
                <div class="flex items-start justify-between gap-4"><dt class="text-sm text-slate-500">Position</dt><dd class="text-right text-sm font-bold text-slate-900">{{ $user->position ? ucwords(str_replace('_', ' ', $user->position)) : 'Not set' }}</dd></div>
                <div class="flex items-start justify-between gap-4"><dt class="text-sm text-slate-500">Last updated</dt><dd class="text-right text-sm font-bold text-slate-900">{{ $user->updated_at?->format('M j, Y') ?: 'Not available' }}</dd></div>
            </dl>
        </section>

        @include('profile.partials.portal-update-password-form')
    </aside>
</div>
@endsection
