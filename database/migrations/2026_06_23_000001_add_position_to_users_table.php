<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'position')) {
                $table->string('position')->nullable()->after('role');
            }
        });

        DB::table('users')->where('role', 'head_teacher')->update([
            'role' => 'faculty',
            'position' => 'head_teacher',
        ]);

        DB::table('users')->where('role', 'dean')->update([
            'role' => 'faculty',
            'position' => 'dean',
        ]);

        DB::table('users')->where('role', 'librarian')->update([
            'role' => 'staff',
            'position' => 'librarian',
        ]);

        DB::table('users')->where('role', 'property_custodian')->update([
            'role' => 'staff',
            'position' => 'property_custodian',
        ]);
    }

    public function down(): void
    {
        DB::table('users')->where('role', 'faculty')->where('position', 'head_teacher')->update([
            'role' => 'head_teacher',
            'position' => null,
        ]);

        DB::table('users')->where('role', 'faculty')->where('position', 'dean')->update([
            'role' => 'dean',
            'position' => null,
        ]);

        DB::table('users')->where('role', 'staff')->where('position', 'librarian')->update([
            'role' => 'librarian',
            'position' => null,
        ]);

        DB::table('users')->where('role', 'staff')->where('position', 'property_custodian')->update([
            'role' => 'property_custodian',
            'position' => null,
        ]);

        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'position')) {
                $table->dropColumn('position');
            }
        });
    }
};
