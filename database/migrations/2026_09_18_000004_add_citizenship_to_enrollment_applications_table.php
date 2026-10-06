<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('enrollment_applications', function (Blueprint $table) {
            if (!Schema::hasColumn('enrollment_applications', 'citizenship')) {
                $table->string('citizenship')->nullable()->after('civil_status');
            }
        });
    }

    public function down(): void
    {
        Schema::table('enrollment_applications', function (Blueprint $table) {
            if (Schema::hasColumn('enrollment_applications', 'citizenship')) {
                $table->dropColumn('citizenship');
            }
        });
    }
};
