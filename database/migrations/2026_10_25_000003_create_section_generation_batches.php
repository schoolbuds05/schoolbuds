<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('section_generation_mutex', function (Blueprint $table) {
            $table->unsignedInteger('id')->primary();
        });
        DB::table('section_generation_mutex')->insert(['id' => 1]);
        Schema::create('section_generation_batches', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->json('input');
            $table->json('plan');
            $table->json('section_ids')->nullable();
            $table->timestamp('expires_at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('section_generation_batches');
        Schema::dropIfExists('section_generation_mutex');
    }
};
