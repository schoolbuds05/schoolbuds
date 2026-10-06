@props(['title', 'rows'])

<div class="rounded-2xl border border-violet-100 bg-white p-5 shadow-sm print:border-slate-200 print:shadow-none">
    <h2 class="text-base font-black text-slate-900">{{ $title }}</h2>
    <div class="mt-3 divide-y divide-slate-100">
        @forelse($rows as $row)
            <div class="flex items-center justify-between gap-4 py-3">
                <p class="text-sm font-bold text-slate-600">{{ ucwords(str_replace('_', ' ', (string) $row->label)) }}</p>
                <p class="text-sm font-black text-slate-900">{{ number_format($row->total) }}</p>
            </div>
        @empty
            <p class="py-4 text-sm font-semibold text-slate-500">No data available.</p>
        @endforelse
    </div>
</div>
