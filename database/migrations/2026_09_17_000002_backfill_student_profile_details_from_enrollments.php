<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // This is a production data backfill. Fresh SQLite test databases have no
        // legacy enrollment data, and older SQLite schemas may not have these columns.
        if (DB::getDriverName() === 'sqlite') {
            return;
        }

        if (!Schema::hasTable('students') || !Schema::hasTable('enrollment_applications')) {
            return;
        }

        $columns = [
            'father_name',
            'father_occupation',
            'mother_name',
            'mother_occupation',
            'prev_school',
            'prev_school_address',
            'student_type',
            'academic_status',
        ];
        $columns = array_values(array_filter($columns, fn (string $column) =>
            Schema::hasColumn('students', $column)
            && Schema::hasColumn('enrollment_applications', $column)
        ));

        if ($columns === []) {
            return;
        }

        $updates = [];
        foreach ($columns as $column) {
            $updates["students.{$column}"] = DB::raw("COALESCE(students.{$column}, enrollment_applications.{$column})");
        }

        DB::table('students')
            ->join('enrollment_applications', 'enrollment_applications.user_id', '=', 'students.user_id')
            ->where(function ($query) use ($columns) {
                foreach ($columns as $index => $column) {
                    $method = $index === 0 ? 'whereNull' : 'orWhereNull';
                    $query->{$method}("students.{$column}");
                }
            })
            ->update($updates);
    }

    public function down(): void
    {
        // No rollback: this migration copies existing enrollment data into student profiles.
    }
};
