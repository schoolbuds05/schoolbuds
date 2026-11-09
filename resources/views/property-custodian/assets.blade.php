@extends('layouts.portal', ['title' => 'Property Assets'])

@section('content')
<x-portal-dashboard-hero
    eyebrow="Staff workspace · Inventory"
    title="Asset inventory"
    description="Track school property, locations, custody, condition, and maintenance status."
    :action-href="route('property-custodian.dashboard')"
    action-label="Back to overview"
/>

@if (session('status'))
    <div class="portal-card mb-5 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{{ session('status') }}</div>
@endif

@if ($errors->any())
    <div class="portal-card mb-5 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        <p class="font-bold">Please correct the following:</p>
        <ul class="mt-2 list-inside list-disc">@foreach ($errors->all() as $error)<li>{{ $error }}</li>@endforeach</ul>
    </div>
@endif

<div class="mb-7 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
    <x-stat-card label="Assets" :value="$stats['total']" />
    <x-stat-card label="Available" :value="$stats['available']" tone="emerald" />
    <x-stat-card label="Assigned" :value="$stats['assigned']" tone="accent" />
    <x-stat-card label="Maintenance" :value="$stats['maintenance']" />
    <x-stat-card label="Needs attention" :value="$stats['needs_attention']" tone="red" />
</div>

<details class="portal-card mb-6 overflow-hidden" {{ $errors->any() ? 'open' : '' }}>
    <summary class="flex cursor-pointer list-none items-center justify-between px-5 py-4 font-bold text-slate-800">
        <span>Add an asset</span>
        <span class="portal-button-primary">+ Add asset</span>
    </summary>
    <form method="POST" action="{{ route('property-custodian.assets.store') }}" class="grid gap-4 border-t border-slate-100 p-5 md:grid-cols-2 xl:grid-cols-4">
        @csrf
        <label class="text-sm font-semibold text-slate-700">Asset tag<input class="portal-field mt-1 w-full" name="asset_tag" value="{{ old('asset_tag') }}" required maxlength="255"></label>
        <label class="text-sm font-semibold text-slate-700">Name<input class="portal-field mt-1 w-full" name="name" value="{{ old('name') }}" required maxlength="255"></label>
        <label class="text-sm font-semibold text-slate-700">Category<input class="portal-field mt-1 w-full" name="category" value="{{ old('category') }}" maxlength="255"></label>
        <label class="text-sm font-semibold text-slate-700">Location<input class="portal-field mt-1 w-full" name="location" value="{{ old('location') }}" maxlength="255"></label>
        <label class="text-sm font-semibold text-slate-700">Condition
            <select class="portal-field mt-1 w-full" name="condition" required>@foreach(\App\Models\PropertyAsset::CONDITIONS as $conditionOption)<option value="{{ $conditionOption }}" @selected(old('condition', 'good') === $conditionOption)>{{ str_replace('_', ' ', ucfirst($conditionOption)) }}</option>@endforeach</select>
        </label>
        <label class="text-sm font-semibold text-slate-700">Status
            <select class="portal-field mt-1 w-full" name="status" required>@foreach(\App\Models\PropertyAsset::STATUSES as $statusOption)<option value="{{ $statusOption }}" @selected(old('status', 'available') === $statusOption)>{{ ucfirst($statusOption) }}</option>@endforeach</select>
        </label>
        <label class="text-sm font-semibold text-slate-700">Assigned to<input class="portal-field mt-1 w-full" name="assigned_to" value="{{ old('assigned_to') }}" maxlength="255" placeholder="Person or department"></label>
        <label class="text-sm font-semibold text-slate-700 md:col-span-2 xl:col-span-4">Notes<textarea class="portal-field mt-1 w-full" name="notes" rows="2" maxlength="2000">{{ old('notes') }}</textarea></label>
        <div class="md:col-span-2 xl:col-span-4"><button class="portal-button-primary" type="submit">Save asset</button></div>
    </form>
</details>

<section class="portal-card overflow-hidden">
    <form method="GET" action="{{ route('property-custodian.assets') }}" class="grid gap-3 border-b border-slate-200 p-4 md:grid-cols-[minmax(220px,1fr)_180px_180px_auto_auto]">
        <input class="portal-field w-full" type="search" name="search" value="{{ $search }}" placeholder="Search name, tag, location, assignee">
        <select class="portal-field w-full" name="status">
            <option value="">All statuses</option>
            @foreach(\App\Models\PropertyAsset::STATUSES as $statusOption)<option value="{{ $statusOption }}" @selected($status === $statusOption)>{{ ucfirst($statusOption) }}</option>@endforeach
        </select>
        <select class="portal-field w-full" name="condition">
            <option value="">All conditions</option>
            @foreach(\App\Models\PropertyAsset::CONDITIONS as $conditionOption)<option value="{{ $conditionOption }}" @selected($condition === $conditionOption)>{{ str_replace('_', ' ', ucfirst($conditionOption)) }}</option>@endforeach
        </select>
        <button class="portal-button-primary" type="submit">Filter</button>
        <a class="portal-button-secondary text-center" href="{{ route('property-custodian.assets') }}">Reset</a>
    </form>

    <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-200 text-sm">
            <thead class="bg-slate-50 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                <tr><th class="px-5 py-3">Asset</th><th class="px-5 py-3">Category / location</th><th class="px-5 py-3">Custody</th><th class="px-5 py-3">Condition</th><th class="px-5 py-3">Status</th><th class="px-5 py-3">Actions</th></tr>
            </thead>
            <tbody class="divide-y divide-slate-100 bg-white">
                @forelse($assets as $asset)
                    <tr>
                        <td class="px-5 py-4"><p class="font-bold text-slate-900">{{ $asset->name }}</p><p class="mt-0.5 text-xs text-slate-500">{{ $asset->asset_tag }}</p>@if($asset->notes)<p class="mt-1 max-w-sm text-xs text-slate-500">{{ $asset->notes }}</p>@endif</td>
                        <td class="px-5 py-4 text-slate-600">{{ $asset->category ?: 'Uncategorized' }}<p class="mt-1 text-xs text-slate-500">{{ $asset->location ?: 'No location' }}</p></td>
                        <td class="px-5 py-4 text-slate-600">{{ $asset->assigned_to ?: 'Unassigned' }}</td>
                        <td class="px-5 py-4 text-slate-600">{{ str_replace('_', ' ', ucfirst($asset->condition)) }}</td>
                        <td class="px-5 py-4"><span class="rounded-full px-2.5 py-1 text-xs font-bold {{ $asset->status === 'available' ? 'bg-emerald-100 text-emerald-700' : ($asset->status === 'maintenance' ? 'bg-amber-100 text-amber-800' : 'bg-portal-accent-soft text-portal-accent') }}">{{ ucfirst($asset->status) }}</span></td>
                        <td class="min-w-40 px-5 py-4">
                            <details>
                                <summary class="cursor-pointer font-bold text-portal-accent">Edit</summary>
                                <form method="POST" action="{{ route('property-custodian.assets.update', $asset) }}" class="mt-3 grid min-w-64 gap-2">
                                    @csrf @method('PUT')
                                    <input class="portal-field w-full" name="asset_tag" value="{{ $asset->asset_tag }}" aria-label="Asset tag" required maxlength="255">
                                    <input class="portal-field w-full" name="name" value="{{ $asset->name }}" aria-label="Name" required maxlength="255">
                                    <input class="portal-field w-full" name="category" value="{{ $asset->category }}" aria-label="Category" placeholder="Category">
                                    <input class="portal-field w-full" name="location" value="{{ $asset->location }}" aria-label="Location" placeholder="Location">
                                    <select class="portal-field w-full" name="condition" aria-label="Condition" required>@foreach(\App\Models\PropertyAsset::CONDITIONS as $conditionOption)<option value="{{ $conditionOption }}" @selected($asset->condition === $conditionOption)>{{ str_replace('_', ' ', ucfirst($conditionOption)) }}</option>@endforeach</select>
                                    <select class="portal-field w-full" name="status" aria-label="Status" required>@foreach(\App\Models\PropertyAsset::STATUSES as $statusOption)<option value="{{ $statusOption }}" @selected($asset->status === $statusOption)>{{ ucfirst($statusOption) }}</option>@endforeach</select>
                                    <input class="portal-field w-full" name="assigned_to" value="{{ $asset->assigned_to }}" aria-label="Assigned to" placeholder="Person or department">
                                    <textarea class="portal-field w-full" name="notes" rows="2" aria-label="Notes" maxlength="2000" placeholder="Notes">{{ $asset->notes }}</textarea>
                                    <button class="portal-button-primary" type="submit">Save changes</button>
                                </form>
                            </details>
                            <form method="POST" action="{{ route('property-custodian.assets.destroy', $asset) }}" class="mt-2" onsubmit="return confirm('Delete this asset from inventory?')">
                                @csrf @method('DELETE')
                                <button class="text-xs font-bold text-red-700" type="submit">Delete</button>
                            </form>
                        </td>
                    </tr>
                @empty
                    <tr><td colspan="6" class="px-5 py-12 text-center text-slate-500">No assets match these filters.</td></tr>
                @endforelse
            </tbody>
        </table>
    </div>
    @if($assets->hasPages())<div class="border-t border-slate-100 p-4">{{ $assets->links() }}</div>@endif
</section>
@endsection
