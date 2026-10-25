<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Department extends Model
{
    public const TYPE_COURSE = 'course';
    public const TYPE_GENERAL = 'general';

    protected $attributes = ['type' => self::TYPE_COURSE];

    protected $fillable = ['name', 'code', 'type', 'chair_user_id', 'is_active'];

    protected static function booted(): void
    {
        static::saving(function (Department $department): void {
            if ($department->type === self::TYPE_GENERAL && $department->exists
                && ($department->courses()->exists() || $department->sections()->exists())) {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'type' => 'Reassign existing courses and sections before changing to a general subject department.',
                ]);
            }
        });
    }

    public function canManageSections(): bool
    {
        return $this->type === self::TYPE_COURSE && $this->is_active;
    }

    public function subjects()
    {
        return $this->hasMany(Subject::class);
    }

    public function sections()
    {
        return $this->hasMany(Section::class);
    }

    protected $casts = ['is_active' => 'boolean'];

    public function chair()
    {
        return $this->belongsTo(User::class, 'chair_user_id');
    }

    public function courses()
    {
        return $this->hasMany(Course::class);
    }

    public function faculty()
    {
        return $this->hasMany(User::class);
    }

    public function teachers()
    {
        return $this->hasMany(User::class)
            ->where('role', User::ROLE_FACULTY)
            ->where(function ($query) {
                $query->whereNull('position')
                    ->orWhere('position', User::POSITION_TEACHER);
            });
    }
}
