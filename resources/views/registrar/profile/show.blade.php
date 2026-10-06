@extends('layouts.portal', ['title' => 'Profile'])

@section('content')
<div class="mb-6">
    <h1 class="text-2xl font-black text-slate-900">Profile</h1>
    <p class="mt-1 text-sm text-slate-500">Your registrar portal account details.</p>
</div>

<section class="max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
    <div class="mb-6 flex flex-col gap-5 border-b border-slate-100 pb-6 sm:flex-row sm:items-center">
        <div class="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-violet-100 text-violet-700 ring-4 ring-violet-50">
            @if($user->profile_photo_url)
                <img src="{{ $user->profile_photo_url }}" alt="Profile photo for {{ $user->name }}" class="h-full w-full object-cover">
            @else
                <svg class="h-12 w-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                    <circle cx="12" cy="8" r="3.5" />
                    <path stroke-linecap="round" d="M5.5 20a6.5 6.5 0 0 1 13 0" />
                </svg>
            @endif
        </div>
        <form method="POST" action="{{ route('registrar.profile.photo.update') }}" enctype="multipart/form-data" class="min-w-0 flex-1 space-y-3">
            @csrf
            <label for="profile_photo" class="block text-sm font-bold text-slate-800">Profile photo</label>
            <input id="profile_photo" name="profile_photo" type="file" accept="image/*" required class="block w-full rounded-lg border border-slate-300 bg-white text-sm text-slate-700 file:mr-4 file:border-0 file:bg-violet-50 file:px-4 file:py-2 file:font-bold file:text-violet-700 hover:file:bg-violet-100">
            @error('profile_photo')
                <p class="text-sm font-semibold text-red-700" role="alert">{{ $message }}</p>
            @enderror
            <button type="submit" class="rounded-lg bg-violet-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-violet-700">Upload photo</button>
        </form>
    </div>

    <dl class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div><dt class="text-sm text-slate-500">Name</dt><dd class="font-black text-slate-900">{{ $user->name }}</dd></div>
        <div><dt class="text-sm text-slate-500">Email</dt><dd class="font-black text-slate-900">{{ $user->email }}</dd></div>
        <div><dt class="text-sm text-slate-500">Role</dt><dd class="font-black text-slate-900">{{ ucwords(str_replace('_', ' ', $user->role)) }}</dd></div>
        <div><dt class="text-sm text-slate-500">Position</dt><dd class="font-black text-slate-900">{{ $user->position ? ucwords(str_replace('_', ' ', $user->position)) : '-' }}</dd></div>
    </dl>
</section>
@endsection
