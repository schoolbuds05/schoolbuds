<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MarketplaceMessage extends Model
{
    protected $fillable = [
        'item_id', 'sender_id', 'receiver_id', 'message', 'is_read',
    ];

    public function sender()
    {
        return $this->belongsTo(User::class, 'sender_id');
    }

    public function receiver()
    {
        return $this->belongsTo(User::class, 'receiver_id');
    }

    public function item()
    {
        return $this->belongsTo(MarketplaceItem::class, 'item_id');
    }
}