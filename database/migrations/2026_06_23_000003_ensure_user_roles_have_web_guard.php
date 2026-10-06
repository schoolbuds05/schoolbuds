<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        foreach (['admin', 'registrar', 'faculty', 'staff', 'student', 'parent'] as $role) {
            $exists = DB::table('roles')
                ->where('name', $role)
                ->where('guard_name', 'web')
                ->exists();

            if (!$exists) {
                DB::table('roles')->insert([
                    'name' => $role,
                    'guard_name' => 'web',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        DB::table('roles')
            ->whereIn('name', ['admin', 'registrar', 'faculty', 'staff', 'student', 'parent'])
            ->where('guard_name', 'web')
            ->delete();
    }
};
