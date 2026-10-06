@extends('layouts.portal', ['title' => 'Market'])

@section('content')
<div class="mb-6">
    <h1 class="text-2xl font-black text-slate-900">Market</h1>
    <p class="mt-1 text-sm text-slate-500">Browse approved school marketplace items.</p>
</div>

@if($errors->has('marketplace'))
    <div class="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
        {{ $errors->first('marketplace') }}
    </div>
@endif

<div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
    @forelse($items as $item)
        @php
            $itemImages = collect($item->image_urls ?? [])
                ->filter()
                ->when(empty($item->image_urls) && $item->image, fn ($images) => $images->push($item->image))
                ->values();
        @endphp

        <section class="portal-card overflow-hidden">
            <button type="button" class="block h-32 w-full bg-slate-100 text-left" data-market-modal-open="market-modal-{{ $item->id }}">
                @if($itemImages->isNotEmpty())
                    <img src="{{ $itemImages->first() }}" alt="{{ $item->title }}" class="h-full w-full object-cover">
                @else
                    <div class="flex h-full w-full items-center justify-center text-sm font-bold text-slate-400">No image</div>
                @endif
            </button>

            <div class="p-4">
                <div class="flex items-start justify-between gap-3">
                    <div>
                        <button type="button" class="text-left text-sm font-black text-slate-900 hover:text-violet-700" data-market-modal-open="market-modal-{{ $item->id }}">
                            {{ $item->title }}
                        </button>
                        <p class="mt-1 text-xs font-bold uppercase text-slate-400">{{ ucfirst(str_replace('_', ' ', $item->category)) }} - {{ ucfirst(str_replace('_', ' ', $item->condition)) }}</p>
                        @if(!empty($item->size_options))
                            <p class="mt-1 text-xs font-semibold text-slate-500">Sizes: {{ collect($item->size_options)->join(', ') }}</p>
                        @endif
                    </div>
                    <span class="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-700">Stock {{ $item->stock }}</span>
                </div>

                <p class="mt-2 line-clamp-2 text-xs leading-5 text-slate-600">{{ $item->description }}</p>
                <p class="mt-3 text-lg font-black text-violet-700">PHP {{ number_format((float) $item->price, 2) }}</p>
                <p class="mt-1 text-xs text-slate-500">Seller: {{ $item->seller?->name ?? 'School' }}</p>

                @if($itemImages->count() > 1)
                    <div class="mt-3 grid grid-cols-3 gap-2">
                        @foreach($itemImages->take(3) as $image)
                            <div class="h-12 overflow-hidden rounded-lg bg-slate-100">
                                <img src="{{ $image }}" alt="{{ $item->title }} photo {{ $loop->iteration }}" class="h-full w-full object-cover">
                            </div>
                        @endforeach
                    </div>
                @endif

                @if($item->status === 'available' && $item->stock > 0 && $item->user_id !== auth()->id())
                    <form method="POST" action="{{ route('teacher.market.buy', $item) }}" class="mt-4 space-y-2">
                        @csrf
                        <div class="grid grid-cols-[72px_1fr] gap-2">
                            <input name="quantity" type="number" min="1" max="{{ $item->stock }}" value="1" class="portal-field h-10 text-sm">
                            <select name="payment_method" class="portal-field h-10 text-sm" data-payment-method>
                                @if($item->accepts_cash)
                                    <option value="cash">Cash</option>
                                @endif
                                @if($item->accepts_gcash)
                                    <option value="gcash">GCash</option>
                                @endif
                                @if($item->accepts_qrph)
                                    <option value="qrph">QRPH</option>
                                @endif
                            </select>
                        </div>
                        @if(!empty($item->size_options))
                            <select name="size" class="portal-field h-10 w-full text-sm" required>
                                <option value="">Choose size</option>
                                @foreach($item->size_options as $size)
                                    <option value="{{ $size }}">{{ $size }}</option>
                                @endforeach
                            </select>
                        @endif
                        <input name="gcash_reference" class="portal-field hidden h-10 w-full text-sm" placeholder="Payment reference" data-payment-reference>
                        <button type="submit" class="w-full rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white hover:bg-emerald-700">
                            Checkout
                        </button>
                    </form>
                @elseif($item->user_id === auth()->id())
                    <p class="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-center text-xs font-bold text-slate-500">Your listing</p>
                @else
                    <p class="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-center text-xs font-bold text-slate-500">Unavailable</p>
                @endif
            </div>
        </section>

        <div id="market-modal-{{ $item->id }}" class="fixed inset-0 z-50 hidden items-end bg-slate-950/50 p-4 backdrop-blur-sm sm:items-center sm:justify-center" data-market-modal>
            <div class="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
                <div class="grid max-h-[90vh] overflow-y-auto lg:grid-cols-[1.1fr_0.9fr]">
                    <div class="bg-slate-100">
                        @if($itemImages->isNotEmpty())
                            <img src="{{ $itemImages->first() }}" alt="{{ $item->title }}" class="h-72 w-full object-cover lg:h-full">
                        @else
                            <div class="flex h-72 items-center justify-center text-sm font-bold text-slate-400">No image</div>
                        @endif

                        @if($itemImages->count() > 1)
                            <div class="grid grid-cols-3 gap-2 bg-white p-3">
                                @foreach($itemImages->take(3) as $image)
                                    <div class="h-20 overflow-hidden rounded-lg bg-slate-100">
                                        <img src="{{ $image }}" alt="{{ $item->title }} photo {{ $loop->iteration }}" class="h-full w-full object-cover">
                                    </div>
                                @endforeach
                            </div>
                        @endif
                    </div>

                    <div class="p-5">
                        <div class="flex items-start justify-between gap-4">
                            <div>
                                <p class="text-xs font-black uppercase tracking-[0.22em] text-violet-500">Item details</p>
                                <h2 class="mt-2 text-xl font-black text-slate-950">{{ $item->title }}</h2>
                                <p class="mt-1 text-xs font-bold uppercase text-slate-400">{{ ucfirst(str_replace('_', ' ', $item->category)) }} - {{ ucfirst(str_replace('_', ' ', $item->condition)) }}</p>
                            </div>
                            <button type="button" class="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-50" data-market-modal-close>
                                Close
                            </button>
                        </div>

                        <p class="mt-4 text-2xl font-black text-violet-700">PHP {{ number_format((float) $item->price, 2) }}</p>
                        <p class="mt-1 text-xs font-bold text-slate-500">Stock {{ $item->stock }} - Seller: {{ $item->seller?->name ?? 'School' }}</p>
                        @if(!empty($item->size_options))
                            <div class="mt-3">
                                <p class="text-xs font-black uppercase text-slate-400">Available sizes</p>
                                <div class="mt-2 flex flex-wrap gap-2">
                                    @foreach($item->size_options as $size)
                                        <span class="rounded-full bg-violet-50 px-3 py-1 text-xs font-black text-violet-700">{{ $size }}</span>
                                    @endforeach
                                </div>
                            </div>
                        @endif

                        <div class="mt-5 space-y-4">
                            <div>
                                <p class="text-xs font-black uppercase text-slate-400">Description</p>
                                <p class="mt-2 text-sm leading-6 text-slate-600">{{ $item->description ?: 'No description provided.' }}</p>
                            </div>

                            <div>
                                <p class="text-xs font-black uppercase text-slate-400">Payment options</p>
                                <div class="mt-2 flex flex-wrap gap-2">
                                    @if($item->accepts_cash)
                                        <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">Cash</span>
                                    @endif
                                    @if($item->accepts_gcash)
                                        <span class="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">GCash</span>
                                    @endif
                                    @if($item->accepts_qrph)
                                        <span class="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">QRPH</span>
                                    @endif
                                </div>
                            </div>

                            @if($item->location)
                                <div>
                                    <p class="text-xs font-black uppercase text-slate-400">Location</p>
                                    <p class="mt-2 text-sm font-semibold text-slate-600">{{ $item->location }}</p>
                                </div>
                            @endif

                            @if($item->pickup_instructions)
                                <div>
                                    <p class="text-xs font-black uppercase text-slate-400">Pickup instructions</p>
                                    <p class="mt-2 text-sm leading-6 text-slate-600">{{ $item->pickup_instructions }}</p>
                                </div>
                            @endif
                        </div>
                    </div>
                </div>
            </div>
        </div>
    @empty
        <section class="portal-card p-10 text-center text-sm text-slate-500 md:col-span-2 xl:col-span-3">
            No marketplace items available.
        </section>
    @endforelse
</div>

<div class="mt-5">{{ $items->links() }}</div>

<script>
    document.querySelectorAll('[data-payment-method]').forEach((select) => {
        const form = select.closest('form');
        const reference = form?.querySelector('[data-payment-reference]');
        const syncReference = () => {
            const needsReference = ['gcash', 'qrph'].includes(select.value);
            reference?.classList.toggle('hidden', !needsReference);
            if (reference) {
                reference.required = needsReference;
            }
        };

        select.addEventListener('change', syncReference);
        syncReference();
    });

    document.addEventListener('click', (event) => {
        const openButton = event.target.closest('[data-market-modal-open]');
        const closeButton = event.target.closest('[data-market-modal-close]');
        const backdrop = event.target.matches('[data-market-modal]') ? event.target : null;

        if (openButton) {
            const modal = document.getElementById(openButton.dataset.marketModalOpen);
            modal?.classList.remove('hidden');
            modal?.classList.add('flex');
        }

        if (closeButton || backdrop) {
            const modal = closeButton?.closest('[data-market-modal]') || backdrop;
            modal?.classList.add('hidden');
            modal?.classList.remove('flex');
        }
    });
</script>
@endsection
