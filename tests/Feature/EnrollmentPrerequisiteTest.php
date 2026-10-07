<?php

namespace Tests\Feature;

use App\Models\Student;
use App\Models\StudentSubject;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class EnrollmentPrerequisiteTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('users', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->string('email')->unique();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password');
            $table->string('remember_token')->nullable();
            $table->timestamps();
        });

        Schema::create('subjects', function (Blueprint $table): void {
            $table->id();
            $table->string('code');
            $table->string('name');
            $table->text('description')->nullable();
            $table->decimal('units_lec', 3, 1)->default(0);
            $table->decimal('units_lab', 3, 1)->default(0);
            $table->string('program_type')->default('college');
            $table->string('course')->nullable();
            $table->string('year_level')->nullable();
            $table->string('strand')->nullable();
            $table->string('semester')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('sections', function (Blueprint $table): void {
            $table->id();
            $table->string('school_year');
            $table->string('semester');
            $table->boolean('is_active')->default(true);
        });

        Schema::create('section_subjects', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('section_id');
            $table->unsignedBigInteger('subject_id');
        });

        Schema::create('subject_prerequisite', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('subject_id');
            $table->unsignedBigInteger('prerequisite_id');
            $table->timestamps();
        });

        Schema::create('students', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->string('student_id');
            $table->string('first_name');
            $table->string('last_name');
            $table->string('email');
            $table->string('gender');
            $table->string('grade_level');
            $table->string('section');
            $table->string('school_year');
            $table->timestamps();
        });

        Schema::create('student_subjects', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('subject_id');
            $table->unsignedBigInteger('section_id')->nullable();
            $table->string('status');
            $table->text('drop_reason')->nullable();
            $table->timestamp('dropped_at')->nullable();
            $table->unsignedBigInteger('dropped_by')->nullable();
            $table->timestamps();
        });

        Schema::create('enrollment_applications', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('school_year');
            $table->string('semester');
            $table->string('status');
            $table->json('subject_ids')->nullable();
            $table->timestamps();
        });

        Schema::create('academic_terms', function (Blueprint $table): void {
            $table->id();
            $table->string('school_year');
            $table->string('semester');
            $table->boolean('is_active')->default(true);
            $table->timestamp('grade_finalization_deadline')->nullable();
            $table->timestamp('enrollment_opens_at')->nullable();
            $table->timestamp('enrollment_closes_at')->nullable();
            $table->timestamps();
        });
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('student_subjects');
        Schema::dropIfExists('students');
        Schema::dropIfExists('subject_prerequisite');
        Schema::dropIfExists('section_subjects');
        Schema::dropIfExists('sections');
        Schema::dropIfExists('subjects');
        Schema::dropIfExists('academic_terms');
        Schema::dropIfExists('enrollment_applications');
        Schema::dropIfExists('users');

        parent::tearDown();
    }

    public function test_prerequisite_is_unmet_when_student_record_is_missing(): void
    {
        $user = User::factory()->create();
        [$subject, $prerequisite] = $this->createSubjectWithPrerequisite();

        $this->actingAs($user)
            ->postJson('/api/enrollment/prerequisites', ['subject_ids' => [$subject->id]])
            ->assertOk()
            ->assertJsonPath('subjects.0.unmet_prerequisites.0.code', $prerequisite->code);
    }

    public function test_completed_prerequisite_is_not_reported_as_unmet(): void
    {
        $user = User::factory()->create();
        [$subject, $prerequisite] = $this->createSubjectWithPrerequisite();
        Student::create([
            'student_id' => 'STU-1001',
            'first_name' => 'Example',
            'last_name' => 'Student',
            'email' => $user->email,
            'gender' => 'female',
            'grade_level' => '1',
            'section' => 'A',
            'school_year' => '2025-2026',
            'user_id' => $user->id,
        ]);
        StudentSubject::create([
            'user_id' => $user->id,
            'subject_id' => $prerequisite->id,
            'status' => 'completed',
        ]);

        $this->actingAs($user)
            ->postJson('/api/enrollment/prerequisites', ['subject_ids' => [$subject->id]])
            ->assertOk()
            ->assertJsonPath('subjects.0.unmet_prerequisites', []);
    }

    public function test_enrollment_is_rejected_when_prerequisite_history_cannot_be_verified(): void
    {
        $user = User::factory()->create();
        [$subject] = $this->createSubjectWithPrerequisite();
        \App\Models\AcademicTerm::create([
            'school_year' => '2025-2026',
            'semester' => '2nd',
            'is_active' => true,
        ]);

        $this->actingAs($user)
            ->postJson('/api/enrollment', [
                'first_name' => 'Example',
                'last_name' => 'Student',
                'student_type' => 'new_student',
                'academic_status' => 'Irregular',
                'program_type' => 'college',
                'course' => 'Information Technology',
                'year_level' => '2',
                'subject_ids' => [$subject->id],
                'school_year' => '2025-2026',
                'semester' => '2nd',
            ])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Prerequisite completion cannot be verified because your student record is unavailable. Please contact the Registrar.');
    }

    private function createSubjectWithPrerequisite(): array
    {
        $prerequisite = Subject::create([
            'code' => 'SUBJ-101',
            'name' => 'Prerequisite Subject',
            'program_type' => 'college',
            'semester' => '1st',
        ]);
        $subject = Subject::create([
            'code' => 'SUBJ-201',
            'name' => 'Advanced Subject',
            'program_type' => 'college',
            'semester' => '2nd',
        ]);
        $subject->prerequisites()->attach($prerequisite->id);

        return [$subject, $prerequisite];
    }
}
