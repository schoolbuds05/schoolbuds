<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $classIds = $this->collegeClassIds();

        DB::table('grades')
            ->whereIn('school_class_id', $classIds)
            ->orderBy('id')
            ->chunkById(500, function ($grades): void {
                foreach ($grades as $grade) {
                    if ($grade->score === null) {
                        continue;
                    }

                    $score = $this->gradeFromPercentage((float) $grade->score * 10);
                    DB::table('grades')->where('id', $grade->id)->update([
                        'score' => $score,
                        'remarks' => $this->remark($score),
                    ]);
                }
            });

        DB::table('grade_submissions')
            ->whereIn('school_class_id', $classIds)
            ->orderBy('id')
            ->chunkById(250, function ($submissions): void {
                foreach ($submissions as $submission) {
                    $grades = json_decode($submission->grades, true) ?: [];
                    foreach ($grades as &$line) {
                        if (!array_key_exists('score', $line) || $line['score'] === null) {
                            continue;
                        }
                        $line['score'] = $this->gradeFromPercentage((float) $line['score'] * 10);
                        $line['remarks'] = $this->remark((float) $line['score']);
                    }
                    unset($line);

                    DB::table('grade_submissions')->where('id', $submission->id)->update([
                        'grades' => json_encode($grades),
                    ]);
                }
            });
    }

    public function down(): void
    {
        $classIds = $this->collegeClassIds();

        DB::table('grades')
            ->whereIn('school_class_id', $classIds)
            ->orderBy('id')
            ->chunkById(500, function ($grades): void {
                foreach ($grades as $grade) {
                    if ($grade->score === null) {
                        continue;
                    }
                    $score = $this->tenPointGradeFromCollege((float) $grade->score);
                    DB::table('grades')->where('id', $grade->id)->update([
                        'score' => $score,
                        'remarks' => $this->tenPointRemark($score),
                    ]);
                }
            });

        DB::table('grade_submissions')
            ->whereIn('school_class_id', $classIds)
            ->orderBy('id')
            ->chunkById(250, function ($submissions): void {
                foreach ($submissions as $submission) {
                    $grades = json_decode($submission->grades, true) ?: [];
                    foreach ($grades as &$line) {
                        if (!array_key_exists('score', $line) || $line['score'] === null) {
                            continue;
                        }
                        $line['score'] = $this->tenPointGradeFromCollege((float) $line['score']);
                        $line['remarks'] = $this->tenPointRemark((float) $line['score']);
                    }
                    unset($line);

                    DB::table('grade_submissions')->where('id', $submission->id)->update([
                        'grades' => json_encode($grades),
                    ]);
                }
            });
    }

    private function collegeClassIds()
    {
        return DB::table('school_classes')
            ->join('sections', function ($join) {
                $join->on('sections.name', '=', 'school_classes.section')
                    ->on('sections.year_level', '=', 'school_classes.grade_level')
                    ->on('sections.school_year', '=', 'school_classes.school_year');
            })
            ->join('section_subjects', 'section_subjects.section_id', '=', 'sections.id')
            ->join('subjects', function ($join) {
                $join->on('subjects.id', '=', 'section_subjects.subject_id')
                    ->on('subjects.name', '=', 'school_classes.subject');
            })
            ->where('sections.program_type', 'college')
            ->distinct()
            ->pluck('school_classes.id');
    }

    private function gradeFromPercentage(float $percentage): float
    {
        return match (true) {
            $percentage >= 97 => 1.00,
            $percentage >= 94 => 1.25,
            $percentage >= 91 => 1.50,
            $percentage >= 88 => 1.75,
            $percentage >= 85 => 2.00,
            $percentage >= 82 => 2.25,
            $percentage >= 79 => 2.50,
            $percentage >= 76 => 2.75,
            $percentage >= 75 => 3.00,
            $percentage >= 70 => 4.00,
            default => 5.00,
        };
    }

    private function tenPointGradeFromCollege(float $grade): float
    {
        return match (true) {
            $grade <= 1.00 => 10.00,
            $grade <= 1.25 => 9.50,
            $grade <= 1.50 => 9.20,
            $grade <= 1.75 => 9.00,
            $grade <= 2.00 => 8.50,
            $grade <= 2.25 => 8.30,
            $grade <= 2.50 => 8.00,
            $grade <= 2.75 => 7.70,
            $grade <= 3.00 => 7.50,
            $grade <= 4.00 => 7.00,
            default => 6.99,
        };
    }

    private function remark(float $grade): string
    {
        return match (true) {
            $grade <= 1.50 => 'Outstanding',
            $grade <= 2.00 => 'Very Satisfactory',
            $grade <= 2.50 => 'Satisfactory',
            $grade <= 3.00 => 'Fairly Satisfactory',
            $grade <= 4.00 => 'Conditional',
            default => 'Did Not Meet Expectations',
        };
    }

    private function tenPointRemark(float $grade): string
    {
        return match (true) {
            $grade >= 9.00 => 'Outstanding',
            $grade >= 8.50 => 'Very Satisfactory',
            $grade >= 8.00 => 'Satisfactory',
            $grade >= 7.50 => 'Fairly Satisfactory',
            default => 'Did Not Meet Expectations',
        };
    }
};
