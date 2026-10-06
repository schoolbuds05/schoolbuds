<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE students MODIFY user_id BIGINT UNSIGNED NULL');
    }

    public function down(): void
    {
        if (DB::table('students')->whereNull('user_id')->exists()) {
            throw new \RuntimeException('Cannot require student accounts while account-less student records exist.');
        }

        DB::statement('ALTER TABLE students MODIFY user_id BIGINT UNSIGNED NOT NULL');
    }
};