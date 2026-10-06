<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('subjects', 'semester')) {
            return;
        }

        DB::table('subjects')
            ->where('program_type', 'college')
            ->where('year_level', '1')
            ->whereNull('semester')
            ->update(['semester' => '1st']);
    }

    public function down(): void
    {
        if (!Schema::hasColumn('subjects', 'semester')) {
            return;
        }

        DB::table('subjects')
            ->where('program_type', 'college')
            ->where('year_level', '1')
            ->where('semester', '1st')
            ->update(['semester' => null]);
    }
};
