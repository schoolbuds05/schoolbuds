<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('students') || !Schema::hasTable('enrollment_applications')) {
            return;
        }

        DB::table('students')
            ->join('enrollment_applications', 'enrollment_applications.user_id', '=', 'students.user_id')
            ->where(function ($query) {
                $query->whereNull('students.father_name')
                    ->orWhereNull('students.father_occupation')
                    ->orWhereNull('students.mother_name')
                    ->orWhereNull('students.mother_occupation')
                    ->orWhereNull('students.prev_school')
                    ->orWhereNull('students.prev_school_address')
                    ->orWhereNull('students.student_type')
                    ->orWhereNull('students.academic_status');
            })
            ->update([
                'students.father_name' => DB::raw('COALESCE(students.father_name, enrollment_applications.father_name)'),
                'students.father_occupation' => DB::raw('COALESCE(students.father_occupation, enrollment_applications.father_occupation)'),
                'students.mother_name' => DB::raw('COALESCE(students.mother_name, enrollment_applications.mother_name)'),
                'students.mother_occupation' => DB::raw('COALESCE(students.mother_occupation, enrollment_applications.mother_occupation)'),
                'students.prev_school' => DB::raw('COALESCE(students.prev_school, enrollment_applications.prev_school)'),
                'students.prev_school_address' => DB::raw('COALESCE(students.prev_school_address, enrollment_applications.prev_school_address)'),
                'students.student_type' => DB::raw('COALESCE(students.student_type, enrollment_applications.student_type)'),
                'students.academic_status' => DB::raw('COALESCE(students.academic_status, enrollment_applications.academic_status)'),
            ]);
    }

    public function down(): void
    {
        // No rollback: this migration copies existing enrollment data into student profiles.
    }
};
