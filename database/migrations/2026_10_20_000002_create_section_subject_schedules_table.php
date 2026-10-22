<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('section_subject_schedules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('section_subject_id')->constrained()->onDelete('cascade');
            $table->string('day');
            $table->string('time_start')->nullable();
            $table->string('time_end')->nullable();
            $table->string('room')->nullable();
            $table->timestamps();
        });

        DB::table('section_subjects')
            ->whereNotNull('day')
            ->get()
            ->each(function ($subject) {
                DB::table('section_subject_schedules')->insert([
                    'section_subject_id' => $subject->id,
                    'day' => trim($subject->day),
                    'time_start' => $subject->time_start,
                    'time_end' => $subject->time_end,
                    'room' => $subject->room,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            });
    }

    public function down(): void
    {
        Schema::dropIfExists('section_subject_schedules');
    }
};
