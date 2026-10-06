<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private array $generalEducationCodes = ['GE1', 'GE2', 'GE4', 'GE5', 'GE6', 'GE7', 'GE8'];

    public function up(): void
    {
        DB::table('subjects')
            ->where('program_type', 'college')
            ->where('course', 'BS Information Technology')
            ->whereIn('code', $this->generalEducationCodes)
            ->update(['course' => null]);
    }

    public function down(): void
    {
        DB::table('subjects')
            ->where('program_type', 'college')
            ->whereNull('course')
            ->whereIn('code', $this->generalEducationCodes)
            ->update(['course' => 'BS Information Technology']);
    }
};