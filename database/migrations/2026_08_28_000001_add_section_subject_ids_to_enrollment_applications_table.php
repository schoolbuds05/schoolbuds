<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('enrollment_applications', function (Blueprint $table) {
            if (!Schema::hasColumn('enrollment_applications', 'section_subject_ids')) {
                $table->json('section_subject_ids')->nullable()->after('subject_ids');
            }
        });
    }

    public function down(): void
    {
        Schema::table('enrollment_applications', function (Blueprint $table) {
            if (Schema::hasColumn('enrollment_applications', 'section_subject_ids')) {
                $table->dropColumn('section_subject_ids');
            }
        });
    }
};
