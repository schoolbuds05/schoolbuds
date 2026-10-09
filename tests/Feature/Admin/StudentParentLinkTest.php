<?php

namespace Tests\Feature\Admin;

use App\Models\Student;
use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class StudentParentLinkTest extends TestCase
{
    use RefreshDatabase;

    public function test_linking_a_new_parent_email_creates_account_and_sends_setup_link(): void
    {
        Notification::fake();

        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
        $studentUser = User::factory()->create(['role' => User::ROLE_STUDENT]);
        $student = Student::create([
            'student_id' => 'STU-001',
            'first_name' => 'Student',
            'last_name' => 'Example',
            'email' => 'student@example.com',
            'gender' => 'female',
            'grade_level' => 'Grade 1',
            'section' => 'A',
            'school_year' => '2026-2027',
            'user_id' => $studentUser->id,
        ]);

        $response = $this->actingAs($admin)->put(
            route('admin.students.parent.update', $student),
            ['parent_email' => 'new-parent@example.com']
        );

        $parent = User::where('email', 'new-parent@example.com')->firstOrFail();

        $response
            ->assertSessionHasNoErrors()
            ->assertSessionHas('status', 'Parent account created and linked. A password setup link was sent to new-parent@example.com.');

        $this->assertSame(User::ROLE_PARENT, $parent->role);
        $this->assertTrue($parent->hasRole(User::ROLE_PARENT));
        $this->assertDatabaseHas('students', [
            'id' => $student->id,
            'parent_user_id' => $parent->id,
        ]);
        Notification::assertSentTo($parent, ResetPassword::class);
    }
}
