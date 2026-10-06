<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\MarketplaceItem;
use App\Models\MarketplaceMessage;
use App\Models\MarketplaceOrder;
use App\Models\MarketplaceSetting;
use App\Models\SchoolNotification;
use App\Models\Student;
use App\Models\StudentReward;
use App\Models\User;
use App\Services\PointsService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

class MarketplaceController extends Controller
{
    // GET /api/marketplace — public browse (available only)
    public function index(Request $request)
    {
        $items = MarketplaceItem::with('seller')
            ->when(
                !$request->boolean('include_all') || !$this->canManageMarketplace($request),
                fn ($query) => $query->where('status', 'available')
                    ->where('approval_status', 'approved')
            )
            ->when($request->category, fn($q) =>
                $q->where('category', $request->category)
            )
            ->when($request->search, function($q) use ($request) {
                $search = addcslashes($request->search, '%_');
                $q->where(function($sub) use ($search) {
                    $sub->where('title', 'like', "%{$search}%")
                        ->orWhere('description', 'like', "%{$search}%");
                });
            })
            ->latest()
            ->get();

        return response()->json($items);
    }

    // POST /api/marketplace — create listing
    public function store(Request $request)
    {
        if (!$this->canManageMarketplace($request)) {
            return response()->json([
                'message' => 'Only school management and property custodians can post marketplace items.',
            ], 403);
        }

        $request->validate([
            'title'          => 'required|string|max:100',
            'description'    => 'required|string|max:500',
            'price'          => 'required|numeric|min:0',
            'stock'          => 'required|integer|min:1',
            'category'       => 'required|in:books,uniforms,electronics,supplies,other',
            'size_options'   => 'nullable',
            'condition'      => 'required|in:new,like_new,good,fair',
            'location'       => 'nullable|string',
            'pickup_instructions' => 'nullable|string|max:1000',
            'accepts_cash'   => 'nullable|boolean',
            'accepts_gcash'  => 'nullable|boolean',
            'accepts_qrph'   => 'nullable|boolean',
            'gcash_name'     => 'nullable|string|max:100',
            'gcash_number'   => 'nullable|string|max:30',
            'qrph_image_url' => 'nullable|string|max:1000',
            'qrph_image'     => 'nullable|image|max:4096',
            'item_images'    => 'nullable|array|max:3',
            'item_images.*'  => 'image|max:4096',
        ]);

        if (!$request->boolean('accepts_cash') && !$request->boolean('accepts_gcash') && !$request->boolean('accepts_qrph')) {
            return response()->json(['message' => 'Select at least one payment method.'], 422);
        }

        if ($request->boolean('accepts_gcash') && (!$request->filled('gcash_name') || !$request->filled('gcash_number'))) {
            return response()->json(['message' => 'GCash name and number are required for online payment.'], 422);
        }

        if ($request->boolean('accepts_qrph') && !$request->filled('qrph_image_url') && !$request->hasFile('qrph_image')) {
            return response()->json(['message' => 'QRPH image is required when QRPH is enabled.'], 422);
        }

        // Handle QRPH image
        $qrphImageUrl = $request->qrph_image_url;
        if ($request->hasFile('qrph_image')) {
            $path = $request->file('qrph_image')->store('qrph', 'public');
            $qrphImageUrl = url(Storage::url($path));
        }

        // Handle item images (up to 3)
        $imageUrls = [];
        if ($request->hasFile('item_images')) {
            foreach ($request->file('item_images') as $img) {
                $path = $img->store('marketplace-images', 'public');
                $imageUrls[] = url(Storage::url($path));
            }
        }

        $sizeOptions = $this->normalizedSizeOptions($request);

        $item = MarketplaceItem::create([
            ...$request->only([
                'title', 'description', 'price', 'stock', 'category', 'condition',
                'location', 'pickup_instructions', 'accepts_cash', 'accepts_gcash', 'accepts_qrph',
                'gcash_name', 'gcash_number',
            ]),
            'size_options' => $sizeOptions,
            'qrph_image_url' => $qrphImageUrl,
            'image_urls'     => $imageUrls,
            'pickup_instructions' => $this->pickupInstructionsFor($request),
            'user_id'        => $request->user()->id,
            'approval_status' => $this->requiresApproval($request) ? 'pending' : 'approved',
            'approved_by' => $this->requiresApproval($request) ? null : $request->user()->id,
            'approved_at' => $this->requiresApproval($request) ? null : now(),
        ]);

        return response()->json($item->load('seller'), 201);
    }

    // GET /api/marketplace/{item} — single item
    public function show(MarketplaceItem $item)
    {
        return response()->json($item->load('seller'));
    }

    // POST /api/marketplace/{item}/buy — reserve item and notify seller
    public function buy(Request $request, MarketplaceItem $item)
    {
        $request->validate([
            'payment_method'  => 'required|in:cash,gcash,qrph',
            'gcash_reference' => 'required_if:payment_method,gcash|required_if:payment_method,qrph|nullable|string|max:100',
            'quantity'        => 'nullable|integer|min:1',
            'size'            => 'nullable|string|max:30',
            'points_to_redeem' => 'nullable|integer|min:0',
        ]);

        if ($item->user_id === $request->user()->id) {
            return response()->json(['message' => 'You cannot buy your own listing.'], 422);
        }

        $quantity = (int) $request->input('quantity', 1);

        if ($item->approval_status !== 'approved') {
            return response()->json(['message' => 'This item is still waiting for school approval.'], 422);
        }

        if ($item->status !== 'available' || $item->stock < 1) {
            return response()->json(['message' => 'This item is no longer available.'], 422);
        }

        if ($quantity > $item->stock) {
            return response()->json(['message' => "Only {$item->stock} item(s) are available."], 422);
        }

        $size = $this->validatedOrderSize($request, $item);
        if ($size instanceof \Illuminate\Http\JsonResponse) {
            return $size;
        }

        if ($request->payment_method === 'cash' && !$item->accepts_cash) {
            return response()->json(['message' => 'This seller does not accept cash for this item.'], 422);
        }

        if ($request->payment_method === 'gcash' && !$item->accepts_gcash) {
            return response()->json(['message' => 'This seller does not accept GCash for this item.'], 422);
        }

        if ($request->payment_method === 'qrph' && !$item->accepts_qrph) {
            return response()->json(['message' => 'This seller does not accept QRPH for this item.'], 422);
        }

        $subtotal = (float) $item->price * $quantity;
        $redemption = $this->redemptionFor($request, $subtotal);
        $total = max(0, $subtotal - $redemption['discount']);

        $newStock = max(0, $item->stock - $quantity);
        $item->update([
            'stock'  => $newStock,
            'status' => $newStock === 0 ? 'reserved' : 'available',
        ]);

        $paymentText = match ($request->payment_method) {
            'gcash'  => 'GCash' . ($request->gcash_reference ? " (reference: {$request->gcash_reference})" : ''),
            'qrph'   => 'QRPH'  . ($request->gcash_reference ? " (reference: {$request->gcash_reference})" : ''),
            default  => 'Cash on meetup',
        };
        $sizeText = $size ? " Size: {$size}." : '';

        MarketplaceMessage::create([
            'item_id'     => $item->id,
            'sender_id'   => $request->user()->id,
            'receiver_id' => $item->user_id,
            'message'     => "I want to buy {$quantity} x {$item->title}.{$sizeText} Payment method: {$paymentText}. Please let me know how we can complete the transaction.",
        ]);

        $order = MarketplaceOrder::create([
            'marketplace_item_id' => $item->id,
            'buyer_id'            => $request->user()->id,
            'seller_id'           => $item->user_id,
            'quantity'            => $quantity,
            'size'                => $size,
            'unit_price'          => $item->price,
            'original_amount'     => $subtotal,
            'total_amount'        => $total,
            'points_redeemed'     => $redemption['points'],
            'points_discount'     => $redemption['discount'],
            'payment_method'      => $request->payment_method,
            'gcash_reference'     => in_array($request->payment_method, ['gcash', 'qrph'], true) ? $request->gcash_reference : null,
            'status'              => in_array($request->payment_method, ['gcash', 'qrph'], true) ? 'pending_verification' : 'reserved',
        ]);
        $this->recordRedemption($order, $redemption);

        ActivityLog::record($request, 'marketplace_checkout_started', "{$request->user()->name} started marketplace checkout #{$order->id}.", [
            'subject_type' => MarketplaceOrder::class,
            'subject_id' => $order->id,
            'meta' => [
                'item_id' => $item->id,
                'quantity' => $quantity,
                'total_amount' => (float) $total,
                'payment_method' => $request->payment_method,
            ],
        ]);

        return response()->json([
            'item'  => $item->load('seller'),
            'order' => $order->load(['item.seller', 'seller']),
        ]);
    }

    // POST /api/marketplace/{item}/paymongo-checkout — create hosted GCash checkout
    public function paymongoCheckout(Request $request, MarketplaceItem $item)
    {
        $request->validate([
            'quantity' => 'required|integer|min:1',
            'size' => 'nullable|string|max:30',
            'points_to_redeem' => 'nullable|integer|min:0',
        ]);

        if ($item->user_id === $request->user()->id) {
            return response()->json(['message' => 'You cannot buy your own listing.'], 422);
        }

        if (!$item->accepts_gcash) {
            return response()->json(['message' => 'This item does not accept GCash.'], 422);
        }

        if ($item->approval_status !== 'approved') {
            return response()->json(['message' => 'This item is still waiting for school approval.'], 422);
        }

        if ($item->status !== 'available' || $item->stock < 1) {
            return response()->json(['message' => 'This item is no longer available.'], 422);
        }

        $quantity = (int) $request->quantity;
        if ($quantity > $item->stock) {
            return response()->json(['message' => "Only {$item->stock} item(s) are available."], 422);
        }

        $size = $this->validatedOrderSize($request, $item);
        if ($size instanceof \Illuminate\Http\JsonResponse) {
            return $size;
        }

        $secretKey = config('services.paymongo.secret_key');
        if (!$secretKey) {
            return response()->json(['message' => 'PayMongo is not configured. Add PAYMONGO_SECRET_KEY to your .env file.'], 503);
        }

        $subtotal = (float) $item->price * $quantity;
        $redemption = $this->redemptionFor($request, $subtotal);
        $total = max(0, $subtotal - $redemption['discount']);

        $newStock = max(0, $item->stock - $quantity);
        $item->update([
            'stock'  => $newStock,
            'status' => $newStock === 0 ? 'reserved' : 'available',
        ]);

        $order = MarketplaceOrder::create([
            'marketplace_item_id' => $item->id,
            'buyer_id'            => $request->user()->id,
            'seller_id'           => $item->user_id,
            'quantity'            => $quantity,
            'size'                => $size,
            'unit_price'          => $item->price,
            'original_amount'     => $subtotal,
            'total_amount'        => $total,
            'points_redeemed'     => $redemption['points'],
            'points_discount'     => $redemption['discount'],
            'payment_method'      => 'gcash',
            'status'              => 'reserved',
            'paymongo_status'     => 'pending',
        ]);
        $this->recordRedemption($order, $redemption);

        ActivityLog::record($request, 'marketplace_checkout_started', "{$request->user()->name} started PayMongo checkout #{$order->id}.", [
            'subject_type' => MarketplaceOrder::class,
            'subject_id' => $order->id,
            'meta' => [
                'item_id' => $item->id,
                'quantity' => $quantity,
                'total_amount' => (float) $total,
                'payment_method' => 'gcash',
                'provider' => 'paymongo',
            ],
        ]);

        $response = Http::withBasicAuth($secretKey, '')
            ->acceptJson()
            ->post('https://api.paymongo.com/v1/checkout_sessions', [
                'data' => [
                    'attributes' => [
                        'description'          => "Marketplace order #{$order->id}",
                        'reference_number'     => "MKT-{$order->id}",
                        'line_items'           => [[
                            'currency' => 'PHP',
                            'amount'   => (int) round($total * 100),
                            'name'     => trim(($redemption['points'] > 0 ? "{$item->title} after points discount" : $item->title) . ($size ? " - Size {$size}" : '')),
                            'quantity' => 1,
                        ]],
                        'payment_method_types' => ['gcash'],
                        'send_email_receipt'   => false,
                        'show_description'     => true,
                        'show_line_items'      => true,
                        'success_url'          => config('services.paymongo.success_url'),
                        'cancel_url'           => config('services.paymongo.cancel_url'),
                        'metadata'             => [
                            'marketplace_order_id' => (string) $order->id,
                            'marketplace_item_id'  => (string) $item->id,
                            'buyer_id'             => (string) $request->user()->id,
                        ],
                    ],
                ],
            ]);

        if (!$response->successful()) {
            $item->update([
                'stock'  => $item->stock + $quantity,
                'status' => 'available',
            ]);
            $order->update([
                'status'          => 'cancelled',
                'paymongo_status' => 'checkout_failed',
                'notes'           => $response->json('errors.0.detail') ?? 'PayMongo checkout session could not be created.',
            ]);
            $this->refundRedemption($order, 'PayMongo checkout failed.');

            return response()->json(['message' => $order->notes], 422);
        }

        $session      = $response->json('data');
        $attributes   = $session['attributes'] ?? [];
        $checkoutUrl  = $attributes['checkout_url'] ?? $attributes['url'] ?? null;

        $order->update([
            'paymongo_checkout_id' => $session['id'] ?? null,
            'checkout_url'         => $checkoutUrl,
        ]);

        MarketplaceMessage::create([
            'item_id'     => $item->id,
            'sender_id'   => $request->user()->id,
            'receiver_id' => $item->user_id,
            'message'     => "I started GCash checkout for {$quantity} x {$item->title}" . ($size ? " (size {$size})" : '') . ". Order #{$order->id}.",
        ]);

        return response()->json([
            'checkout_url' => $checkoutUrl,
            'item'         => $item->fresh()->load('seller'),
            'order'        => $order->fresh()->load(['item.seller', 'seller']),
        ]);
    }

    // PUT /api/marketplace/{item} — full update
    public function update(Request $request, MarketplaceItem $item)
    {
        if ($item->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $request->validate([
            'title'          => 'nullable|string|max:100',
            'description'    => 'nullable|string|max:500',
            'price'          => 'nullable|numeric|min:0',
            'stock'          => 'nullable|integer|min:0',
            'category'       => 'nullable|in:books,uniforms,electronics,supplies,other',
            'size_options'   => 'nullable',
            'condition'      => 'nullable|in:new,like_new,good,fair',
            'status'         => 'nullable|in:available,reserved,sold',
            'location'       => 'nullable|string',
            'pickup_instructions' => 'nullable|string|max:1000',
            'accepts_cash'   => 'nullable|boolean',
            'accepts_gcash'  => 'nullable|boolean',
            'accepts_qrph'   => 'nullable|boolean',
            'gcash_name'     => 'nullable|string|max:100',
            'gcash_number'   => 'nullable|string|max:30',
            'qrph_image_url' => 'nullable|string|max:1000',
            'qrph_image'     => 'nullable|image|max:4096',
            'item_images'    => 'nullable|array|max:3',
            'item_images.*'  => 'image|max:4096',
        ]);

        // Handle QRPH image
        $qrphImageUrl = $item->qrph_image_url;
        if ($request->hasFile('qrph_image')) {
            $path = $request->file('qrph_image')->store('qrph', 'public');
            $qrphImageUrl = url(Storage::url($path));
        } elseif ($request->filled('qrph_image_url')) {
            $qrphImageUrl = $request->qrph_image_url;
        }

        // Handle item images — replace all if new ones are uploaded, otherwise keep existing
        $imageUrls = $item->image_urls ?? [];
        if ($request->hasFile('item_images')) {
            $imageUrls = [];
            foreach ($request->file('item_images') as $img) {
                $path = $img->store('marketplace-images', 'public');
                $imageUrls[] = url(Storage::url($path));
            }
        }

        $item->update([
            ...$request->only([
                'title', 'description', 'price', 'stock', 'category', 'condition', 'status',
                'location', 'pickup_instructions', 'accepts_cash', 'accepts_gcash', 'accepts_qrph',
                'gcash_name', 'gcash_number',
            ]),
            ...($request->has('size_options') ? ['size_options' => $this->normalizedSizeOptions($request)] : []),
            'qrph_image_url' => $qrphImageUrl,
            'image_urls'     => $imageUrls,
            'pickup_instructions' => $request->has('pickup_instructions')
                ? $this->pickupInstructionsFor($request)
                : $item->pickup_instructions,
        ]);

        return response()->json($item->load('seller'));
    }

    // DELETE /api/marketplace/{item}
    public function destroy(Request $request, MarketplaceItem $item)
    {
        if ($item->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        $item->delete();
        return response()->json(['message' => 'Item deleted']);
    }

    // GET /api/marketplace/my-items — seller's own listings (all statuses)
    public function myItems(Request $request)
    {
        $items = MarketplaceItem::where('user_id', $request->user()->id)
            ->latest()
            ->get();
        return response()->json($items);
    }

    // GET /api/marketplace/my-orders — buyer checkout/reservation portal
    public function myOrders(Request $request)
    {
        $orders = MarketplaceOrder::where('buyer_id', $request->user()->id)
            ->with(['item.seller', 'seller'])
            ->latest()
            ->get();

        return response()->json($orders);
    }

    // GET /api/marketplace/sales — school management sees marketplace checkouts
    public function sales(Request $request)
    {
        if (!$this->canManageMarketplace($request)) {
            return response()->json([
                'message' => 'Only school management and property custodians can view marketplace sales.',
            ], 403);
        }

        $orders = MarketplaceOrder::with(['item', 'buyer', 'seller'])
            ->when($this->isPropertyCustodian($request), fn ($query) => $query->where('seller_id', $request->user()->id))
            ->latest()
            ->get();

        return response()->json($orders);
    }

    // GET /api/marketplace/payment-options — app payment instructions
    public function paymentOptions(Request $request)
    {
        return response()->json([
            'qrph' => [
                'account_name'  => config('services.qrph.account_name'),
                'account_number'=> config('services.qrph.account_number'),
                'image_url'     => config('services.qrph.image_url'),
                'instructions'  => config('services.qrph.instructions'),
                'enabled'       => (bool) (config('services.qrph.image_url') || config('services.qrph.account_number')),
            ],
            'redemption' => [
                'rate' => (float) $this->settingValue('redemption_rate', 0.5),
                'max_percent' => (float) $this->settingValue('max_redemption_percent', 40),
                'min_points' => 50,
                'max_points' => 100,
            ],
        ]);
    }

    public function settings(Request $request)
    {
        if (!$this->canManageMarketplace($request)) {
            return response()->json(['message' => 'Only school management can view marketplace settings.'], 403);
        }

        return response()->json($this->settingsPayload());
    }

    public function updateSettings(Request $request)
    {
        if (!$request->user()->hasAnyRole(['admin', 'registrar', 'school_management'])) {
            return response()->json(['message' => 'Only school management can update marketplace settings.'], 403);
        }

        $data = $request->validate([
            'require_item_approval' => ['nullable', 'boolean'],
            'redemption_rate' => ['nullable', 'numeric', 'min:0'],
            'max_redemption_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
        ]);

        foreach ($data as $key => $value) {
            MarketplaceSetting::updateOrCreate(
                ['key' => $key],
                ['value' => ['value' => $value], 'updated_by' => $request->user()->id]
            );
        }

        return response()->json($this->settingsPayload());
    }

    public function approve(Request $request, MarketplaceItem $item)
    {
        if (!$request->user()->hasAnyRole(['admin', 'registrar', 'school_management'])) {
            return response()->json(['message' => 'Only school management can approve listings.'], 403);
        }

        $item->update([
            'approval_status' => 'approved',
            'approved_by' => $request->user()->id,
            'approved_at' => now(),
            'approval_notes' => $request->input('notes'),
        ]);

        $this->notifyUser($item->user_id, 'marketplace_item_approved', 'Marketplace item approved', "{$item->title} is now available.", ['item_id' => $item->id]);

        return response()->json($item->fresh()->load('seller'));
    }

    public function reject(Request $request, MarketplaceItem $item)
    {
        if (!$request->user()->hasAnyRole(['admin', 'registrar', 'school_management'])) {
            return response()->json(['message' => 'Only school management can reject listings.'], 403);
        }

        $data = $request->validate([
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        $item->update([
            'approval_status' => 'rejected',
            'approved_by' => $request->user()->id,
            'approved_at' => now(),
            'approval_notes' => $data['notes'] ?? null,
        ]);

        $this->notifyUser($item->user_id, 'marketplace_item_rejected', 'Marketplace item rejected', $data['notes'] ?? "{$item->title} was not approved.", ['item_id' => $item->id]);

        return response()->json($item->fresh()->load('seller'));
    }

    // POST /api/marketplace/orders/{order}/mark-paid — management verifies manual payment
    public function markOrderPaid(Request $request, MarketplaceOrder $order)
    {
        if (!$request->user()->hasAnyRole(['admin', 'registrar', 'school_management']) && $order->seller_id !== $request->user()->id) {
            return response()->json(['message' => 'Only school management or the item seller can verify payments.'], 403);
        }

        if (in_array($order->status, ['cancelled', 'refunded'], true)) {
            return response()->json(['message' => 'Cancelled or refunded orders cannot be marked as paid.'], 422);
        }

        $order->update([
            'status'  => 'paid',
            'paid_at' => now(),
        ]);

        MarketplaceMessage::create([
            'item_id'     => $order->marketplace_item_id,
            'sender_id'   => $request->user()->id,
            'receiver_id' => $order->buyer_id,
            'message'     => "Your payment for {$order->item?->title} has been verified.",
        ]);

        $this->notifyUser(
            $order->buyer_id,
            'payment_verified',
            'Payment verified',
            "Your payment for {$order->item?->title} has been verified.",
            ['order_id' => $order->id]
        );

        ActivityLog::record($request, 'marketplace_payment_verified', "{$request->user()->name} marked marketplace order #{$order->id} as paid.", [
            'subject_type' => MarketplaceOrder::class,
            'subject_id' => $order->id,
            'meta' => [
                'buyer_id' => $order->buyer_id,
                'seller_id' => $order->seller_id,
                'total_amount' => (float) $order->total_amount,
                'payment_method' => $order->payment_method,
            ],
        ]);

        return response()->json($order->load(['item', 'buyer', 'seller']));
    }

    public function refundOrder(Request $request, MarketplaceOrder $order)
    {
        if ($order->buyer_id !== $request->user()->id) {
            return response()->json(['message' => 'Only the buyer can request a refund.'], 403);
        }

        if (!in_array($order->status, ['paid', 'completed'], true) && !$order->paid_at && $order->paymongo_status !== 'paid') {
            return response()->json(['message' => 'Only paid or completed orders can be submitted for refund.'], 422);
        }

        if (in_array($order->refund_status, ['pending', 'approved'], true)) {
            return response()->json(['message' => 'This order already has a refund request.'], 422);
        }

        $data = $request->validate([
            'reason' => 'required|string|min:3|max:500',
        ]);

        $order->update([
            'refund_status' => 'pending',
            'refund_reason' => $data['reason'],
            'refund_review_notes' => null,
            'refund_requested_at' => now(),
            'refund_reviewed_by' => null,
            'refund_reviewed_at' => null,
        ]);

        MarketplaceMessage::create([
            'item_id' => $order->marketplace_item_id,
            'sender_id' => $request->user()->id,
            'receiver_id' => $order->seller_id,
            'message' => "I requested a refund for {$order->item?->title}. Reason: {$data['reason']}",
        ]);

        $this->notifyUser(
            $order->seller_id,
            'marketplace_refund_requested',
            'Refund requested',
            "{$request->user()->name} requested a refund for {$order->item?->title}.",
            ['order_id' => $order->id]
        );

        ActivityLog::record($request, 'marketplace_refund_requested', "{$request->user()->name} requested a refund for marketplace order #{$order->id}.", [
            'subject_type' => MarketplaceOrder::class,
            'subject_id' => $order->id,
            'meta' => [
                'reason' => $data['reason'],
                'buyer_id' => $order->buyer_id,
                'seller_id' => $order->seller_id,
                'total_amount' => (float) $order->total_amount,
            ],
        ]);

        return response()->json($order->fresh()->load(['item', 'buyer', 'seller']));
    }

    public function approveRefund(Request $request, MarketplaceOrder $order)
    {
        if (!$this->canManageMarketplace($request) && $order->seller_id !== $request->user()->id) {
            return response()->json(['message' => 'Only school management or the custodian seller can approve refunds.'], 403);
        }

        if ($order->refund_status !== 'pending') {
            return response()->json(['message' => 'This order has no pending refund request.'], 422);
        }

        $data = $request->validate([
            'notes' => 'nullable|string|max:500',
        ]);

        DB::transaction(function () use ($order, $request, $data) {
            $this->finalizeRefund($order, $request, $data['notes'] ?? null);
        });

        return response()->json($order->fresh()->load(['item', 'buyer', 'seller']));
    }

    public function rejectRefund(Request $request, MarketplaceOrder $order)
    {
        if (!$this->canManageMarketplace($request) && $order->seller_id !== $request->user()->id) {
            return response()->json(['message' => 'Only school management or the custodian seller can reject refunds.'], 403);
        }

        if ($order->refund_status !== 'pending') {
            return response()->json(['message' => 'This order has no pending refund request.'], 422);
        }

        $data = $request->validate([
            'notes' => 'nullable|string|max:500',
        ]);

        $order->update([
            'refund_status' => 'rejected',
            'refund_review_notes' => $data['notes'] ?? null,
            'refund_reviewed_by' => $request->user()->id,
            'refund_reviewed_at' => now(),
        ]);

        $this->notifyUser(
            $order->buyer_id,
            'marketplace_refund_rejected',
            'Refund rejected',
            "Your refund request for {$order->item?->title} was rejected.",
            ['order_id' => $order->id]
        );

        ActivityLog::record($request, 'marketplace_refund_rejected', "{$request->user()->name} rejected marketplace refund request #{$order->id}.", [
            'subject_type' => MarketplaceOrder::class,
            'subject_id' => $order->id,
            'meta' => [
                'notes' => $data['notes'] ?? null,
                'buyer_id' => $order->buyer_id,
                'seller_id' => $order->seller_id,
            ],
        ]);

        return response()->json($order->fresh()->load(['item', 'buyer', 'seller']));
    }

    public function markOrderReceived(Request $request, MarketplaceOrder $order)
    {
        if ($order->buyer_id !== $request->user()->id) {
            return response()->json(['message' => 'Only the buyer can mark this order as received.'], 403);
        }

        if (in_array($order->status, ['cancelled', 'refunded'], true)) {
            return response()->json(['message' => 'Cancelled or refunded orders cannot be marked as received.'], 422);
        }

        if ($order->status === 'completed') {
            return response()->json($order->load(['item.seller', 'seller']));
        }

        if (!in_array($order->status, ['reserved', 'paid'], true) && !$order->paid_at && $order->paymongo_status !== 'paid') {
            return response()->json(['message' => 'This order is not ready to be marked as received.'], 422);
        }

        $order->update([
            'status' => 'completed',
            'paid_at' => $order->paid_at ?? now(),
        ]);

        $this->notifyUser(
            $order->seller_id,
            'order_received',
            'Order received',
            "The buyer marked {$order->item?->title} as received.",
            ['order_id' => $order->id]
        );

        ActivityLog::record($request, 'marketplace_order_received', "{$request->user()->name} marked marketplace order #{$order->id} as received.", [
            'subject_type' => MarketplaceOrder::class,
            'subject_id' => $order->id,
            'meta' => [
                'buyer_id' => $order->buyer_id,
                'seller_id' => $order->seller_id,
                'payment_method' => $order->payment_method,
            ],
        ]);

        return response()->json($order->fresh()->load(['item.seller', 'seller']));
    }

    public function receipt(Request $request, MarketplaceOrder $order)
    {
        if (
            $order->buyer_id !== $request->user()->id
            && $order->seller_id !== $request->user()->id
            && !$request->user()->hasAnyRole(['admin', 'registrar', 'school_management'])
        ) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if (!in_array($order->status, ['paid', 'completed'], true) && !$order->paid_at && $order->paymongo_status !== 'paid') {
            return response()->json(['message' => 'Receipts are only available for paid orders.'], 422);
        }

        $order->load(['item.seller', 'buyer', 'seller']);

        return response()->json([
            'receipt_no' => 'MKT-' . str_pad((string) $order->id, 6, '0', STR_PAD_LEFT),
            'issued_at' => now(),
            'paid_at' => $order->paid_at,
            'status' => $order->status,
            'payment_method' => strtoupper((string) $order->payment_method),
            'paymongo_payment_id' => $order->paymongo_payment_id,
            'buyer' => [
                'name' => $order->buyer?->name,
                'email' => $order->buyer?->email,
            ],
            'seller' => [
                'name' => $order->seller?->name ?? $order->item?->seller?->name,
                'email' => $order->seller?->email ?? $order->item?->seller?->email,
            ],
            'items' => [[
                'title' => $order->item?->title,
                'quantity' => $order->quantity,
                'size' => $order->size,
                'unit_price' => (float) $order->unit_price,
                'total' => (float) ($order->original_amount ?: ($order->unit_price * $order->quantity)),
            ]],
            'subtotal' => (float) ($order->original_amount ?: $order->total_amount),
            'points_redeemed' => (int) $order->points_redeemed,
            'points_discount' => (float) $order->points_discount,
            'total' => (float) $order->total_amount,
        ]);
    }

    // POST /api/marketplace/orders/{order}/cancel — buyer cancels checkout/reservation
    public function cancelOrder(Request $request, MarketplaceOrder $order)
    {
        if ($order->buyer_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if ($order->status === 'cancelled') {
            return response()->json(['message' => 'This checkout is already cancelled.'], 422);
        }

        if ($order->status === 'refunded') {
            return response()->json(['message' => 'This checkout is already refunded.'], 422);
        }

        if (in_array($order->status, ['paid', 'completed'], true) || $order->paid_at || $order->paymongo_status === 'paid') {
            return response()->json(['message' => 'Paid orders cannot be cancelled.'], 422);
        }

        $request->validate([
            'reason' => 'required|string|min:3|max:500',
        ]);

        $item = $order->item;
        if ($item) {
            $item->update([
                'stock'  => $item->stock + $order->quantity,
                'status' => 'available',
            ]);
        }

        $order->update([
            'status' => 'cancelled',
            'notes'  => $request->reason,
        ]);
        $this->refundRedemption($order, $request->reason);

        MarketplaceMessage::create([
            'item_id'     => $order->marketplace_item_id,
            'sender_id'   => $request->user()->id,
            'receiver_id' => $order->seller_id,
            'message'     => "I cancelled my checkout for {$order->item?->title}. Reason: {$request->reason}",
        ]);

        ActivityLog::record($request, 'marketplace_order_cancelled', "{$request->user()->name} cancelled marketplace order #{$order->id}.", [
            'subject_type' => MarketplaceOrder::class,
            'subject_id' => $order->id,
            'meta' => [
                'reason' => $request->reason,
                'seller_id' => $order->seller_id,
                'total_amount' => (float) $order->total_amount,
            ],
        ]);

        return response()->json($order->load(['item.seller', 'seller']));
    }

    // POST /api/paymongo/webhook — PayMongo payment confirmation
    public function paymongoWebhook(Request $request)
    {
        // TODO: Add your PayMongo webhook signing secret to config/services.php as 'paymongo.webhook_secret'
        $secret = config('services.paymongo.webhook_secret');
        if ($secret) {
            $signature = $request->header('Paymongo-Signature');
            // Verify HMAC signature
            if (!$signature || !hash_equals(hash_hmac('sha256', $request->getContent(), $secret), $signature)) {
                return response()->json(['error' => 'Invalid signature'], 403);
            }
        }

        $payload        = $request->all();
        $attributes     = $payload['data']['attributes'] ?? [];
        $eventType      = $attributes['type'] ?? null;
        $eventData      = $attributes['data'] ?? [];
        $eventAttributes= $eventData['attributes'] ?? [];
        $metadata       = $eventAttributes['metadata'] ?? [];

        $orderId         = $metadata['marketplace_order_id'] ?? null;
        $referenceNumber = $eventAttributes['reference_number'] ?? $eventAttributes['external_reference_number'] ?? null;
        $checkoutId      = $eventData['id'] ?? null;

        $order = $orderId
            ? MarketplaceOrder::find($orderId)
            : MarketplaceOrder::where('paymongo_checkout_id', $checkoutId)->first();

        if (!$order && is_string($referenceNumber) && str_starts_with($referenceNumber, 'MKT-')) {
            $order = MarketplaceOrder::find((int) str_replace('MKT-', '', $referenceNumber));
        }

        if (!$order) {
            return response()->json(['received' => true]);
        }

        if (in_array($order->status, ['cancelled', 'refunded'], true)) {
            return response()->json(['received' => true]);
        }

        if (in_array($eventType, ['payment.paid', 'checkout_session.payment.paid', 'checkout_session.completed'], true)) {
            $order->update([
                'status'               => 'paid',
                'paymongo_status'      => 'paid',
                'paymongo_payment_id'  => $eventAttributes['payment_intent_id'] ?? $eventData['id'] ?? $order->paymongo_payment_id,
                'paid_at'              => now(),
            ]);
            $this->notifyUser(
                $order->buyer_id,
                'payment_verified',
                'Payment received',
                "Your payment for {$order->item?->title} has been received.",
                ['order_id' => $order->id]
            );
        } elseif (in_array($eventType, ['payment.failed', 'checkout_session.payment.failed'], true)) {
            $order->update([
                'paymongo_status' => 'failed',
                'notes'           => $eventAttributes['failed_message'] ?? 'PayMongo payment failed.',
            ]);
            $this->notifyUser(
                $order->buyer_id,
                'payment_failed',
                'Payment failed',
                $eventAttributes['failed_message'] ?? 'Your marketplace payment failed.',
                ['order_id' => $order->id]
            );
        }

        return response()->json(['received' => true]);
    }

    // ── MESSAGES ────────────────────────────────────────────────

    public function sendMessage(Request $request, MarketplaceItem $item)
    {
        $request->validate(['message' => 'required|string|max:500']);

        $receiverId = $item->user_id === $request->user()->id
            ? $request->receiver_id
            : $item->user_id;

        $message = MarketplaceMessage::create([
            'item_id'     => $item->id,
            'sender_id'   => $request->user()->id,
            'receiver_id' => $receiverId,
            'message'     => $request->message,
        ]);

        ActivityLog::record($request, 'marketplace_message_sent', "{$request->user()->name} sent a marketplace message about {$item->title}.", [
            'subject_type' => MarketplaceMessage::class,
            'subject_id' => $message->id,
            'meta' => [
                'item_id' => $item->id,
                'sender_id' => $request->user()->id,
                'receiver_id' => $receiverId,
            ],
        ]);

        return response()->json($message->load('sender'), 201);
    }

    private function notifyUser(?int $userId, string $type, string $title, ?string $body = null, array $data = []): void
    {
        if (!$userId) {
            return;
        }

        SchoolNotification::create([
            'user_id' => $userId,
            'type' => $type,
            'title' => $title,
            'body' => $body,
            'channels' => ['in_app'],
            'data' => $data,
        ]);
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
        $raw = $request->input('size_options', []);
        if (is_string($raw)) {
            $raw = explode(',', $raw);
        }

        return collect(is_array($raw) ? $raw : [])
            ->map(fn ($size) => trim((string) $size))
            ->filter()
            ->unique(fn ($size) => mb_strtolower($size))
            ->take(20)
            ->values()
            ->all();
    }

    private function validatedOrderSize(Request $request, MarketplaceItem $item): string|\Illuminate\Http\JsonResponse|null
    {
        $options = collect($item->size_options ?? [])
            ->map(fn ($size) => trim((string) $size))
            ->filter()
            ->values();

        if ($options->isEmpty()) {
            return null;
        }

        $size = trim((string) $request->input('size', ''));
        if ($size === '') {
            return response()->json(['message' => 'Please choose a uniform size.'], 422);
        }

        $matched = $options->first(fn ($option) => mb_strtolower($option) === mb_strtolower($size));
        if (!$matched) {
            return response()->json(['message' => 'Choose one of the available sizes for this uniform.'], 422);
        }

        return $matched;
    }

    private function redemptionFor(Request $request, float $subtotal): array
    {
        $requested = (int) $request->input('points_to_redeem', 0);
        if ($requested <= 0) {
            return ['student' => null, 'points' => 0, 'discount' => 0.0, 'balance' => 0, 'max_points' => 0];
        }

        $student = Student::where('user_id', $request->user()->id)->first();
        if (!$student) {
            abort(response()->json(['message' => 'Only student accounts with a profile can redeem points.'], 422));
        }

        $balance = app(PointsService::class)->redemptionBalanceFor($student, $student->school_year);
        $rate = max(0.01, (float) $this->settingValue('redemption_rate', 0.5));
        $maxPercent = max(0, min(100, (float) $this->settingValue('max_redemption_percent', 40)));
        $maxByValue = (int) floor(($subtotal * ($maxPercent / 100)) / $rate);
        $maxPoints = max(0, min(100, $maxByValue, $balance));

        if ($requested < 50) {
            abort(response()->json(['message' => 'Minimum redemption is 50 points.'], 422));
        }

        if ($requested > $maxPoints) {
            abort(response()->json([
                'message' => "You can redeem up to {$maxPoints} points for this checkout.",
                'max_points' => $maxPoints,
                'balance' => $balance,
            ], 422));
        }

        return [
            'student' => $student,
            'points' => $requested,
            'discount' => round($requested * $rate, 2),
            'balance' => $balance,
            'max_points' => $maxPoints,
        ];
    }

    private function recordRedemption(MarketplaceOrder $order, array $redemption): void
    {
        if (($redemption['points'] ?? 0) <= 0 || !$redemption['student']) {
            return;
        }

        StudentReward::updateOrCreate(
            [
                'student_id' => $redemption['student']->id,
                'source_key' => "marketplace-redemption:{$order->id}",
            ],
            [
                'awarded_by_id' => null,
                'source' => 'redemptions',
                'category' => 'redemption',
                'title' => 'Marketplace points redeemed',
                'description' => "Redeemed {$redemption['points']} points for marketplace order #{$order->id}.",
                'points' => -1 * (int) $redemption['points'],
                'school_year' => $redemption['student']->school_year,
                'semester' => null,
                'meta' => [
                    'order_id' => $order->id,
                    'discount' => $redemption['discount'],
                ],
            ]
        );

        $this->notifyUser(
            $order->buyer_id,
            'points_redeemed',
            'Points redeemed',
            "You redeemed {$redemption['points']} points for a PHP " . number_format((float) $redemption['discount'], 2) . ' discount.',
            ['order_id' => $order->id, 'points' => $redemption['points']]
        );
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
                'description' => "Refunded {$order->points_redeemed} points from cancelled marketplace order #{$order->id}.",
                'points' => (int) $order->points_redeemed,
                'school_year' => $student->school_year,
                'semester' => null,
                'meta' => ['order_id' => $order->id, 'reason' => $reason],
            ]
        );

        $this->notifyUser(
            $order->buyer_id,
            'points_refunded',
            'Points refunded',
            "{$order->points_redeemed} marketplace points were returned to your account.",
            ['order_id' => $order->id, 'points' => (int) $order->points_redeemed]
        );
    }

    private function finalizeRefund(MarketplaceOrder $order, Request $request, ?string $notes = null): void
    {
        if ($order->status === 'refunded') {
            return;
        }

        $item = $order->item;
        if ($item) {
            $item->update([
                'stock' => $item->stock + $order->quantity,
                'status' => 'available',
            ]);
        }

        $reason = $order->refund_reason ?: ($notes ?: 'Refund approved.');

        $order->update([
            'status' => 'refunded',
            'notes' => $reason,
            'refund_status' => 'approved',
            'refund_review_notes' => $notes,
            'refund_reviewed_by' => $request->user()->id,
            'refund_reviewed_at' => now(),
        ]);

        $this->refundRedemption($order, $reason);

        MarketplaceMessage::create([
            'item_id' => $order->marketplace_item_id,
            'sender_id' => $request->user()->id,
            'receiver_id' => $order->buyer_id,
            'message' => "Your refund request for {$order->item?->title} was approved.",
        ]);

        $this->notifyUser(
            $order->buyer_id,
            'marketplace_order_refunded',
            'Marketplace order refunded',
            "Your refund request for {$order->item?->title} was approved.",
            ['order_id' => $order->id]
        );

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

    public function getMessages(Request $request, MarketplaceItem $item)
    {
        $userId = $request->user()->id;

        $messages = MarketplaceMessage::where('item_id', $item->id)
            ->where(fn($q) =>
                $q->where('sender_id', $userId)
                  ->orWhere('receiver_id', $userId)
            )
            ->with('sender')
            ->orderBy('created_at')
            ->get();

        MarketplaceMessage::where('item_id', $item->id)
            ->where('receiver_id', $userId)
            ->update(['is_read' => true]);

        return response()->json($messages);
    }

    public function myChats(Request $request)
    {
        $userId = $request->user()->id;

        $chats = MarketplaceMessage::where('sender_id', $userId)
            ->orWhere('receiver_id', $userId)
            ->with(['item', 'sender', 'receiver'])
            ->latest()
            ->get()
            ->groupBy('item_id')
            ->map(fn($msgs) => [
                'item'         => $msgs->first()->item,
                'last_message' => $msgs->last()->message,
                'unread'       => $msgs->where('receiver_id', $userId)->where('is_read', false)->count(),
                'other_user'   => $msgs->first()->sender_id === $userId
                    ? $msgs->first()->receiver
                    : $msgs->first()->sender,
            ])->values();

        return response()->json($chats);
    }

    private function canManageMarketplace(Request $request): bool
    {
        return $this->isSchoolManager($request)
            || $this->isPropertyCustodian($request);
    }

    private function requiresApproval(Request $request): bool
    {
        if ($this->isSchoolManager($request)) {
            return false;
        }

        return (bool) $this->settingValue('require_item_approval', false);
    }

    private function isSchoolManager(Request $request): bool
    {
        $user = $request->user();

        return $user
            && (
                in_array($user->role, ['admin', 'registrar', 'school_management'], true)
                || $user->hasAnyRole(['admin', 'registrar', 'school_management'])
            );
    }

    private function settingsPayload(): array
    {
        return [
            'require_item_approval' => (bool) $this->settingValue('require_item_approval', false),
            'redemption_rate' => (float) $this->settingValue('redemption_rate', 0.5),
            'max_redemption_percent' => (float) $this->settingValue('max_redemption_percent', 40),
        ];
    }

    private function settingValue(string $key, mixed $default): mixed
    {
        $setting = MarketplaceSetting::where('key', $key)->first();
        return $setting?->value['value'] ?? $default;
    }

    private function isPropertyCustodian(Request $request): bool
    {
        $user = $request->user();

        return $user
            && (
                (
                    $user->role === User::ROLE_STAFF
                    && $user->position === User::POSITION_PROPERTY_CUSTODIAN
                )
                || $user->role === User::POSITION_PROPERTY_CUSTODIAN
            );
    }
}
