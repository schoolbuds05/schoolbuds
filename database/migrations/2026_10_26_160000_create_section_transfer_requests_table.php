<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('section_transfer_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('from_section_id')->constrained('sections')->cascadeOnDelete();
            $table->foreignId('to_section_id')->constrained('sections')->cascadeOnDelete();
            $table->foreignId('requested_by')->constrained('users')->cascadeOnDelete();
            $table->text('reason');
            $table->string('status', 20)->default('pending')->index();
            $table->text('registrar_remarks')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();
            $table->index(['from_section_id', 'status']);
            $table->index(['to_section_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('section_transfer_requests');
    }
};
