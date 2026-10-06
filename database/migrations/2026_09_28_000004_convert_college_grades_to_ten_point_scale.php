<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $collegeClassIds = $this->collegeClassIds();

        DB::table('grades')
            ->whereIn('school_class_id', $collegeClassIds)
            ->orderBy('id')
            ->chunkById(500, function ($grades): void {
                foreach ($grades as $grade) {
                    if ($grade->score === null) {
                        continue;
                    }
                    $score = (float) $grade->score;
                    $converted = max(1, min(10, round($score / 10, 2)));
                    DB::table('grades')->where('id', $grade->id)->update([
                        'score' => $converted,
                        'remarks' => $this->remark($converted),
                    ]);
                }
            });

        if (DB::table('grade_submissions')->exists()) {
            DB::table('grade_submissions')
                ->whereIn('school_class_id', $collegeClassIds)
                ->orderBy('id')
                ->chunkById(250, function ($submissions): void {
                    foreach ($submissions as $submission) {
                        $grades = json_decode($submission->grades, true) ?: [];
                        foreach ($grades as &$line) {
                            if (!isset($line['score']) || $line['score'] === null) {
                                continue;
                            }
                            $score = (float) $line['score'];
                            $line['score'] = max(1, min(10, round($score / 10, 2)));
                            $line['remarks'] = $this->remark((float) $line['score']);
                        }
                        unset($line);

                        DB::table('grade_submissions')->where('id', $submission->id)->update([
                            'grades' => json_encode($grades),
                        ]);
                    }
                });
        }
    }

    public function down(): void
    {
        $collegeClassIds = $this->collegeClassIds();

        DB::table('grades')
            ->whereIn('school_class_id', $collegeClassIds)
            ->orderBy('id')
            ->chunkById(500, function ($grades): void {
                foreach ($grades as $grade) {
                    if ($grade->score === null) {
                        continue;
                    }
                    $score = min(100, round((float) $grade->score * 10, 2));
                    DB::table('grades')->where('id', $grade->id)->update([
                        'score' => $score,
                        'remarks' => $this->percentageRemark($score),
                    ]);
                }
            });

        if (DB::table('grade_submissions')->exists()) {
            DB::table('grade_submissions')
                ->whereIn('school_class_id', $collegeClassIds)
                ->orderBy('id')
                ->chunkById(250, function ($submissions): void {
                    foreach ($submissions as $submission) {
                        $grades = json_decode($submission->grades, true) ?: [];
                        foreach ($grades as &$line) {
                            if (!isset($line['score']) || $line['score'] === null) {
                                continue;
                            }
                            $line['score'] = min(100, round((float) $line['score'] * 10, 2));
                            $line['remarks'] = $this->percentageRemark((float) $line['score']);
                        }
                        unset($line);

                        DB::table('grade_submissions')->where('id', $submission->id)->update([
                            'grades' => json_encode($grades),
                        ]);
                    }
                });
        }
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

    private function remark(float $score): string
    {
        return match (true) {
            $score >= 9 => 'Outstanding',
            $score >= 8.5 => 'Very Satisfactory',
            $score >= 8 => 'Satisfactory',
            $score >= 7.5 => 'Fairly Satisfactory',
            default => 'Did Not Meet Expectations',
        };
    }

    private function percentageRemark(float $score): string
    {
        return match (true) {
            $score >= 90 => 'Outstanding',
            $score >= 85 => 'Very Satisfactory',
            $score >= 80 => 'Satisfactory',
            $score >= 75 => 'Fairly Satisfactory',
            default => 'Did Not Meet Expectations',
        };
    }
};
