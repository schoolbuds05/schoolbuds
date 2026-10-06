<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('users')->where('role', 'teacher')->update(['role' => 'faculty']);

        $teacherRole = DB::table('roles')->where('name', 'teacher')->first();
        $facultyRole = DB::table('roles')->where('name', 'faculty')->first();

        if ($teacherRole && $facultyRole) {
            DB::table('model_has_roles')
                ->where('role_id', $teacherRole->id)
                ->update(['role_id' => $facultyRole->id]);

            DB::table('roles')->where('id', $teacherRole->id)->delete();
        } elseif ($teacherRole) {
            DB::table('roles')->where('id', $teacherRole->id)->update(['name' => 'faculty']);
        }
    }

    public function down(): void
    {
        DB::table('users')->where('role', 'faculty')->update(['role' => 'teacher']);

        $teacherRole = DB::table('roles')->where('name', 'teacher')->first();
        $facultyRole = DB::table('roles')->where('name', 'faculty')->first();

        if ($teacherRole && $facultyRole) {
            DB::table('model_has_roles')
                ->where('role_id', $facultyRole->id)
                ->update(['role_id' => $teacherRole->id]);

            DB::table('roles')->where('id', $facultyRole->id)->delete();
        } elseif ($facultyRole) {
            DB::table('roles')->where('id', $facultyRole->id)->update(['name' => 'teacher']);
        }
    }
};
