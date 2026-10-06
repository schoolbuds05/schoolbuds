<?php

namespace App\Http\Controllers\PropertyCustodian;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\MarketplaceItem;
use App\Models\MarketplaceOrder;
use App\Models\PropertyAsset;
use App\Models\SchoolNotification;
use App\Models\Student;
use App\Models\StudentReward;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

class DashboardController extends Controller
{
    public function index(): View
    {
        $stats = [
            'total' => PropertyAsset::count(),
            'available' => PropertyAsset::where('status', 'available')->count(),
            'assigned' => PropertyAsset::where('status', 'assigned')->count(),
            'maintenance' => PropertyAsset::where('status', 'maintenance')->count(),
            'needs_attention' => PropertyAsset::whereIn('condition', ['needs_repair', 'damaged', 'lost'])->count(),
        ];

        $assets = PropertyAsset::latest()->limit(25)->get();

        return view('property-custodian.dashboard', compact('stats', 'assets'));
    }

    public function market(Request $request): View
    {
        $user = auth()->user();
        $isAdmin = $user->role === 'admin' || $user->hasRole('admin');

        $marketplaceItems = MarketplaceItem::withCount('orders')
            ->when(!$isAdmin, fn ($query) => $query->where('user_id', $user->id))
            ->with('seller')
            ->latest()
            ->limit(12)
            ->get();

        $marketplaceOrders = MarketplaceOrder::with(['item', 'buyer'])
            ->when(!$isAdmin, fn ($query) => $query->where('seller_id', $user->id))
            ->latest()
            ->limit(12)
            ->get();

        $marketplaceStats = [
            'items' => MarketplaceItem::when(!$isAdmin, fn ($query) => $query->where('user_id', $user->id))->count(),
            'available' => MarketplaceItem::when(!$isAdmin, fn ($query) => $query->where('user_id', $user->id))->where('status', 'available')->count(),
            'pending_sales' => MarketplaceOrder::when(!$isAdmin, fn ($query) => $query->where('seller_id', $user->id))->whereIn('status', ['reserved', 'pending_verification'])->count(),
            'paid_sales' => MarketplaceOrder::when(!$isAdmin, fn ($query) => $query->where('seller_id', $user->id))->where('status', 'paid')->count(),
        ];
        $marketplaceScopeLabel = $isAdmin ? 'All' : 'My';

        return view('property-custodian.market', compact(
            'marketplaceItems',
            'marketplaceOrders',
            'marketplaceStats',
            'marketplaceScopeLabel',
        ));
    }

    public function reports(Request $request): View
    {
        $user = auth()->user();
        $isAdmin = $user->role === 'admin' || $user->hasRole('admin');
        $reportYear = (int) $request->query('report_year', now()->year);
        $reportMonth = $request->filled('report_month') ? (int) $request->query('report_month') : null;
        if ($reportYear < 2000 || $reportYear > ((int) now()->year + 1)) {
            $reportYear = now()->year;
        }
        if ($reportMonth !== null && ($reportMonth < 1 || $reportMonth > 12)) {
            $reportMonth = null;
        }
        $reportDateExpression = DB::raw('COALESCE(paid_at, created_at)');
        $reportBaseQuery = MarketplaceOrder::with(['item', 'buyer', 'seller'])
            ->when(!$isAdmin, fn ($query) => $query->where('seller_id', $user->id))
            ->whereIn('status', ['paid', 'completed', 'refunded'])
            ->whereYear($reportDateExpression, $reportYear)
            ->when($reportMonth, fn ($query) => $query->whereMonth($reportDateExpression, $reportMonth));

        $reportOrders = (clone $reportBaseQuery)
            ->latest('paid_at')
            ->latest()
            ->get();
        $incomeOrders = $reportOrders->whereIn('status', ['paid', 'completed']);
        $refundedOrders = $reportOrders->where('status', 'refunded');

        $salesReport = [
            'year' => $reportYear,
            'month' => $reportMonth,
            'orders' => $incomeOrders->count(),
            'items_sold' => $incomeOrders->sum('quantity'),
            'gross' => $incomeOrders->sum(fn ($order) => (float) ($order->original_amount ?: ((float) $order->unit_price * (int) $order->quantity))),
            'discounts' => $incomeOrders->sum(fn ($order) => (float) $order->points_discount),
            'income' => $incomeOrders->sum(fn ($order) => (float) $order->total_amount),
            'cash' => $incomeOrders->where('payment_method', 'cash')->sum(fn ($order) => (float) $order->total_amount),
            'gcash' => $incomeOrders->where('payment_method', 'gcash')->sum(fn ($order) => (float) $order->total_amount),
            'qrph' => $incomeOrders->where('payment_method', 'qrph')->sum(fn ($order) => (float) $order->total_amount),
            'refunded_orders' => $refundedOrders->count(),
            'refunded_items' => $refundedOrders->sum('quantity'),
            'refunded_amount' => $refundedOrders->sum(fn ($order) => (float) $order->total_amount),
        ];

        $reportBreakdown = $reportMonth
            ? $reportOrders
                ->groupBy(fn ($order) => $order->item?->title ?? 'Marketplace item')
                ->map(fn ($orders, $title) => [
                    'label' => $title,
                    'orders' => $orders->count(),
                    'items_sold' => $orders->sum('quantity'),
                    'income' => $orders->sum(fn ($order) => (float) $order->total_amount),
                ])
                ->sortByDesc('income')
                ->values()
            : $reportOrders
                ->groupBy(fn ($order) => ($order->paid_at ?: $order->created_at)->format('n'))
                ->map(fn ($orders, $month) => [
                    'label' => now()->month((int) $month)->format('F'),
                    'orders' => $orders->count(),
                    'items_sold' => $orders->sum('quantity'),
                    'income' => $orders->sum(fn ($order) => (float) $order->total_amount),
                ])
                ->sortBy(fn ($row) => array_search($row['label'], collect(range(1, 12))->map(fn ($month) => now()->month($month)->format('F'))->all(), true))
                ->values();

        $reportYears = MarketplaceOrder::query()
            ->when(!$isAdmin, fn ($query) => $query->where('seller_id', $user->id))
            ->selectRaw('YEAR(COALESCE(paid_at, created_at)) as year')
            ->whereIn('status', ['paid', 'completed', 'refunded'])
            ->groupBy('year')
            ->orderByDesc('year')
            ->pluck('year')
            ->filter()
            ->values();
        if ($reportYears->isEmpty()) {
            $reportYears = collect([now()->year]);
        }

        return view('property-custodian.reports', compact(
            'salesReport',
            'reportBreakdown',
            'reportOrders',
            'reportYears',
        ));
    }

    public function storeMarketplaceItem(Request $request): RedirectResponse
    {
        $data = $request->validate($this->marketplaceRules());
        $this->validatePaymentDetails($request);
        $imageUrls = $this->storeMarketplaceImages($request);
        unset($data['item_images']);
        $data['size_options'] = $this->normalizedSizeOptions($request);

        MarketplaceItem::create([
            ...$data,
            'user_id' => $request->user()->id,
            'image' => $imageUrls[0] ?? null,
            'image_urls' => $imageUrls,
            'pickup_instructions' => $this->pickupInstructionsFor($request),
            'accepts_cash' => $request->boolean('accepts_cash'),
            'accepts_gcash' => $request->boolean('accepts_gcash'),
            'accepts_qrph' => $request->boolean('accepts_qrph'),
        ]);

        return redirect()->route('property-custodian.market')->with('status', 'Marketplace item posted.');
    }

    public function updateMarketplaceItem(Request $request, MarketplaceItem $item): RedirectResponse
    {
        $this->authorizeMarketplaceItem($request, $item);

        $data = $request->validate($this->marketplaceRules(true));
        $this->validatePaymentDetails($request);
        $imageUrls = $item->image_urls ?? [];
        unset($data['item_images']);
        $data['size_options'] = $this->normalizedSizeOptions($request);

        if ($request->hasFile('item_images')) {
            $imageUrls = collect($imageUrls)
                ->merge($this->storeMarketplaceImages($request))
                ->filter()
                ->unique()
                ->take(3)
                ->values()
                ->all();
        }

        $item->update([
            ...$data,
            'image' => $imageUrls[0] ?? $item->image,
            'image_urls' => $imageUrls,
            'pickup_instructions' => $this->pickupInstructionsFor($request),
            'accepts_cash' => $request->boolean('accepts_cash'),
            'accepts_gcash' => $request->boolean('accepts_gcash'),
            'accepts_qrph' => $request->boolean('accepts_qrph'),
        ]);

        return redirect()->route('property-custodian.market')->with('status', 'Marketplace item updated.');
    }

    public function destroyMarketplaceItem(Request $request, MarketplaceItem $item): RedirectResponse
    {
        $this->authorizeMarketplaceItem($request, $item);
        $item->delete();

        return redirect()->route('property-custodian.market')->with('status', 'Marketplace item removed.');
    }

    public function markOrderPaid(Request $request, MarketplaceOrder $order): RedirectResponse
    {
        if ($order->seller_id !== $request->user()->id && $request->user()->role !== 'admin') {
            abort(403);
        }

        if (!in_array($order->status, ['cancelled', 'refunded'], true)) {
            $order->update([
                'status' => 'paid',
                'paid_at' => now(),
            ]);
        }

        return redirect()->route('property-custodian.market')->with('status', 'Marketplace payment verified.');
    }

    public function approveRefund(Request $request, MarketplaceOrder $order): RedirectResponse
    {
        if ($order->seller_id !== $request->user()->id && $request->user()->role !== 'admin') {
            abort(403);
        }

        $data = $request->validate([
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        if ($order->refund_status !== 'pending') {
            return redirect()->route('property-custodian.market')->withErrors([
                'marketplace' => 'This order has no pending refund request.',
            ]);
        }

        DB::transaction(function () use ($order, $request, $data) {
            $this->finalizeRefund($order, $request, $data['notes'] ?? null);
        });

        return redirect()->route('property-custodian.market')->with('status', 'Refund request approved.');
    }

    public function rejectRefund(Request $request, MarketplaceOrder $order): RedirectResponse
    {
        if ($order->seller_id !== $request->user()->id && $request->user()->role !== 'admin') {
            abort(403);
        }

        $data = $request->validate([
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        if ($order->refund_status !== 'pending') {
            return redirect()->route('property-custodian.market')->withErrors([
                'marketplace' => 'This order has no pending refund request.',
            ]);
        }

        $order->update([
            'refund_status' => 'rejected',
            'refund_review_notes' => $data['notes'] ?? null,
            'refund_reviewed_by' => $request->user()->id,
            'refund_reviewed_at' => now(),
        ]);

        SchoolNotification::create([
            'user_id' => $order->buyer_id,
            'type' => 'marketplace_refund_rejected',
            'title' => 'Refund rejected',
            'body' => "Your refund request for {$order->item?->title} was rejected.",
            'channels' => ['in_app'],
            'data' => ['order_id' => $order->id],
        ]);

        ActivityLog::record($request, 'marketplace_refund_rejected', "{$request->user()->name} rejected marketplace refund request #{$order->id}.", [
            'subject_type' => MarketplaceOrder::class,
            'subject_id' => $order->id,
            'meta' => [
                'notes' => $data['notes'] ?? null,
                'buyer_id' => $order->buyer_id,
                'seller_id' => $order->seller_id,
            ],
        ]);

        return redirect()->route('property-custodian.market')->with('status', 'Refund request rejected.');
    }

    private function finalizeRefund(MarketplaceOrder $order, Request $request, ?string $notes = null): void
    {
        if ($order->status === 'refunded') {
            return;
        }

        $reason = $order->refund_reason ?: ($notes ?: 'Refund approved.');

            $item = $order->item;
            if ($item) {
                $item->update([
                    'stock' => $item->stock + $order->quantity,
                    'status' => 'available',
                ]);
            }

            $order->update([
                'status' => 'refunded',
            'notes' => $reason,
            'refund_status' => 'approved',
            'refund_review_notes' => $notes,
            'refund_reviewed_by' => $request->user()->id,
            'refund_reviewed_at' => now(),
            ]);

        $this->refundRedemption($order, $reason);

            SchoolNotification::create([
                'user_id' => $order->buyer_id,
                'type' => 'marketplace_order_refunded',
                'title' => 'Marketplace order refunded',
            'body' => "Your refund request for {$order->item?->title} was approved.",
                'channels' => ['in_app'],
                'data' => ['order_id' => $order->id],
            ]);

        ActivityLog::record($request, 'marketplace_order_refunded', "{$request->user()->name} approved marketplace refund request #{$order->id}.", [
                'subject_type' => MarketplaceOrder::class,
                'subject_id' => $order->id,
                'meta' => [
                'reason' => $reason,
                'notes' => $notes,
                    'buyer_id' => $order->buyer_id,
                    'seller_id' => $order->seller_id,
                    'total_amount' => (float) $order->total_amount,
                    'payment_method' => $order->payment_method,
                ],
            ]);
    }

    private function marketplaceRules(bool $updating = false): array
    {
        return [
            'title' => ['required', 'string', 'max:100'],
            'description' => ['required', 'string', 'max:500'],
            'price' => ['required', 'numeric', 'min:0'],
            'stock' => ['required', 'integer', 'min:0'],
            'category' => ['required', Rule::in(['books', 'uniforms', 'electronics', 'supplies', 'other'])],
            'size_options' => ['nullable', 'string', 'max:255'],
            'condition' => ['required', Rule::in(['new', 'like_new', 'good', 'fair'])],
            'status' => [$updating ? 'required' : 'nullable', Rule::in(['available', 'reserved', 'sold'])],
            'location' => ['nullable', 'string', 'max:255'],
            'pickup_instructions' => ['nullable', 'string', 'max:1000'],
            'accepts_cash' => ['nullable', 'boolean'],
            'accepts_gcash' => ['nullable', 'boolean'],
            'accepts_qrph' => ['nullable', 'boolean'],
            'gcash_name' => ['nullable', 'string', 'max:100'],
            'gcash_number' => ['nullable', 'string', 'max:30'],
            'qrph_image_url' => ['nullable', 'string', 'max:1000'],
            'item_images' => ['nullable', 'array', 'max:3'],
            'item_images.*' => ['image', 'max:4096'],
        ];
    }

    private function authorizeMarketplaceItem(Request $request, MarketplaceItem $item): void
    {
        if ($item->user_id !== $request->user()->id && $request->user()->role !== 'admin') {
            abort(403);
        }
    }

    private function validatePaymentDetails(Request $request): void
    {
        if (!$request->boolean('accepts_cash') && !$request->boolean('accepts_gcash') && !$request->boolean('accepts_qrph')) {
            throw ValidationException::withMessages(['accepts_cash' => 'Select at least one payment method.']);
        }

        if ($request->boolean('accepts_gcash') && (!$request->filled('gcash_name') || !$request->filled('gcash_number'))) {
            throw ValidationException::withMessages(['gcash_name' => 'GCash name and number are required when GCash is enabled.']);
        }

        if ($request->boolean('accepts_qrph') && !$request->filled('qrph_image_url')) {
            throw ValidationException::withMessages(['qrph_image_url' => 'QRPH image URL is required when QRPH is enabled.']);
        }
    }

    private function pickupInstructionsFor(Request $request): ?string
    {
        $instructions = trim((string) $request->input('pickup_instructions', ''));
        if ($instructions !== '') {
            return $instructions;
        }

        if ($request->boolean('accepts_cash') || $request->boolean('accepts_gcash') || $request->boolean('accepts_qrph')) {
            return 'Pay and claim this item at the Property Custodian Office. Bring your student ID and order number.';
        }

        return null;
    }

    private function normalizedSizeOptions(Request $request): array
    {
        return collect(explode(',', (string) $request->input('size_options', '')))
            ->map(fn ($size) => trim($size))
            ->filter()
            ->unique(fn ($size) => mb_strtolower($size))
            ->take(20)
            ->values()
            ->all();
    }

    private function refundRedemption(MarketplaceOrder $order, string $reason): void
    {
        if ((int) $order->points_redeemed <= 0) {
            return;
        }

        $student = Student::where('user_id', $order->buyer_id)->first();
        if (!$student) {
            return;
        }

        StudentReward::firstOrCreate(
            [
                'student_id' => $student->id,
                'source_key' => "marketplace-redemption-refund:{$order->id}",
            ],
            [
                'awarded_by_id' => null,
                'source' => 'redemption_refunds',
                'category' => 'redemption',
                'title' => 'Marketplace points refunded',
                'description' => "Refunded {$order->points_redeemed} points from refunded marketplace order #{$order->id}.",
                'points' => (int) $order->points_redeemed,
                'school_year' => $student->school_year,
                'semester' => null,
                'meta' => ['order_id' => $order->id, 'reason' => $reason],
            ]
        );
    }

    private function storeMarketplaceImages(Request $request): array
    {
        if (!$request->hasFile('item_images')) {
            return [];
        }

        return collect($request->file('item_images'))
            ->take(3)
            ->map(fn ($image) => url(Storage::url($image->store('marketplace-images', 'public'))))
            ->values()
            ->all();
    }
}


