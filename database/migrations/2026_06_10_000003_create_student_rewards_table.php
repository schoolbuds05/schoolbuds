<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('student_rewards', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained()->cascadeOnDelete();
            $table->foreignId('awarded_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('section_subject_id')->nullable()->constrained()->nullOnDelete();
            $table->string('category')->default('custom');
            $table->string('title');
            $table->text('description')->nullable();
            $table->integer('points');
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->index(['student_id', 'created_at']);
            $table->index(['awarded_by_id', 'created_at']);
            $table->index('category');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('student_rewards');
    }
};
