<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ── Subjects ──────────────────────────────────────────
        Schema::create('subjects', function (Blueprint $table) {
            $table->id();
            $table->string('code');                    // e.g. IT101
            $table->string('name');                    // e.g. Introduction to Programming
            $table->text('description')->nullable();
            $table->decimal('units_lec', 3, 1)->default(0); // lecture units
            $table->decimal('units_lab', 3, 1)->default(0); // lab units
            $table->enum('program_type', ['shs', 'college'])->default('college');
            $table->string('course')->nullable();      // e.g. BS Information Technology
            $table->string('year_level')->nullable();  // e.g. 1, 2, 3, 4
            $table->string('strand')->nullable();      // for SHS
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // ── Sections ──────────────────────────────────────────
        Schema::create('sections', function (Blueprint $table) {
            $table->id();
            $table->string('name');                    // e.g. BSIT 3A
            $table->string('course')->nullable();      // e.g. BS Information Technology
            $table->string('year_level')->nullable();  // e.g. 3
            $table->enum('program_type', ['shs', 'college'])->default('college');
            $table->string('strand')->nullable();      // for SHS
            $table->string('school_year');             // e.g. 2024-2025
            $table->enum('semester', ['1st', '2nd', 'summer']);
            $table->integer('max_students')->default(40);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // ── Section Subjects (subject schedule per section) ───
        Schema::create('section_subjects', function (Blueprint $table) {
            $table->id();
            $table->foreignId('section_id')->constrained()->onDelete('cascade');
            $table->foreignId('subject_id')->constrained()->onDelete('cascade');
            $table->foreignId('teacher_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('day')->nullable();         // e.g. MWF, TTH
            $table->string('time_start')->nullable();  // e.g. 08:00
            $table->string('time_end')->nullable();    // e.g. 09:00
            $table->string('room')->nullable();        // e.g. Room 101
            $table->timestamps();

            $table->unique(['section_id', 'subject_id']); // no duplicate subject per section
        });

        // ── Section Students (student enrollment per section) ─
        Schema::create('section_students', function (Blueprint $table) {
            $table->id();
            $table->foreignId('section_id')->constrained()->onDelete('cascade');
            $table->foreignId('user_id')->constrained()->onDelete('cascade'); // student
            $table->enum('status', ['enrolled', 'dropped', 'completed'])->default('enrolled');
            $table->timestamps();

            $table->unique(['section_id', 'user_id']); // student can only be in one section once
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('section_students');
        Schema::dropIfExists('section_subjects');
        Schema::dropIfExists('sections');
        Schema::dropIfExists('subjects');
    }
};