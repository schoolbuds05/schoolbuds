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

        foreach ([
            'IT101' => '1st',
            'IT102' => '2nd',
            'IT103' => '1st',
        ] as $code => $semester) {
            DB::table('subjects')
                ->where('code', $code)
                ->whereNull('semester')
                ->update(['semester' => $semester]);
        }
    }

    public function down(): void
    {
        if (!Schema::hasColumn('subjects', 'semester')) {
            return;
        }

        DB::table('subjects')
            ->whereIn('code', ['IT101', 'IT102', 'IT103'])
            ->update(['semester' => null]);
    }
};
