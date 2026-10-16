<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('class_assignments', function (Blueprint $table) {
            $table->unsignedSmallInteger('duration_minutes')->nullable();
        });

        Schema::table('assignment_submissions', function (Blueprint $table) {
            $table->timestamp('started_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('assignment_submissions', function (Blueprint $table) {
            $table->dropColumn('started_at');
        });

        Schema::table('class_assignments', function (Blueprint $table) {
            $table->dropColumn('duration_minutes');
        });
    }
};
