<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('enrollment_applications', function (Blueprint $table) {
            $table->id();

            // ── Account (used to create student user on approval) ──
            $table->string('email')->unique();
            $table->string('password');

            // ── Personal info ──
            $table->string('first_name');
            $table->string('last_name');
            $table->string('middle_name')->nullable();
            $table->date('birthdate')->nullable();
            $table->string('gender')->nullable();
            $table->string('religion')->nullable();
            $table->string('civil_status')->nullable();
            $table->string('place_of_birth')->nullable();
            $table->string('contact_number')->nullable();
            $table->text('address')->nullable();

            // ── Family info ──
            $table->string('father_name')->nullable();
            $table->string('father_occupation')->nullable();
            $table->string('mother_name')->nullable();
            $table->string('mother_occupation')->nullable();

            // ── Previous school ──
            $table->string('prev_school')->nullable();
            $table->string('prev_school_address')->nullable();

            // ── Student classification ──
            $table->enum('student_type', ['new_student', 'old_student', 'transferee', 'shiftee', 'returnee'])->nullable();
            $table->enum('academic_status', ['Regular', 'Irregular'])->nullable();
            $table->string('shiftee_from')->nullable();
            $table->string('shiftee_to')->nullable();
            $table->string('id_no')->nullable();

            // ── Program info ──
            $table->enum('program_type', ['shs', 'college'])->default('college');
            $table->enum('grade_level', ['11', '12'])->nullable();
            $table->enum('strand', ['STEM', 'ABM', 'HUMSS', 'TVL', 'GAS'])->nullable();
            $table->string('course')->nullable();
            $table->enum('year_level', ['1', '2', '3', '4'])->nullable();

            // ── Enrollment period ──
            $table->string('school_year')->default('2024-2025');
            $table->enum('semester', ['1st', '2nd', 'summer'])->default('1st');

            // ── Review ──
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->text('remarks')->nullable();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('enrollment_applications');
    }
};