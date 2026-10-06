<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('students', function (Blueprint $table) {
            if (!Schema::hasColumn('students', 'father_name')) {
                $table->string('father_name')->nullable()->after('address');
                $table->string('father_occupation')->nullable()->after('father_name');
                $table->string('mother_name')->nullable()->after('father_occupation');
                $table->string('mother_occupation')->nullable()->after('mother_name');
                $table->string('prev_school')->nullable()->after('mother_occupation');
                $table->string('prev_school_address')->nullable()->after('prev_school');
                $table->string('student_type')->nullable()->after('prev_school_address');
                $table->string('academic_status')->nullable()->after('student_type');
            }
        });
    }

    public function down(): void
    {
        Schema::table('students', function (Blueprint $table) {
            if (Schema::hasColumn('students', 'father_name')) {
                $table->dropColumn([
                    'father_name',
                    'father_occupation',
                    'mother_name',
                    'mother_occupation',
                    'prev_school',
                    'prev_school_address',
                    'student_type',
                    'academic_status',
                ]);
            }
        });
    }
};
