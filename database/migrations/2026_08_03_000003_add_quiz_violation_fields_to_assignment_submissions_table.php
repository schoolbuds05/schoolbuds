<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('assignment_submissions', function (Blueprint $table) {
            $table->unsignedInteger('violation_count')->default(0)->after('plagiarism_score');
            $table->json('violations')->nullable()->after('violation_count');
            $table->timestamp('auto_submitted_at')->nullable()->after('submitted_at');
            $table->timestamp('flagged_at')->nullable()->after('auto_submitted_at');
        });
    }

    public function down(): void
    {
        Schema::table('assignment_submissions', function (Blueprint $table) {
            $table->dropColumn(['violation_count', 'violations', 'auto_submitted_at', 'flagged_at']);
        });
    }
};
