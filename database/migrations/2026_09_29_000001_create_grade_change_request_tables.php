<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('grade_change_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('grade_submission_id')->constrained()->cascadeOnDelete();
            $table->foreignId('teacher_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('status', 32)->default('chair_review');
            $table->text('reason');
            $table->json('changes');
            $table->foreignId('chair_reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('chair_reviewed_at')->nullable();
            $table->text('chair_note')->nullable();
            $table->foreignId('registrar_reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('registrar_reviewed_at')->nullable();
            $table->text('registrar_note')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'created_at']);
        });

        Schema::create('grade_change_request_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('grade_change_request_id')->constrained()->cascadeOnDelete();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action', 48);
            $table->string('from_status', 32)->nullable();
            $table->string('to_status', 32);
            $table->text('note')->nullable();
            $table->json('changes_snapshot');
            $table->timestamp('created_at')->useCurrent();

            $table->index(['grade_change_request_id', 'created_at'], 'grade_change_events_request_created_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('grade_change_request_events');
        Schema::dropIfExists('grade_change_requests');
    }
};