@extends('layouts.portal', ['title' => 'Archive'])

@section('content')
<div class="mb-6">
    <h1 class="text-2xl font-black text-slate-900">Archive</h1>
    <p class="mt-1 text-sm text-slate-500">Deleted records are saved here for review and audit history.</p>
</div>

<form method="GET" class="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-[1fr_180px_auto]">
    <input name="search" value="{{ request('search') }}" placeholder="Search archive" class="rounded-lg border-slate-300 text-sm">
    <select name="record_type" class="rounded-lg border-slate-300 text-sm">
        <option value="">All types</option>
        @foreach($recordTypes as $type)
            <option value="{{ $type }}" @selected(request('record_type') === $type)>{{ $type }}</option>
        @endforeach
    </select>
    <button class="rounded-lg bg-slate-900 px-5 py-2 text-sm font-bold text-white">Filter</button>
</form>

<div class="space-y-3">
    @forelse($archives as $archive)
        <details class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <summary class="cursor-pointer list-none">
                <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                        <p class="text-xs font-black uppercase tracking-wide text-slate-400">{{ $archive->record_type }} #{{ $archive->record_id }}</p>
                        <h2 class="mt-1 text-base font-black text-slate-900">{{ $archive->label ?: 'Archived record' }}</h2>
                        <p class="mt-1 text-sm text-slate-500">
                            Deleted {{ $archive->deleted_at?->format('M d, Y h:i A') }}
                            @if($archive->deletedBy)
                                by {{ $archive->deletedBy->name }}
                            @endif
                            @if($archive->source)
                                | {{ $archive->source }}
                            @endif
                        </p>
                    </div>
                    <div class="flex items-center gap-2">
                        @if($archive->restored_at)
                            <span class="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">
                                Restored {{ $archive->restored_at->format('M d, Y') }}
                            </span>
                        @else
                            <form method="POST" action="{{ route('admin.archive.restore', $archive) }}">
                                @csrf
                                <button
                                    class="rounded-full bg-blue-600 px-3 py-1 text-xs font-black text-white hover:bg-blue-700"
                                    onclick="return confirm('Restore {{ addslashes($archive->label ?: $archive->record_type) }}?');"
                                >
                                    Restore
                                </button>
                            </form>
                        @endif
                        <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">View snapshot</span>
                    </div>
                </div>
            </summary>
            @if($archive->restored_at && $archive->restoredBy)
                <p class="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
                    Restored by {{ $archive->restoredBy->name }} on {{ $archive->restored_at->format('M d, Y h:i A') }}.
                </p>
            @endif
            <pre class="mt-4 max-h-96 overflow-auto rounded-lg bg-slate-950 p-4 text-xs leading-5 text-slate-100">{{ json_encode($archive->payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) }}</pre>
        </details>
    @empty
        <div class="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm font-semibold text-slate-500">
            No archived records yet.
        </div>
    @endforelse

    <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">{{ $archives->links() }}</div>
</div>
@endsection
