@props(['label', 'value', 'tone' => 'slate'])
@php
    $colors = [
        'slate' => ['text' => 'text-violet-700', 'dot' => 'bg-violet-500', 'ring' => 'bg-violet-50'],
        'emerald' => ['text' => 'text-emerald-700', 'dot' => 'bg-emerald-500', 'ring' => 'bg-emerald-50'],
        'blue' => ['text' => 'text-blue-700', 'dot' => 'bg-blue-500', 'ring' => 'bg-blue-50'],
        'red' => ['text' => 'text-rose-600', 'dot' => 'bg-rose-500', 'ring' => 'bg-rose-50'],
    ];
    $color = $colors[$tone] ?? $colors['slate'];
@endphp
<div class="portal-card p-5">
    <div class="flex items-center justify-between gap-3">
        <p class="text-xs font-bold uppercase tracking-wider text-slate-400">{{ $label }}</p>
        <span class="flex h-7 w-7 items-center justify-center rounded-lg {{ $color['ring'] }}">
            <span class="h-2 w-2 rounded-full {{ $color['dot'] }}"></span>
        </span>
    </div>
    <p class="mt-3 text-2xl font-black {{ $color['text'] }}">{{ $value }}</p>
</div>
