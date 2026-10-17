<?php

namespace Tests\Feature;

use App\Models\Fee;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RegistrarBatchTuitionTest extends TestCase
{
    use RefreshDatabase;

    public function test_registrar_can_post_a_fee_to_multiple_active_students_and_duplicates_are_skipped(): void
    {
        $registrar = User::factory()->create(['role' => User::ROLE_REGISTRAR]);
        $firstStudent = $this->createStudent('STU-001', '1A');
        $secondStudent = $this->createStudent('STU-002', '1A');

        $firstStudent->fees()->create([
            'type' => 'Tuition Fee',
            'amount' => 5000,
            'paid_amount' => 0,
            'status' => 'unpaid',
            'due_date' => '2026-10-30',
            'school_year' => '2026-2027',
            'semester' => '1st',
            'quarter' => null,
        ]);

        $this->actingAs($registrar)
            ->post(route('registrar.tuition.store'), [
                'student_ids' => [$firstStudent->id, $secondStudent->id],
                'type' => 'Tuition Fee',
                'amount' => 5000,
                'due_date' => '2026-10-30',
                'school_year' => '2026-2027',
                'semester' => '1st',
                'quarter' => '',
                'notes' => 'Please pay at the bank, then go to the registrar for confirmation.',
            ])
            ->assertRedirect(route('registrar.tuition.index'))
            ->assertSessionHas('status', 'Posted tuition for 1 student(s). Skipped 1 duplicate fee(s).');

        $this->assertSame(1, Fee::where('student_id', $firstStudent->id)->count());
        $this->assertDatabaseHas('fees', [
            'student_id' => $secondStudent->id,
            'type' => 'Tuition Fee',
            'school_year' => '2026-2027',
            'semester' => '1st',
            'notes' => 'Please pay at the bank, then go to the registrar for confirmation.',
        ]);
    }

    public function test_admin_cannot_access_registrar_only_batch_tuition_page(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);

        $this->actingAs($admin)
            ->get(route('registrar.tuition.index'))
            ->assertRedirect(route('login'));
    }

    private function createStudent(string $studentId, string $section): Student
    {
        $user = User::factory()->create(['role' => User::ROLE_STUDENT]);

        return Student::create([
            'student_id' => $studentId,
            'first_name' => 'Test',
            'last_name' => 'Student',
            'email' => "{$studentId}@example.test",
            'gender' => 'female',
            'grade_level' => '1',
            'section' => $section,
            'school_year' => '2026-2027',
            'status' => 'active',
            'user_id' => $user->id,
        ]);
    }
}
