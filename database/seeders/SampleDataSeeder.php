<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Student;
use App\Models\SchoolClass;
use App\Models\Grade;
use App\Models\Attendance;
use App\Models\Fee;
use Carbon\Carbon;

class SampleDataSeeder extends Seeder
{
    public function run(): void
    {
        $student = Student::where('student_id', '2025-0001')->first();
        if (!$student) return;

        $classes = SchoolClass::all();

        // Grades for all 4 quarters
        $gradeData = [
            'Mathematics 10' => [85, 88, 90, 92],
            'English 10'     => [90, 91, 89, 93],
            'Science 10'     => [78, 80, 82, 85],
            'Filipino 10'    => [88, 87, 91, 90],
        ];

        foreach ($classes as $class) {
            $scores = $gradeData[$class->subject] ?? [80, 82, 84, 86];
            foreach ([1, 2, 3, 4] as $quarter) {
                Grade::firstOrCreate(
                    [
                        'student_id'      => $student->id,
                        'school_class_id' => $class->id,
                        'quarter'         => $quarter,
                        'school_year'     => '2025-2026',
                    ],
                    [
                        'score'   => $scores[$quarter - 1],
                        'remarks' => $this->getRemark($scores[$quarter - 1]),
                    ]
                );
            }
        }

        // Attendance for the past 30 school days
        $date = Carbon::now()->subDays(40);
        $daysAdded = 0;
        while ($daysAdded < 30) {
            if (!$date->isWeekend()) {
                foreach ($classes as $class) {
                    $status = $this->randomStatus();
                    Attendance::firstOrCreate(
                        [
                            'student_id'      => $student->id,
                            'school_class_id' => $class->id,
                            'date'            => $date->toDateString(),
                        ],
                        ['status' => $status]
                    );
                }
                $daysAdded++;
            }
            $date->addDay();
        }

        // Fees
        $fees = [
            ['type' => 'Tuition Fee',      'amount' => 5000, 'status' => 'paid',    'quarter' => '1'],
            ['type' => 'Tuition Fee',      'amount' => 5000, 'status' => 'paid',    'quarter' => '2'],
            ['type' => 'Tuition Fee',      'amount' => 5000, 'status' => 'unpaid',  'quarter' => '3'],
            ['type' => 'Miscellaneous Fee','amount' => 850,  'status' => 'unpaid',  'quarter' => '3'],
            ['type' => 'Laboratory Fee',   'amount' => 500,  'status' => 'partial', 'quarter' => '2'],
        ];

        foreach ($fees as $fee) {
            Fee::firstOrCreate(
                [
                    'student_id'  => $student->id,
                    'type'        => $fee['type'],
                    'quarter'     => $fee['quarter'],
                    'school_year' => '2025-2026',
                ],
                [
                    'amount'      => $fee['amount'],
                    'paid_amount' => $fee['status'] === 'paid' ? $fee['amount'] : ($fee['status'] === 'partial' ? 250 : 0),
                    'status'      => $fee['status'],
                    'due_date'    => Carbon::now()->addDays(7)->toDateString(),
                ]
            );
        }
    }

    private function getRemark(float $score): string
    {
        if ($score >= 90) return 'Outstanding';
        if ($score >= 85) return 'Very Satisfactory';
        if ($score >= 80) return 'Satisfactory';
        if ($score >= 75) return 'Fairly Satisfactory';
        return 'Did Not Meet Expectations';
    }

    private function randomStatus(): string
    {
        $rand = rand(1, 100);
        if ($rand <= 85) return 'present';
        if ($rand <= 92) return 'late';
        if ($rand <= 97) return 'excused';
        return 'absent';
    }
}