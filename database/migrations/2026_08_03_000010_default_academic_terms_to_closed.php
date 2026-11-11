<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE academic_terms MODIFY is_active TINYINT(1) NOT NULL DEFAULT 0');
        } else {
            Schema::table('academic_terms', function (Blueprint $table) {
                $table->boolean('is_active')->default(false)->nullable(false)->change();
            });
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE academic_terms MODIFY is_active TINYINT(1) NOT NULL DEFAULT 1');
        } else {
            Schema::table('academic_terms', function (Blueprint $table) {
                $table->boolean('is_active')->default(true)->nullable(false)->change();
            });
        }
    }
};
