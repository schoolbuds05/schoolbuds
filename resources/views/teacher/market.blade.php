@extends('layouts.portal', ['title' => 'Market'])

@section('content')
<div class="mb-6 rounded-2xl bg-gradient-to-r from-rose-600 to-orange-500 px-5 py-6 text-white shadow-sm sm:px-7">
    <p class="text-xs font-black uppercase tracking-[0.2em] text-white/75">SchoolBuds</p>
    <h1 class="mt-1 text-2xl font-black sm:text-3xl">Campus marketplace</h1>
    <p class="mt-1 text-sm text-white/85">Find books, uniforms, and useful items from your school community.</p>
</div>

@if($errors->has('marketplace'))
    <div class="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
        {{ $errors->first('marketplace') }}
    </div>
@endif

@if(session('status'))
    <div class="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
        {{ session('status') }}
    </div>
@endif

<nav class="mb-5 flex gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm" aria-label="Marketplace sections">
    <a href="{{ route('teacher.market', array_filter(['search' => $search, 'category' => $category])) }}"
       class="rounded-xl px-4 py-2.5 text-sm font-black transition {{ $view === 'browse' ? 'bg-portal-accent text-white' : 'text-slate-600 hover:bg-slate-50' }}">
        Browse items
    </a>
    <a href="{{ route('teacher.market', ['view' => 'orders']) }}"
       class="rounded-xl px-4 py-2.5 text-sm font-black transition {{ $view === 'orders' ? 'bg-portal-accent text-white' : 'text-slate-600 hover:bg-slate-50' }}">
        My orders
    </a>
</nav>

@if($view === 'orders')
    <div class="mb-3 flex items-center justify-between">
        <div>
            <h2 class="text-lg font-black text-slate-900">My orders</h2>
            <p class="mt-1 text-sm text-slate-500">Payment status and where to collect each item.</p>
        </div>
        <span class="text-xs font-semibold text-slate-500">{{ $orders->total() }} orders</span>
    </div>

    <div class="space-y-3">
        @forelse($orders as $order)
            @php
                $orderItem = $order->item;
                $isDigitalPayment = in_array($order->payment_method, ['gcash', 'qrph'], true);
                $statusLabel = match ($order->status) {
                    'pending_verification' => 'Awaiting payment verification',
                    'paid' => 'Payment verified',
                    'completed' => 'Received',
                    'cancelled' => 'Cancelled',
                    'refunded' => 'Refunded',
                    default => 'Reserved - pay at pickup',
                };
                $statusClasses = in_array($order->status, ['cancelled', 'refunded'], true)
                    ? 'bg-slate-100 text-slate-600'
                    : (in_array($order->status, ['paid', 'completed'], true)
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800');
            @endphp
            <article class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div class="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <p class="text-xs font-black uppercase tracking-wide text-slate-400">Order #{{ str_pad((string) $order->id, 6, '0', STR_PAD_LEFT) }}</p>
                        <h3 class="mt-1 text-base font-black text-slate-900">{{ $orderItem?->title ?? 'Marketplace item' }}</h3>
                        <p class="mt-1 text-sm text-slate-500">Seller: {{ $order->seller?->name ?? $orderItem?->seller?->name ?? 'School Marketplace' }}</p>
                    </div>
                    <span class="rounded-full px-3 py-1.5 text-xs font-black {{ $statusClasses }}">{{ $statusLabel }}</span>
                </div>

                <div class="mt-4 grid gap-3 sm:grid-cols-3">
                    <div class="rounded-xl bg-slate-50 p-3">
                        <p class="text-xs font-bold text-slate-500">Payment</p>
                        <p class="mt-1 text-sm font-black text-slate-800">{{ strtoupper($order->payment_method) }} · ₱{{ number_format((float) $order->total_amount, 2) }}</p>
                        @if($isDigitalPayment && $order->gcash_reference)
                            <p class="mt-1 break-all text-xs text-slate-600">Reference: {{ $order->gcash_reference }}</p>
                        @elseif($isDigitalPayment)
                            <p class="mt-1 text-xs text-amber-700">Payment reference submitted; awaiting verification.</p>
                        @else
                            <p class="mt-1 text-xs text-slate-600">Pay in cash when you collect the item.</p>
                        @endif
                        @if($orderItem && $order->payment_method === 'gcash' && ($orderItem->gcash_name || $orderItem->gcash_number))
                            <p class="mt-2 text-xs text-slate-700">
                                Send to {{ $orderItem->gcash_name ?: 'GCash' }}{{ $orderItem->gcash_number ? ' · '.$orderItem->gcash_number : '' }}.
                            </p>
                        @elseif($orderItem && $order->payment_method === 'qrph' && $orderItem->qrph_image_url)
                            @php
                                $qrphUrl = $orderItem->qrph_image_url;
                                if (!str_starts_with($qrphUrl, 'http')) {
                                    $qrphUrl = asset(ltrim($qrphUrl, '/'));
                                }
                            @endphp
                            <img src="{{ $qrphUrl }}" alt="QRPH payment code for {{ $orderItem->title }}" class="mt-2 h-28 w-28 rounded-lg border border-slate-200 bg-white object-contain">
                            <p class="mt-1 text-xs text-slate-600">Scan this QR code to pay.</p>
                        @endif
                    </div>
                    <div class="rounded-xl bg-slate-50 p-3">
                        <p class="text-xs font-bold text-slate-500">Order details</p>
                        <p class="mt-1 text-sm font-black text-slate-800">Quantity: {{ $order->quantity }}{{ $order->size ? ' · Size: '.$order->size : '' }}</p>
                        <p class="mt-1 text-xs text-slate-600">Placed {{ $order->created_at?->format('M j, Y g:i A') }}</p>
                    </div>
                    <div class="rounded-xl bg-rose-50 p-3">
                        <p class="text-xs font-bold text-rose-700">{{ $isDigitalPayment ? 'Pickup after payment verification' : 'Pickup instructions' }}</p>
                        <p class="mt-1 text-sm leading-5 text-slate-700">{{ $orderItem?->pickup_instructions ?: 'Pay and claim this item at the Property Custodian Office. Bring your student ID and order number.' }}</p>
                        @if($orderItem?->location)
                            <p class="mt-2 text-xs font-bold text-slate-600">Location: {{ $orderItem->location }}</p>
                        @endif
                    </div>
                </div>
            </article>
        @empty
            <section class="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
                <p class="text-base font-black text-slate-800">No orders yet</p>
                <p class="mt-1 text-sm text-slate-500">Your marketplace purchases and pickup details will appear here.</p>
                <a href="{{ route('teacher.market') }}" class="mt-4 inline-flex rounded-xl bg-portal-accent px-5 py-2.5 text-sm font-black text-white hover:bg-portal-accent-hover">Browse items</a>
            </section>
        @endforelse
    </div>

    <div class="mt-5">{{ $orders->links() }}</div>
@else
<section class="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <form method="GET" action="{{ route('teacher.market') }}" class="flex flex-col gap-3 sm:flex-row">
        <label class="relative min-w-0 flex-1">
            <span class="sr-only">Search marketplace</span>
            <input name="search" value="{{ $search }}" placeholder="Search items..." class="w-full rounded-xl border-slate-200 bg-slate-50 py-3 pl-4 pr-4 text-sm focus:border-rose-400 focus:ring-rose-200">
        </label>
        <input type="hidden" name="category" value="{{ $category }}">
        <button class="rounded-xl bg-portal-accent px-6 py-3 text-sm font-black text-white transition hover:bg-portal-accent-hover">Search</button>
        @if($search !== '' || $category !== '')
            <a href="{{ route('teacher.market') }}" class="rounded-xl border border-slate-200 px-5 py-3 text-center text-sm font-bold text-slate-600 transition hover:bg-slate-50">Clear</a>
        @endif
    </form>

    <div class="mt-4 flex gap-2 overflow-x-auto pb-1">
        <a href="{{ route('teacher.market', array_filter(['search' => $search])) }}" class="whitespace-nowrap rounded-full px-4 py-2 text-xs font-black transition {{ $category === '' ? 'bg-portal-accent text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200' }}">All items</a>
        @foreach($categories as $marketCategory)
            <a href="{{ route('teacher.market', array_filter(['search' => $search, 'category' => $marketCategory])) }}" class="whitespace-nowrap rounded-full px-4 py-2 text-xs font-black transition {{ $category === $marketCategory ? 'bg-portal-accent text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200' }}">
                {{ ucfirst($marketCategory) }}
            </a>
        @endforeach
    </div>
</section>

<div class="mb-3 flex items-center justify-between">
    <h2 class="text-sm font-black text-slate-800">{{ $category ? ucfirst($category) : 'Recommended for you' }}</h2>
    <span class="text-xs font-semibold text-slate-500">{{ $items->total() }} items</span>
</div>

<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
    @forelse($items as $item)
        @php
            $itemImages = collect($item->image_urls ?? [])
                ->filter()
                ->when(empty($item->image_urls) && $item->image, fn ($images) => $images->push($item->image))
                ->values();
        @endphp

        <section class="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg">
            <button type="button" class="relative block aspect-square w-full overflow-hidden bg-slate-100 text-left" data-market-modal-open="market-modal-{{ $item->id }}">
                @if($itemImages->isNotEmpty())
                    <img src="{{ $itemImages->first() }}" alt="{{ $item->title }}" loading="lazy" class="h-full w-full object-contain p-2 transition duration-300">
                @else
                    <div class="flex h-full w-full items-center justify-center text-4xl text-slate-300">📦</div>
                @endif
                <span class="absolute left-2 top-2 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-slate-600 shadow-sm">{{ ucfirst($item->category) }}</span>
                @if($itemImages->count() > 1)
                    <span class="absolute bottom-2 right-2 rounded-full bg-slate-950/75 px-2 py-1 text-[10px] font-bold text-white">{{ $itemImages->count() }} photos</span>
                @endif
            </button>

            <div class="p-3 sm:p-4">
                <button type="button" class="line-clamp-2 min-h-10 text-left text-sm font-bold leading-5 text-slate-800 transition hover:text-rose-600" data-market-modal-open="market-modal-{{ $item->id }}">
                    {{ $item->title }}
                </button>
                <p class="mt-1 text-xs text-slate-500">{{ ucfirst(str_replace('_', ' ', $item->condition)) }}@if(!empty($item->size_options)) <span aria-hidden="true">·</span> {{ collect($item->size_options)->join(', ') }}@endif</p>
                <p class="mt-3 text-lg font-black text-rose-600">₱{{ number_format((float) $item->price, 2) }}</p>
                <div class="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                    <span class="truncate">{{ $item->seller?->name ?? 'School' }}</span>
                    <span class="shrink-0">Stock {{ $item->stock }}</span>
                </div>

                @if($item->status === 'available' && $item->stock > 0 && $item->user_id !== auth()->id())
                    <button type="button" class="mt-3 w-full rounded-xl bg-portal-accent px-3 py-2.5 text-xs font-black text-white transition hover:bg-portal-accent-hover" data-market-modal-open="market-modal-{{ $item->id }}">
                        View item
                    </button>
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
                            <div class="relative flex h-[min(55vh,28rem)] items-center justify-center bg-slate-950 lg:h-[min(68vh,38rem)]" data-market-gallery>
                                <img src="{{ $itemImages->first() }}" alt="{{ $item->title }} photo 1" class="h-full w-full object-contain" data-market-gallery-main>
                                @if($itemImages->count() > 1)
                                    <button type="button" class="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-slate-950/70 px-3 py-2 text-lg font-black text-white hover:bg-slate-950" aria-label="Previous photo" data-market-gallery-prev>‹</button>
                                    <button type="button" class="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-slate-950/70 px-3 py-2 text-lg font-black text-white hover:bg-slate-950" aria-label="Next photo" data-market-gallery-next>›</button>
                                    <span class="absolute bottom-3 right-3 rounded-full bg-slate-950/75 px-2.5 py-1 text-xs font-bold text-white" data-market-gallery-count>1 / {{ $itemImages->count() }}</span>
                                @endif
                            </div>
                        @else
                            <div class="flex h-72 items-center justify-center text-sm font-bold text-slate-400">No image</div>
                        @endif

                        @if($itemImages->count() > 1)
                            <div class="flex gap-2 overflow-x-auto bg-white p-3">
                                @foreach($itemImages as $image)
                                    <button type="button" class="h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 bg-slate-950 {{ $loop->first ? 'border-rose-500' : 'border-slate-200' }}" aria-label="Show photo {{ $loop->iteration }}" aria-pressed="{{ $loop->first ? 'true' : 'false' }}" data-market-gallery-thumb data-market-gallery-index="{{ $loop->index }}" data-market-gallery-src="{{ $image }}">
                                        <img src="{{ $image }}" alt="" class="h-full w-full object-contain">
                                    </button>
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
                                        <span class="rounded-full bg-portal-accent-soft px-3 py-1 text-xs font-black text-portal-accent">GCash</span>
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

                            @if($item->status === 'available' && $item->stock > 0 && $item->user_id !== auth()->id())
                                <form method="POST" action="{{ route('teacher.market.buy', $item) }}" class="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                                    @csrf
                                    <p class="text-sm font-black text-slate-800">Checkout</p>
                                    <div class="grid grid-cols-2 gap-2">
                                        <label class="text-xs font-bold text-slate-500">
                                            Quantity
                                            <input name="quantity" type="number" min="1" max="{{ $item->stock }}" value="1" class="portal-field mt-1 h-10 w-full text-sm" required>
                                        </label>
                                        <label class="text-xs font-bold text-slate-500">
                                            Payment
                                            <select name="payment_method" class="portal-field mt-1 h-10 w-full text-sm" data-payment-method>
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
                                        </label>
                                    </div>
                                    <div class="hidden rounded-lg border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-600" data-payment-instructions="cash">
                                        Pay the seller in cash when you collect the item.
                                    </div>
                                    @if($item->accepts_gcash)
                                        <div class="hidden rounded-lg border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-600" data-payment-instructions="gcash">
                                            <p class="font-black text-slate-800">Send payment by GCash</p>
                                            <p class="mt-1">{{ $item->gcash_name ?: 'Account name not provided' }}{{ $item->gcash_number ? ' · '.$item->gcash_number : '' }}</p>
                                        </div>
                                    @endif
                                    @if($item->accepts_qrph && $item->qrph_image_url)
                                        @php
                                            $qrphUrl = $item->qrph_image_url;
                                            if (!str_starts_with($qrphUrl, 'http')) {
                                                $qrphUrl = asset(ltrim($qrphUrl, '/'));
                                            }
                                        @endphp
                                        <div class="hidden rounded-lg border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-600" data-payment-instructions="qrph">
                                            <p class="font-black text-slate-800">Scan to pay with QRPH</p>
                                            <img src="{{ $qrphUrl }}" alt="QRPH payment code for {{ $item->title }}" class="mt-2 h-36 w-36 rounded-lg border border-slate-200 object-contain">
                                        </div>
                                    @endif
                                    @if(!empty($item->size_options))
                                        <label class="block text-xs font-bold text-slate-500">
                                            Size
                                            <select name="size" class="portal-field mt-1 h-10 w-full text-sm" required>
                                                <option value="">Choose size</option>
                                                @foreach($item->size_options as $size)
                                                    <option value="{{ $size }}">{{ $size }}</option>
                                                @endforeach
                                            </select>
                                        </label>
                                    @endif
                                    <input name="gcash_reference" class="portal-field hidden h-10 w-full text-sm" placeholder="Payment reference" data-payment-reference>
                                    <button type="submit" class="flex w-full items-center justify-between gap-3 rounded-xl bg-portal-accent px-4 py-2.5 text-sm font-black text-white transition hover:bg-portal-accent-hover focus:outline-none focus:ring-4 focus:ring-portal-accent">
                                        <span>Buy Now</span>
                                        <span class="rounded-lg bg-white px-3 py-1.5 font-black tabular-nums text-portal-accent">₱{{ number_format((float) $item->price, 2) }}</span>
                                    </button>
                                </form>
                            @endif
                        </div>
                    </div>
                </div>
            </div>
        </div>
    @empty
        <section class="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
            No marketplace items match your search.
        </section>
    @endforelse
</div>

<div class="mt-5">{{ $items->links() }}</div>
@endif

<script>
    document.querySelectorAll('[data-payment-method]').forEach((select) => {
        const form = select.closest('form');
        const reference = form?.querySelector('[data-payment-reference]');
        const instructions = form?.querySelectorAll('[data-payment-instructions]') || [];
        const syncReference = () => {
            const needsReference = ['gcash', 'qrph'].includes(select.value);
            reference?.classList.toggle('hidden', !needsReference);
            if (reference) {
                reference.required = needsReference;
            }
            instructions.forEach((panel) => {
                panel.classList.toggle('hidden', panel.dataset.paymentInstructions !== select.value);
            });
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

        const galleryButton = event.target.closest('[data-market-gallery-prev], [data-market-gallery-next], [data-market-gallery-thumb]');
        if (galleryButton) {
            const modal = galleryButton.closest('[data-market-modal]');
            const gallery = modal?.querySelector('[data-market-gallery]');
            const thumbnails = [...(modal?.querySelectorAll('[data-market-gallery-thumb]') || [])];
            const currentIndex = thumbnails.findIndex((thumbnail) => thumbnail.getAttribute('aria-pressed') === 'true');
            let nextIndex = currentIndex;

            if (galleryButton.matches('[data-market-gallery-thumb]')) {
                nextIndex = Number(galleryButton.dataset.marketGalleryIndex);
            } else if (thumbnails.length > 0) {
                nextIndex = (currentIndex + (galleryButton.matches('[data-market-gallery-next]') ? 1 : -1) + thumbnails.length) % thumbnails.length;
            }

            const selectedThumbnail = thumbnails[nextIndex];
            const mainImage = gallery?.querySelector('[data-market-gallery-main]');
            if (selectedThumbnail && mainImage) {
                mainImage.src = selectedThumbnail.dataset.marketGallerySrc;
                mainImage.alt = `${mainImage.alt.replace(/ photo \d+$/, '')} photo ${nextIndex + 1}`;
                thumbnails.forEach((thumbnail, index) => {
                    const selected = index === nextIndex;
                    thumbnail.setAttribute('aria-pressed', String(selected));
                    thumbnail.classList.toggle('border-rose-500', selected);
                    thumbnail.classList.toggle('border-slate-200', !selected);
                });
                const counter = gallery.querySelector('[data-market-gallery-count]');
                if (counter) {
                    counter.textContent = `${nextIndex + 1} / ${thumbnails.length}`;
                }
            }
        }

        if (closeButton || backdrop) {
            const modal = closeButton?.closest('[data-market-modal]') || backdrop;
            modal?.classList.add('hidden');
            modal?.classList.remove('flex');
        }
    });
</script>
@endsection
