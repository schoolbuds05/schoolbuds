<?php

namespace Tests\Unit;

use App\Models\Student;
use App\Models\User;
use App\Policies\StudentPolicy;
use Illuminate\Support\Facades\Gate;
use Tests\TestCase;

class StudentPolicyTest extends TestCase
{
    public function test_admin_and_registrar_can_view_student_records(): void
    {
        $policy = new StudentPolicy();
        $student = new Student();
        $student->forceFill(['user_id' => 20, 'parent_user_id' => 30]);

        $this->assertInstanceOf(StudentPolicy::class, Gate::getPolicyFor(Student::class));

        foreach ([User::ROLE_ADMIN, User::ROLE_REGISTRAR] as $role) {
            $user = new User();
            $user->forceFill(['id' => 10, 'role' => $role]);

            $this->assertTrue($policy->viewRecords($user, $student));
        }
    }

    public function test_students_and_their_parents_can_view_linked_records_only(): void
    {
        $policy = new StudentPolicy();
        $student = new Student();
        $student->forceFill(['user_id' => 20, 'parent_user_id' => 30]);

        $studentUser = new User();
        $studentUser->forceFill(['id' => 20, 'role' => User::ROLE_STUDENT]);

        $parentUser = new User();
        $parentUser->forceFill(['id' => 30, 'role' => User::ROLE_PARENT]);

        $otherUser = new User();
        $otherUser->forceFill(['id' => 40, 'role' => User::ROLE_STUDENT]);

        $this->assertTrue($policy->viewRecords($studentUser, $student));
        $this->assertTrue($policy->viewRecords($parentUser, $student));
        $this->assertFalse($policy->viewRecords($otherUser, $student));
    }
}
