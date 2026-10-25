<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Course extends Model
{
    protected static function booted(): void
    {
        static::saving(function (Course $model): void {
            if ($model->department_id && Department::query()->whereKey($model->department_id)
                ->where('type', Department::TYPE_GENERAL)->exists()) {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'department_id' => 'General subject departments cannot own courses or sections.',
                ]);
            }
        });
    }

    protected $fillable = [
        'name', 'acronym', 'description', 'program_type', 'department_id', 'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function department()
    {
        return $this->belongsTo(Department::class);
    }
}
