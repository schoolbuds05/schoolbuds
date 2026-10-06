<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SubjectChangeRequest extends Model
{
    protected $fillable = [
        'user_id',
        'subject_id',
        'section_id',
        'action',
        'reason',
        'status',
        'registrar_remarks',
        'reviewed_by',
        'reviewed_at',
    ];

    protected $casts = [
        'reviewed_at' => 'datetime',
    ];

    public function student()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function subject()
    {
        return $this->belongsTo(Subject::class);
    }

    public function section()
    {
        return $this->belongsTo(Section::class);
    }

    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
