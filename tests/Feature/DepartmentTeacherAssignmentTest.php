<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DepartmentTeacherAssignmentTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_create_a_department_without_selecting_a_teacher(): void
    {
        $admin = User::factory()->create([
            'role' => User::ROLE_ADMIN,
            'position' => null,
        ]);
        $admin->assignRole(User::ROLE_ADMIN);

        $response = $this->actingAs($admin)->post('/admin/departments', [
            'name' => 'Information Technology',
            'code' => 'ITECH',
            'teacher_ids' => [''],
            'is_active' => '1',
        ]);

        $response->assertRedirect();
        $response->assertSessionHasNoErrors();
        $this->assertDatabaseHas('departments', [
            'name' => 'Information Technology',
            'code' => 'ITECH',
        ]);
    }

    public function test_admin_can_assign_teachers_to_a_department(): void
    {
        $admin = User::factory()->create([
            'role' => User::ROLE_ADMIN,
            'position' => null,
        ]);
        $admin->assignRole(User::ROLE_ADMIN);

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
        $department = Department::where('code', 'CS')->firstOrFail();
        $this->assertDatabaseHas('users', ['id' => $teacherOne->id, 'department_id' => $department->id]);
        $this->assertDatabaseHas('users', ['id' => $teacherTwo->id, 'department_id' => $department->id]);
    }
}
