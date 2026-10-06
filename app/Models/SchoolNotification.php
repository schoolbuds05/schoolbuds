<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SchoolNotification extends Model
{
    protected $fillable = [
        'user_id',
        'type',
        'title',
        'body',
        'channels',
        'data',
        'read_at',
    ];

    protected $casts = [
        'channels' => 'array',
        'data' => 'array',
        'read_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::creating(function (SchoolNotification $notification) {
            if (!$notification->user_id) {
                return true;
            }

            $category = self::categoryForType($notification->type);
            $preference = NotificationPreference::where('user_id', $notification->user_id)
                ->where('category', $category)
                ->first();

            return !$preference || $preference->in_app;
        });
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    private static function categoryForType(string $type): string
    {
        return match (true) {
            str_contains($type, 'grade') => 'grades',
            str_contains($type, 'assignment'), str_contains($type, 'quiz') => 'assignments',
            str_contains($type, 'enrollment') => 'enrollment',
            str_contains($type, 'marketplace'), str_contains($type, 'payment') => 'marketplace',
            str_contains($type, 'points') => 'points',
            str_contains($type, 'attendance') => 'attendance',
            str_contains($type, 'low_grade') => 'low_grade',
            default => 'general',
        };
    }
}
