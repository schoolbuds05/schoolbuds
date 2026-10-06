<?php

namespace Tests\Feature;

use App\Models\Student;
use App\Models\StudentReward;
use App\Models\AcademicTerm;
use App\Models\User;
use App\Services\PointsService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class PointsAwardVisibilityTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('students', function (Blueprint $table): void {
            $table->id();
            $table->string('student_id');
            $table->string('first_name');
            $table->string('last_name');
            $table->string('email');
            $table->string('gender');
            $table->string('grade_level');
            $table->string('section');
            $table->string('school_year')->nullable();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->timestamps();
        });

        Schema::create('student_rewards', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('student_id');
            $table->unsignedBigInteger('awarded_by_id')->nullable();
            $table->string('source');
            $table->string('source_key');
            $table->string('category');
            $table->string('title');
            $table->text('description')->nullable();
            $table->integer('points');
            $table->string('school_year')->nullable();
            $table->string('semester')->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();
        });

        Schema::create('academic_terms', function (Blueprint $table): void {
            $table->id();
            $table->string('school_year');
            $table->string('semester');
            $table->timestamps();
        });
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('student_rewards');
        Schema::dropIfExists('academic_terms');
        Schema::dropIfExists('students');

        parent::tearDown();
    }

    public function test_manual_award_without_school_year_is_visible_in_student_summary(): void
    {
        $registrar = User::factory()->make(['role' => 'registrar']);
        $student = Student::create([
            'student_id' => 'STU-1001',
            'first_name' => 'Example',
            'last_name' => 'Student',
            'email' => 'student@example.com',
            'gender' => 'female',
            'grade_level' => '1',
            'section' => 'A',
            'school_year' => '2025-2026',
            'user_id' => null,
        ]);
        AcademicTerm::create([
            'school_year' => '2025-2026',
            'semester' => '2nd',
        ]);

        $this->actingAs($registrar)
            ->post(route('registrar.points.store'), [
                'student_id' => $student->id,
                'source' => 'donations',
                'points' => 12,
                'title' => 'Donation points',
            ])
            ->assertRedirect(route('registrar.points.index'))
            ->assertSessionHasNoErrors();

        $reward = StudentReward::firstOrFail();

        $this->assertSame('2025-2026', $reward->school_year);
        $this->assertSame('2nd', $reward->semester);
        $this->assertSame(12, app(PointsService::class)->summaryFor($student, '2025-2026')['points']);
    }
}