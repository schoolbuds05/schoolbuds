<?php

namespace App\Policies;

use App\Models\Student;
use App\Models\User;

class StudentPolicy
{
    public function viewRecords(User $user, Student $student): bool
    {
        if (in_array($user->role, [User::ROLE_ADMIN, User::ROLE_REGISTRAR], true)) {
            return true;
        }

        $userId = $user->getKey();

        return $userId !== null && (
            (string) $student->user_id === (string) $userId
            || (string) $student->parent_user_id === (string) $userId
        );
    }
}
