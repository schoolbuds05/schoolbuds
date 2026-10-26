<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SectionEditRequest extends Model
{
    protected $fillable = [
        'section_id',
        'requested_by',
        'reason',
        'status',
        'registrar_remarks',
        'reviewed_by',
        'reviewed_at',
    ];

    protected function casts(): array
    {
        return [
            'reviewed_at' => 'datetime',
        ];
    }

    public function section()
    {
        return $this->belongsTo(Section::class);
    }

    public function requester()
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
