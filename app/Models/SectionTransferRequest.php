<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SectionTransferRequest extends Model
{
    protected $fillable = [
        'student_id',
        'from_section_id',
        'to_section_id',
        'requested_by',
        'reason',
        'status',
        'registrar_remarks',
        'reviewed_by',
        'reviewed_at',
    ];

    protected function casts(): array
    {
        return ['reviewed_at' => 'datetime'];
    }

    public function student()
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    public function sourceSection()
    {
        return $this->belongsTo(Section::class, 'from_section_id');
    }

    public function destinationSection()
    {
        return $this->belongsTo(Section::class, 'to_section_id');
    }

    public function requester()
    {
        return $this->belongsTo(User::class, 'requested_by');
    }
}
