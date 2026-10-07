<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ClassAssignment extends Model
{
    protected $fillable = [
        'section_subject_id',
        'teacher_id',
        'type',
        'title',
        'instructions',
        'points_possible',
        'due_at',
        'allow_file_upload',
        'questions',
        'status',
    ];

    protected $casts = [
        'points_possible' => 'decimal:2',
        'due_at' => 'datetime',
        'allow_file_upload' => 'boolean',
        'questions' => 'array',
    ];

    public function sectionSubject()
    {
        return $this->belongsTo(SectionSubject::class);
    }

    public function teacher()
    {
        return $this->belongsTo(User::class, 'teacher_id');
    }

    public function submissions()
    {
        return $this->hasMany(AssignmentSubmission::class);
    }

    public function correctAnswersCount(array $answers): int
    {
        return collect($this->questions ?? [])
            ->values()
            ->filter(function ($question, $index) use ($answers) {
                $expected = trim(mb_strtolower((string) data_get($question, 'answer', '')));
                $actual = trim(mb_strtolower((string) ($answers[$index] ?? '')));

                return $expected !== '' && $actual === $expected;
            })
            ->count();
    }
}
