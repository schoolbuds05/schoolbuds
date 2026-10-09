@extends('layouts.portal', ['title' => 'Activity Logs'])

@section('content')
<div class="mb-6">
    <h1 class="text-2xl font-black text-slate-900">Activity Logs</h1>
    <p class="mt-1 text-sm text-slate-500">Review portal and mobile account activity across the school system.</p>
</div>

<form method="GET" class="mb-5 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-[1fr_220px_auto]">
    <input
        name="search"
        value="{{ $search }}"
        placeholder="Search actor, action, description, or IP"
        class="rounded-lg border-slate-300 text-sm"
    >

    <label class="relative block">
        <span class="sr-only">Filter by action</span>
        <select name="action" class="w-full appearance-none rounded-lg border-slate-300 bg-white py-2 pl-3 pr-10 text-sm text-slate-700 shadow-sm transition focus:border-rose-400 focus:ring-rose-200">
            <option value="">All actions</option>
            @foreach($actions as $availableAction)
                <option value="{{ $availableAction }}" @selected($action === $availableAction)>
                    {{ ucwords(str_replace('_', ' ', $availableAction)) }}
                </option>
            @endforeach
        </select>
        <svg aria-hidden="true" class="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M5.22 7.47a.75.75 0 0 1 1.06 0L10 11.19l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 8.53a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd"/>
        </svg>
    </label>

    <div class="flex gap-2">
        <button class="portal-filter-button rounded-lg bg-slate-950 px-5 py-2 text-sm font-bold text-white">Filter</button>
        @if($search !== '' || $action !== '')
            <a href="{{ route('admin.activity.index') }}" class="rounded-lg border border-slate-200 px-5 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50">
                Clear
            </a>
        @endif
    </div>
</form>

<section class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
    <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-100 text-left text-sm">
            <thead class="bg-slate-50 text-xs font-black uppercase text-slate-500">
                <tr>
                    <th class="px-4 py-3">Time</th>
                    <th class="px-4 py-3">Actor</th>
                    <th class="px-4 py-3">Action</th>
                    <th class="px-4 py-3">Description</th>
                    <th class="px-4 py-3">Request</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
                @forelse($logs as $log)
                    <tr class="align-top">
                        <td class="whitespace-nowrap px-4 py-4 text-xs font-semibold text-slate-500">
                            {{ $log->created_at?->format('Y-m-d H:i') }}
                        </td>
                        <td class="px-4 py-4">
                            <p class="font-bold text-slate-900">{{ $log->actor_name ?? 'System' }}</p>
                            <p class="mt-0.5 text-xs text-slate-500">{{ $log->actor_email ?? 'No email' }}</p>
                            @if($log->actor_role)
                                <p class="mt-1 text-xs font-bold uppercase text-slate-400">{{ str_replace('_', ' ', $log->actor_role) }}</p>
                            @endif
                        </td>
                        <td class="px-4 py-4">
                            <span class="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
                                {{ ucwords(str_replace('_', ' ', $log->action)) }}
                            </span>
                        </td>
                        <td class="max-w-xl px-4 py-4 text-slate-700">
                            <p>{{ $log->description }}</p>
                            @if(is_array($log->meta) && isset($log->meta['changes']) && is_array($log->meta['changes']))
                                <button
                                    type="button"
                                    onclick="document.getElementById('audit-changes-{{ $log->id }}').showModal()"
                                    class="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 transition hover:text-rose-700"
                                >
                                    View changes <span class="rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px]">{{ count($log->meta['changes']) }}</span>
                                </button>
                                <dialog id="audit-changes-{{ $log->id }}" class="m-auto max-h-[85vh] w-[calc(100%-2rem)] max-w-2xl overflow-hidden rounded-xl p-0 shadow-2xl backdrop:bg-slate-950/50">
                                    <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                                        <div>
                                            <h2 class="font-black text-slate-900">Changed data</h2>
                                            <p class="mt-0.5 text-xs text-slate-500">{{ $log->description }}</p>
                                        </div>
                                        <form method="dialog">
                                            <button aria-label="Close" class="rounded-lg px-3 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100">Close</button>
                                        </form>
                                    </div>
                                    <dl class="max-h-[65vh] divide-y divide-slate-100 overflow-y-auto px-5">
                                        @foreach($log->meta['changes'] as $field => $change)
                                            <div class="grid gap-3 py-3 sm:grid-cols-[8rem_minmax(0,1fr)_minmax(0,1fr)] sm:items-start">
                                                <dt class="pt-4 font-bold capitalize text-slate-700">{{ str_replace('_', ' ', $field) }}</dt>
                                                <dd class="min-w-0 break-words rounded-lg bg-slate-50 p-3 text-slate-500">
                                                    <span class="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Before</span>
                                                    {{ json_encode($change['old'] ?? null, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: 'null' }}
                                                </dd>
                                                <dd class="min-w-0 break-words rounded-lg bg-rose-50 p-3 text-slate-700">
                                                    <span class="mb-1 block text-[10px] font-bold uppercase tracking-wide text-rose-500">After</span>
                                                    {{ json_encode($change['new'] ?? null, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: 'null' }}
                                                </dd>
                                            </div>
                                        @endforeach
                                    </dl>
                                </dialog>
                            @elseif(is_array($log->meta) && isset($log->meta['relation']))
                                <button
                                    type="button"
                                    onclick="document.getElementById('audit-relation-{{ $log->id }}').showModal()"
                                    class="mt-2 inline-flex text-xs font-bold text-rose-600 transition hover:text-rose-700"
                                >
                                    View {{ ucwords(str_replace('_', ' ', $log->meta['relation'])) }} relationship
                                </button>
                                <dialog id="audit-relation-{{ $log->id }}" class="m-auto w-[calc(100%-2rem)] max-w-xl overflow-hidden rounded-xl p-0 shadow-2xl backdrop:bg-slate-950/50">
                                    <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                                        <div>
                                            <h2 class="font-black text-slate-900">{{ ucwords(str_replace('_', ' ', $log->meta['relation'])) }} relationship</h2>
                                            <p class="mt-0.5 text-xs text-slate-500">{{ $log->description }}</p>
                                        </div>
                                        <form method="dialog">
                                            <button aria-label="Close" class="rounded-lg px-3 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100">Close</button>
                                        </form>
                                    </div>
                                    <div class="grid gap-3 p-5 text-xs sm:grid-cols-2">
                                        <p class="min-w-0 break-words rounded-lg bg-slate-50 p-3 text-slate-500">
                                            <span class="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Before</span>
                                            {{ json_encode($log->meta['old'] ?? [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) }}
                                        </p>
                                        <p class="min-w-0 break-words rounded-lg bg-rose-50 p-3 text-slate-700">
                                            <span class="mb-1 block text-[10px] font-bold uppercase tracking-wide text-rose-500">After</span>
                                            {{ json_encode($log->meta['new'] ?? [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) }}
                                        </p>
                                    </div>
                                </dialog>
                            @endif
                            @if($log->subject_type || $log->subject_id)
                                <p class="mt-2 text-xs font-semibold text-slate-400">
                                    Subject: {{ class_basename($log->subject_type) ?: 'Unknown' }} #{{ $log->subject_id ?? 'N/A' }}
                                </p>
                            @endif
                        </td>
                        <td class="whitespace-nowrap px-4 py-4 text-xs font-semibold text-slate-500">
                            {{ $log->ip_address ?? 'N/A' }}
                            @if($log->user_agent)
                                <p class="mt-1 max-w-xs whitespace-normal break-all font-normal text-slate-400" title="{{ $log->user_agent }}">{{ $log->user_agent }}</p>
                            @endif
                        </td>
                    </tr>
                @empty
                    <tr>
                        <td colspan="5" class="px-4 py-10 text-center text-sm font-semibold text-slate-500">
                            No activity logs found.
                        </td>
                    </tr>
                @endforelse
            </tbody>
        </table>
    </div>

    <div class="border-t border-slate-100 p-4">
        {{ $logs->links() }}
    </div>
</section>
@endsection
