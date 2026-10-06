<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('class_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('section_subject_id')->constrained()->cascadeOnDelete();
            $table->foreignId('teacher_id')->constrained('users')->cascadeOnDelete();
            $table->string('type')->default('assignment');
            $table->string('title');
            $table->text('instructions')->nullable();
            $table->decimal('points_possible', 8, 2)->default(100);
            $table->dateTime('due_at')->nullable();
            $table->boolean('allow_file_upload')->default(false);
            $table->json('questions')->nullable();
            $table->string('status')->default('published');
            $table->timestamps();

            $table->index(['section_subject_id', 'status', 'due_at']);
            $table->index(['teacher_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('class_assignments');
    }
};
