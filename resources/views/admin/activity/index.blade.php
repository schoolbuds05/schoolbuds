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

    <select name="action" class="rounded-lg border-slate-300 text-sm">
        <option value="">All actions</option>
        @foreach($actions as $availableAction)
            <option value="{{ $availableAction }}" @selected($action === $availableAction)>
                {{ ucwords(str_replace('_', ' ', $availableAction)) }}
            </option>
        @endforeach
    </select>

    <div class="flex gap-2">
        <button class="rounded-lg bg-slate-950 px-5 py-2 text-sm font-bold text-white">Filter</button>
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
                    <th class="px-4 py-3">IP</th>
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
                            @if($log->subject_type || $log->subject_id)
                                <p class="mt-2 text-xs font-semibold text-slate-400">
                                    Subject: {{ class_basename($log->subject_type) ?: 'Unknown' }} #{{ $log->subject_id ?? 'N/A' }}
                                </p>
                            @endif
                        </td>
                        <td class="whitespace-nowrap px-4 py-4 text-xs font-semibold text-slate-500">
                            {{ $log->ip_address ?? 'N/A' }}
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
