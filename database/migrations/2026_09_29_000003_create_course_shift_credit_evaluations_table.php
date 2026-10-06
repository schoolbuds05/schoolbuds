<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('course_shift_credit_evaluations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('course_shift_request_id')->constrained()->cascadeOnDelete();
            $table->string('source_subject_code', 50);
            $table->string('source_subject_name');
            $table->foreignId('target_subject_id')->nullable()->constrained('subjects')->nullOnDelete();
            $table->enum('decision', ['credited', 'not_credited']);
            $table->text('remarks')->nullable();
            $table->foreignId('evaluated_by')->constrained('users')->restrictOnDelete();
            $table->timestamp('evaluated_at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('course_shift_credit_evaluations');
    }
};