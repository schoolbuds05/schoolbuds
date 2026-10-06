<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Department extends Model
{
    protected $fillable = ['name', 'code', 'chair_user_id', 'is_active'];

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
