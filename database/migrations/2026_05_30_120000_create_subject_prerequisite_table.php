<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('subject_prerequisite', function (Blueprint $table) {
            $table->id();
            $table->foreignId('subject_id')->constrained('subjects')->onDelete('cascade');
            $table->foreignId('prerequisite_id')->constrained('subjects')->onDelete('cascade');
            $table->timestamps();

            $table->unique(['subject_id', 'prerequisite_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('subject_prerequisite');
    }
};
