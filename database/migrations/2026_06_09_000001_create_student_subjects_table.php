<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('student_subjects', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('subject_id')->constrained()->cascadeOnDelete();
            $table->foreignId('section_id')->nullable()->constrained()->nullOnDelete();
            $table->enum('status', ['enrolled', 'dropped', 'completed'])->default('enrolled');
            $table->text('drop_reason')->nullable();
            $table->timestamp('dropped_at')->nullable();
            $table->foreignId('dropped_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['user_id', 'subject_id', 'section_id']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('student_subjects');
    }
};
