<?php

namespace App\Services;

use App\Models\Department;
use App\Models\Section;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class SectionDepartmentAccess
{
    public static function isChair(User $user): bool
    {
        return $user->position === User::POSITION_HEAD_DEPARTMENT
            || $user->role === User::POSITION_HEAD_DEPARTMENT
            || $user->hasRole(User::POSITION_HEAD_DEPARTMENT);
    }

    public static function authorize(User $user, ?Section $section = null): ?Department
    {
        if (! self::isChair($user)) {
            abort_unless(in_array($user->role, ['admin', 'registrar'], true) || $user->hasAnyRole(['admin', 'registrar']), 403);

            return null;
        }

        $department = $user->academicDepartment()->first();
        abort_unless($department?->canManageSections(), 403, 'Only chairs of active course departments can manage sections.');
        if ($section) {
            abort_unless((int) $section->department_id === (int) $department->id, 403, 'You can only manage sections from your department.');
        }

        return $department;
    }

    public static function validateCourse(?Department $department, array $data): void
    {
        if ($department && ($data['program_type'] ?? null) === 'college'
            && ! $department->courses()->where('name', $data['course'] ?? '')->exists()) {
            throw ValidationException::withMessages(['course' => 'Choose a course assigned to your department.']);
        }
    }
}
