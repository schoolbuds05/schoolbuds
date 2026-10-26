@extends('layouts.portal', ['title' => 'Rooms'])

@section('content')
<div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div>
        <h1 class="text-2xl font-black text-slate-900">Rooms</h1>
        <p class="mt-1 text-sm text-slate-500">Manage lecture rooms and labs. Section generation checks room type, capacity, and schedule availability.</p>
    </div>
    <button type="button" data-modal-open="room-create-modal" class="inline-flex items-center justify-center gap-2 rounded-lg bg-portal-accent px-4 py-2.5 text-sm font-bold text-white hover:bg-portal-accent-hover">
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" d="M12 5v14M5 12h14"/></svg>
        Add room
    </button>
</div>

@if(session('status'))
    <div class="portal-card mb-4 border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{{ session('status') }}</div>
@endif
@if($errors->any())
    <div class="portal-card mb-4 border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <ul class="list-inside list-disc">@foreach($errors->all() as $error)<li>{{ $error }}</li>@endforeach</ul>
    </div>
@endif

<div id="room-create-modal" data-modal class="fixed inset-0 z-50 hidden items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="room-create-title" tabindex="-1">
    <section class="w-full max-w-xl overflow-hidden rounded-xl bg-white shadow-2xl">
        <header class="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
            <div>
                <h2 id="room-create-title" class="text-lg font-black text-slate-900">Add room</h2>
                <p class="mt-1 text-sm text-slate-500">Add a lecture room, lab, or flexible room to the inventory.</p>
            </div>
            <button type="button" data-modal-close="room-create-modal" class="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">Close</button>
        </header>
        <form method="POST" action="{{ route($routePrefix.'.rooms.store') }}" class="max-h-[calc(90vh-5rem)] space-y-4 overflow-y-auto p-5">
            @csrf
            <label class="block text-sm font-bold text-slate-700">Room name
                <input data-modal-autofocus name="name" value="{{ old('name') }}" required maxlength="100" placeholder="e.g. Science Lab 1" class="mt-1 w-full rounded-lg border-slate-300">
            </label>
            <label class="block text-sm font-bold text-slate-700">Room type
                <select name="room_type" required class="mt-1 w-full rounded-lg border-slate-300">
                    <option value="lecture" @selected(old('room_type', 'lecture') === 'lecture')>Lecture</option>
                    <option value="lab" @selected(old('room_type') === 'lab')>Lab</option>
                    <option value="flexible" @selected(old('room_type') === 'flexible')>Flexible</option>
                </select>
            </label>
            <label class="block text-sm font-bold text-slate-700">Capacity
                <input name="capacity" type="number" value="{{ old('capacity', 40) }}" required min="1" max="10000" class="mt-1 w-full rounded-lg border-slate-300">
            </label>
            <label class="flex items-center gap-2 text-sm font-bold text-slate-700"><input type="checkbox" name="is_active" value="1" @checked(old('is_active', '1') === '1') class="rounded border-slate-300"> Active</label>
            <div class="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button type="button" data-modal-close="room-create-modal" class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
                <button class="rounded-lg bg-portal-accent px-4 py-2 text-sm font-bold text-white hover:bg-portal-accent-hover">Add room</button>
            </div>
        </form>
    </section>
</div>

<div class="space-y-3">
    @forelse($rooms as $room)
        <details class="portal-card group overflow-hidden" @if($errors->any()) open @endif>
            <summary class="flex cursor-pointer list-none items-center justify-between gap-4 p-4 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
                <div class="flex min-w-0 flex-wrap items-center gap-2">
                    <span class="truncate text-sm font-bold text-slate-900">{{ $room->name }}</span>
                    <span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold capitalize text-slate-600">{{ $room->room_type }}</span>
                    <span class="text-xs font-semibold text-slate-500">Capacity: {{ $room->capacity }}</span>
                    <span class="rounded-full px-2.5 py-1 text-xs font-bold {{ $room->is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500' }}">{{ $room->is_active ? 'Active' : 'Inactive' }}</span>
                </div>
                <svg class="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="m6 9 6 6 6-6"/></svg>
            </summary>
            <form method="POST" action="{{ route($routePrefix.'.rooms.update', $room) }}" class="grid gap-4 border-t border-slate-100 p-4 md:grid-cols-4 md:items-end">
                @csrf
                @method('PUT')
                <label class="text-sm font-bold text-slate-700">Room name
                    <input name="name" value="{{ $room->name }}" required maxlength="100" class="mt-1 w-full rounded-lg border-slate-300">
                </label>
                <label class="text-sm font-bold text-slate-700">Room type
                    <select name="room_type" required class="mt-1 w-full rounded-lg border-slate-300">
                        <option value="lecture" @selected($room->room_type === 'lecture')>Lecture</option>
                        <option value="lab" @selected($room->room_type === 'lab')>Lab</option>
                        <option value="flexible" @selected($room->room_type === 'flexible')>Flexible</option>
                    </select>
                </label>
                <label class="text-sm font-bold text-slate-700">Capacity
                    <input name="capacity" type="number" value="{{ $room->capacity }}" required min="1" max="10000" class="mt-1 w-full rounded-lg border-slate-300">
                </label>
                <div class="flex items-center justify-between gap-4">
                    <label class="flex items-center gap-2 text-sm font-bold text-slate-700"><input type="checkbox" name="is_active" value="1" @checked($room->is_active) class="rounded border-slate-300"> Active</label>
                    <button class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">Save</button>
                </div>
            </form>
        </details>
    @empty
        <div class="portal-card p-6 text-sm text-slate-500">No rooms yet. Use “Add room” to create a room in the inventory.</div>
    @endforelse
</div>
@endsection
