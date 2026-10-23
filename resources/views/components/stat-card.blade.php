@props(['label', 'value', 'tone' => 'slate', 'href' => null])
@php
    $colors = [
        'slate' => ['text' => 'text-violet-700', 'dot' => 'bg-violet-500', 'ring' => 'bg-violet-50'],
        'emerald' => ['text' => 'text-emerald-700', 'dot' => 'bg-emerald-500', 'ring' => 'bg-emerald-50'],
        'accent' => ['text' => 'text-portal-accent', 'dot' => 'bg-portal-accent', 'ring' => 'bg-portal-accent-soft'],
        'red' => ['text' => 'text-rose-600', 'dot' => 'bg-rose-500', 'ring' => 'bg-rose-50'],
    ];
    $color = $colors[$tone] ?? $colors['slate'];
@endphp
@if($href)
<a href="{{ $href }}" class="portal-card block p-5 transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-portal-accent focus:ring-offset-2">
@else
<div class="portal-card p-5">
@endif
    <div class="flex items-center justify-between gap-3">
        <p class="text-xs font-bold uppercase tracking-wider text-slate-400">{{ $label }}</p>
        <span class="flex h-7 w-7 items-center justify-center rounded-lg {{ $color['ring'] }}">
            <span class="h-2 w-2 rounded-full {{ $color['dot'] }}"></span>
        </span>
    </div>
    <p class="mt-3 text-2xl font-black {{ $color['text'] }}">{{ $value }}</p>
@if($href)
</a>
@else
</div>
@endif
