<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('grade_submissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('school_class_id')->constrained()->cascadeOnDelete();
            $table->foreignId('teacher_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('school_year');
            $table->string('quarter', 1);
            $table->string('status', 32)->default('draft');
            $table->unsignedInteger('revision')->default(1);
            $table->json('grades');
            $table->timestamp('submitted_at')->nullable();
            $table->foreignId('chair_reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('chair_reviewed_at')->nullable();
            $table->text('chair_note')->nullable();
            $table->foreignId('registrar_reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('registrar_reviewed_at')->nullable();
            $table->text('registrar_note')->nullable();
            $table->timestamp('finalized_at')->nullable();
            $table->timestamps();

            $table->unique(['school_class_id', 'school_year', 'quarter'], 'grade_submission_sheet_unique');
            $table->index(['status', 'submitted_at']);
        });

        Schema::create('grade_submission_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('grade_submission_id')->constrained()->cascadeOnDelete();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action', 48);
            $table->string('from_status', 32)->nullable();
            $table->string('to_status', 32);
            $table->unsignedInteger('revision');
            $table->text('note')->nullable();
            $table->json('grade_snapshot');
            $table->timestamp('created_at')->useCurrent();

            $table->index(['grade_submission_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('grade_submission_events');
        Schema::dropIfExists('grade_submissions');
    }
};
