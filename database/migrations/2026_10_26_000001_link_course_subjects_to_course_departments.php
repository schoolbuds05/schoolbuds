<?php

use App\Models\Course;
use App\Models\Subject;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        $courseByScope = [];
        $courses = Course::query()
            ->where('program_type', 'college')
            ->get(['name', 'acronym', 'department_id']);

        foreach ($courses as $course) {
            if ($course->acronym) {
                $courseByScope[$course->acronym] ??= $course;
            }
            $courseByScope[$course->name] = $course;
        }

        Subject::query()
            ->where('program_type', 'college')
            ->whereNotNull('course')
            ->orderBy('id')
            ->chunkById(200, function ($subjects) use ($courseByScope): void {
                foreach ($subjects as $subject) {
                    $course = $courseByScope[$subject->course] ?? null;

                    if ($course && (int) $subject->department_id !== (int) $course->department_id) {
                        $subject->update(['department_id' => $course->department_id]);
                    }
                }
            });
    }

    public function down(): void
    {
        // The previous subject ownership cannot be restored after syncing to course departments.
    }
};
