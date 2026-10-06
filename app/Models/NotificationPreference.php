<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class NotificationPreference extends Model
{
    protected $fillable = [
        'user_id',
        'category',
        'in_app',
        'email',
        'push',
    ];

    protected $casts = [
        'in_app' => 'boolean',
        'email' => 'boolean',
        'push' => 'boolean',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
