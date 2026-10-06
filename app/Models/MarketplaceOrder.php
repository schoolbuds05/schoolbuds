<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MarketplaceOrder extends Model
{
    protected $fillable = [
        'marketplace_item_id',
        'buyer_id',
        'seller_id',
        'quantity',
        'size',
        'unit_price',
        'original_amount',
        'total_amount',
        'points_redeemed',
        'points_discount',
        'payment_method',
        'gcash_reference',
        'paymongo_checkout_id',
        'paymongo_payment_id',
        'paymongo_status',
        'checkout_url',
        'status',
        'notes',
        'refund_status',
        'refund_reason',
        'refund_review_notes',
        'refund_requested_at',
        'refund_reviewed_by',
        'refund_reviewed_at',
        'paid_at',
    ];

    protected $casts = [
        'quantity' => 'integer',
        'unit_price' => 'decimal:2',
        'original_amount' => 'decimal:2',
        'total_amount' => 'decimal:2',
        'points_redeemed' => 'integer',
        'points_discount' => 'decimal:2',
        'refund_requested_at' => 'datetime',
        'refund_reviewed_at' => 'datetime',
        'paid_at' => 'datetime',
    ];

    public function item()
    {
        return $this->belongsTo(MarketplaceItem::class, 'marketplace_item_id');
    }

    public function buyer()
    {
        return $this->belongsTo(User::class, 'buyer_id');
    }

    public function seller()
    {
        return $this->belongsTo(User::class, 'seller_id');
    }

    public function refundReviewer()
    {
        return $this->belongsTo(User::class, 'refund_reviewed_by');
    }
}
