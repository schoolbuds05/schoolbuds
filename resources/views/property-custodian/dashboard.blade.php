@extends('layouts.portal', ['title' => 'Property Custodian Dashboard'])

@section('content')
<x-portal-dashboard-hero
    eyebrow="Staff workspace · {{ now()->format('F j, Y') }}"
    title="Campus resources"
    description="Review inventory availability, assigned equipment, and maintenance needs."
    :action-href="route('property-custodian.market')"
    action-label="Open marketplace"
/>

<div class="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
    <x-stat-card label="Assets" :value="$stats['total']" />
    <x-stat-card label="Available" :value="$stats['available']" tone="emerald" />
    <x-stat-card label="Assigned" :value="$stats['assigned']" tone="blue" />
    <x-stat-card label="Maintenance" :value="$stats['maintenance']" />
    <x-stat-card label="Needs attention" :value="$stats['needs_attention']" tone="red" />
</div>

<section class="portal-card overflow-hidden">
    <div class="border-b border-slate-200 px-5 py-4">
        <h2 class="font-bold text-slate-800">Recent assets</h2>
    </div>

    <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-200 text-sm">
            <thead class="bg-slate-50 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                <tr>
                    <th class="px-5 py-3">Asset</th>
                    <th class="px-5 py-3">Category</th>
                    <th class="px-5 py-3">Location</th>
                    <th class="px-5 py-3">Condition</th>
                    <th class="px-5 py-3">Status</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 bg-white">
                @forelse($assets as $asset)
                    <tr>
                        <td class="px-5 py-4">
                            <p class="font-bold text-slate-900">{{ $asset->name }}</p>
                            <p class="mt-0.5 text-xs text-slate-500">{{ $asset->asset_tag }}</p>
                        </td>
                        <td class="px-5 py-4 text-slate-600">{{ $asset->category ?: 'Uncategorized' }}</td>
                        <td class="px-5 py-4 text-slate-600">{{ $asset->location ?: 'No location' }}</td>
                        <td class="px-5 py-4">
                            <span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                                {{ str_replace('_', ' ', ucfirst($asset->condition)) }}
                            </span>
                        </td>
                        <td class="px-5 py-4">
                            <span class="rounded-full px-2.5 py-1 text-xs font-bold {{ $asset->status === 'available' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700' }}">
                                {{ ucfirst($asset->status) }}
                            </span>
                        </td>
                    </tr>
                @empty
                    <tr>
                        <td colspan="5" class="px-5 py-10 text-center text-sm text-slate-500">No assets recorded yet.</td>
                    </tr>
                @endforelse
            </tbody>
        </table>
    </div>
</section>
@endsection

