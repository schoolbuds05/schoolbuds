<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PropertyAsset extends Model
{
    use HasFactory;

    public const CONDITIONS = ['new', 'good', 'needs_repair', 'damaged', 'lost'];
    public const STATUSES = ['available', 'assigned', 'maintenance', 'retired'];

    protected $fillable = [
        'asset_tag',
        'name',
        'category',
        'location',
        'condition',
        'status',
        'assigned_to',
        'notes',
        'created_by',
        'updated_by',
    ];
}
