<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Room extends Model
{
    public const TYPE_LECTURE = 'lecture';

    public const TYPE_LAB = 'lab';

    public const TYPE_FLEXIBLE = 'flexible';

    protected $fillable = [
        'name',
        'room_type',
        'capacity',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'capacity' => 'integer',
            'is_active' => 'boolean',
        ];
    }
}
