<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DepartmentTeacherAssignmentTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_assign_teachers_to_a_department(): void
    {
        $admin = User::factory()->create([
            'role' => User::ROLE_ADMIN,
            'position' => null,
        ]);
        $admin->assignRole(User::ROLE_ADMIN);

        $department = Department::create([
            'name' => 'Computer Science',
            'code' => 'CS',
            'is_active' => true,
        ]);

        $teacherOne = User::factory()->create([
            'role' => User::ROLE_FACULTY,
            'position' => User::POSITION_TEACHER,
            'department_id' => null,
            'department' => null,
        ]);
        $teacherTwo = User::factory()->create([
            'role' => User::ROLE_FACULTY,
            'position' => User::POSITION_TEACHER,
            'department_id' => null,
            'department' => null,
        ]);

        $response = $this->actingAs($admin)->post('/admin/departments', [
            'name' => 'Computer Science',
            'code' => 'CS',
            'teacher_ids' => [$teacherOne->id, $teacherTwo->id],
            'is_active' => '1',
        ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('users', ['id' => $teacherOne->id, 'department_id' => $department->id]);
        $this->assertDatabaseHas('users', ['id' => $teacherTwo->id, 'department_id' => $department->id]);
    }
}
