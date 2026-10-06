<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MarketplaceItem extends Model
{
    protected $fillable = [
        'user_id', 'title', 'description', 'price',
        'stock', 'category', 'size_options', 'condition', 'status', 'approval_status',
        'approved_by', 'approved_at', 'approval_notes', 'image', 'location', 'pickup_instructions',
        'accepts_cash', 'accepts_gcash', 'accepts_qrph', 'gcash_name', 'gcash_number', 'qrph_image_url','image_urls',
    ];

    protected $casts = [
        'image_urls'   => 'array',
        'size_options' => 'array',
        'accepts_cash' => 'boolean',
        'accepts_gcash' => 'boolean',
        'accepts_qrph' => 'boolean',
        'stock' => 'integer',
        'approved_at' => 'datetime',
    ];

    public function getImageAttribute($value): ?string
    {
        return $this->normalizeImageUrl($value);
    }

    public function getImageUrlsAttribute($value): array
    {
        $urls = is_string($value) ? json_decode($value, true) : $value;

        if (!is_array($urls)) {
            return [];
        }

        return collect($urls)
            ->map(fn ($url) => $this->normalizeImageUrl($url))
            ->filter()
            ->values()
            ->all();
    }

    private function normalizeImageUrl(?string $url): ?string
    {
        if (!$url) {
            return null;
        }

        $path = parse_url($url, PHP_URL_PATH) ?: $url;
        $path = str_replace('/school-systems/public/storage/', '/storage/', $path);

        if (str_starts_with($path, '/storage/')) {
            return rtrim(config('app.url'), '/') . $path;
        }

        return $url;
    }

    public function seller()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function messages()
    {
        return $this->hasMany(MarketplaceMessage::class, 'item_id');
    }

    public function orders()
    {
        return $this->hasMany(MarketplaceOrder::class, 'marketplace_item_id');
    }
}
