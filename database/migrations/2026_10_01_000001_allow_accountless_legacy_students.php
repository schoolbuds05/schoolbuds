<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('students', function (Blueprint $table) {
            $table->string('email')->nullable()->change();
            $table->unsignedBigInteger('user_id')->nullable()->change();
        });

        Schema::table('enrollment_applications', function (Blueprint $table) {
            $table->string('email')->nullable()->change();
            $table->string('password')->nullable()->change();
        });
    }

    public function down(): void
    {
        $hasAccountlessStudents = DB::table('students')
            ->whereNull('email')
            ->orWhereNull('user_id')
            ->exists();
        $hasAccountlessApplications = DB::table('enrollment_applications')
            ->whereNull('email')
            ->orWhereNull('password')
            ->exists();

        if ($hasAccountlessStudents || $hasAccountlessApplications) {
            throw new \RuntimeException('Cannot revert accountless student support while such records exist.');
        }

        Schema::table('students', function (Blueprint $table) {
            $table->string('email')->nullable(false)->change();
            $table->unsignedBigInteger('user_id')->nullable(false)->change();
        });

        Schema::table('enrollment_applications', function (Blueprint $table) {
            $table->string('email')->nullable(false)->change();
            $table->string('password')->nullable(false)->change();
        });
    }
};