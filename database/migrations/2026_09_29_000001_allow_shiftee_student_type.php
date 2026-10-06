<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE enrollment_applications MODIFY student_type ENUM('new_student', 'old_student', 'transferee', 'shiftee', 'returnee') NULL");
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement("UPDATE enrollment_applications SET student_type = 'transferee' WHERE student_type = 'shiftee'");
            DB::statement("ALTER TABLE enrollment_applications MODIFY student_type ENUM('new_student', 'old_student', 'transferee', 'returnee') NULL");
        }
    }
};