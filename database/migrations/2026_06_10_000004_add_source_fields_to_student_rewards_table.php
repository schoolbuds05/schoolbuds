<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('student_rewards', function (Blueprint $table) {
            $table->string('source')->default('manual')->after('section_subject_id');
            $table->string('source_key')->nullable()->after('source');
            $table->string('school_year')->nullable()->after('points');
            $table->string('semester')->nullable()->after('school_year');
            $table->unique(['student_id', 'source_key']);
            $table->index(['student_id', 'source', 'school_year', 'semester'], 'student_rewards_period_source_idx');
        });
    }

    public function down(): void
    {
        Schema::table('student_rewards', function (Blueprint $table) {
            $table->dropIndex('student_rewards_period_source_idx');
            $table->dropUnique(['student_id', 'source_key']);
            $table->dropColumn(['source', 'source_key', 'school_year', 'semester']);
        });
    }
};
