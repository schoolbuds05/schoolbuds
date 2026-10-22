<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SectionSubjectSchedule extends Model
{
    protected $fillable = ['section_subject_id', 'day', 'time_start', 'time_end', 'room'];

    public function sectionSubject()
    {
        return $this->belongsTo(SectionSubject::class);
    }
}
