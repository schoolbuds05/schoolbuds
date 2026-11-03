<?php

namespace Tests\Feature;

use App\Models\EnrollmentApplication;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EnrollmentImportedStudentClaimTest extends TestCase
{
    use RefreshDatabase;

    public function test_student_can_link_an_imported_record_with_matching_name_and_birthdate(): void
    {
        $user = User::factory()->create(['role' => User::ROLE_STUDENT]);
        $student = Student::create([
            'student_id' => 'ST-CLAIM-001',
            'first_name' => 'Imported',
            'last_name' => 'Student',
            'email' => null,
            'birthdate' => '2004-03-15',
            'gender' => 'female',
            'grade_level' => '2',
            'section' => 'A',
            'school_year' => '2025-2026',
            'user_id' => null,
        ]);
        $application = EnrollmentApplication::create([
            'email' => null,
            'password' => null,
            'first_name' => 'Imported',
            'last_name' => 'Student',
            'id_no' => $student->student_id,
            'program_type' => 'college',
            'school_year' => '2025-2026',
            'semester' => '1st',
            'status' => 'approved',
            'user_id' => null,
        ]);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/enrollment/claim', [
                'id_no' => $student->student_id,
                'first_name' => 'Imported',
                'last_name' => 'Student',
                'birthdate' => '2004-03-15',
            ])
            ->assertOk()
            ->assertJsonPath('message', 'Student record verified and linked to your account.');

        $this->assertDatabaseHas('students', [
            'id' => $student->id,
            'user_id' => $user->id,
        ]);
        $this->assertDatabaseHas('enrollment_applications', [
            'id' => $application->id,
            'user_id' => $user->id,
        ]);

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/enrollment/lookup?id_no='.$student->student_id)
            ->assertOk()
            ->assertJsonPath('student_id', $student->student_id);
    }

    public function test_student_cannot_claim_an_imported_record_with_wrong_birthdate(): void
    {
        $user = User::factory()->create(['role' => User::ROLE_STUDENT]);
        $student = Student::create([
            'student_id' => 'ST-CLAIM-002',
            'first_name' => 'Imported',
            'last_name' => 'Student',
            'email' => null,
            'birthdate' => '2004-03-15',
            'gender' => 'female',
            'grade_level' => '2',
            'section' => 'A',
            'school_year' => '2025-2026',
            'user_id' => null,
        ]);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/enrollment/claim', [
                'id_no' => $student->student_id,
                'first_name' => 'Imported',
                'last_name' => 'Student',
                'birthdate' => '2004-03-16',
            ])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'The student details did not match an unlinked record. Check the ID, name, and date of birth or contact the registrar.');

        $this->assertDatabaseHas('students', [
            'id' => $student->id,
            'user_id' => null,
        ]);
    }
}
