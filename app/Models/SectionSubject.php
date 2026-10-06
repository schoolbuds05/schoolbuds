<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SectionSubject extends Model
{
    protected $fillable = [
        'section_id', 'subject_id', 'teacher_id',
        'day', 'time_start', 'time_end', 'room',
    ];

    public function section()
    {
        return $this->belongsTo(Section::class);
    }

    public function subject()
    {
        return $this->belongsTo(Subject::class);
    }

    public function teacher()
    {
        return $this->belongsTo(User::class, 'teacher_id');
    }
}
