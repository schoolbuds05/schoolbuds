<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
{
    Schema::create('school_classes', function (Blueprint $table) {
        $table->id();
        $table->string('name');
        $table->string('subject');
        $table->string('grade_level');
        $table->string('section');
        $table->string('school_year');
        $table->foreignId('teacher_id')->nullable()->constrained('users')->onDelete('set null');
        $table->string('room')->nullable();
        $table->string('schedule')->nullable();
        $table->timestamps();
    });
}

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('school_classes');
    }
};
