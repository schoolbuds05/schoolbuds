<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('enrollment_applications', function (Blueprint $table) {
            if (Schema::hasIndex('enrollment_applications', 'enrollment_applications_email_unique')) {
                $table->dropUnique('enrollment_applications_email_unique');
            }

            if (!Schema::hasIndex('enrollment_applications', 'enrollment_applications_email_index')) {
                $table->index('email');
            }
        });
    }

    public function down(): void
    {
        Schema::table('enrollment_applications', function (Blueprint $table) {
            if (Schema::hasIndex('enrollment_applications', 'enrollment_applications_email_index')) {
                $table->dropIndex('enrollment_applications_email_index');
            }

            if (!Schema::hasIndex('enrollment_applications', 'enrollment_applications_email_unique')) {
                $table->unique('email');
            }
        });
    }
};
