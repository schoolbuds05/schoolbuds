<?php

namespace Database\Seeders;

use App\Models\Subject;
use Illuminate\Database\Seeder;

class SubjectSeeder extends Seeder
{
    public function run(): void
    {
        $subjects = [
            ['code' => 'GE1', 'name' => 'Understanding the Self', 'description' => null, 'units_lec' => 3.0, 'units_lab' => 0.0, 'year_level' => '1', 'semester' => '1st'],
            ['code' => 'GE2', 'name' => 'Cecilian Core Values/Ethics', 'description' => null, 'units_lec' => 3.0, 'units_lab' => 0.0, 'year_level' => '1', 'semester' => '1st'],
            ['code' => 'GE4', 'name' => 'Science, Technology, and Society', 'description' => null, 'units_lec' => 3.0, 'units_lab' => 0.0, 'year_level' => '1', 'semester' => '1st'],
            ['code' => 'GE6', 'name' => 'Mathematics in the Modern World', 'description' => null, 'units_lec' => 3.0, 'units_lab' => 0.0, 'year_level' => '1', 'semester' => '1st'],
            ['code' => 'FIL1', 'name' => 'Wikang Filipino', 'description' => null, 'units_lec' => 3.0, 'units_lab' => 0.0, 'year_level' => '1', 'semester' => '1st'],
            ['code' => 'CC101', 'name' => 'Introduction to Computing', 'description' => 'Introduction to Computing', 'units_lec' => 2.0, 'units_lab' => 1.0, 'year_level' => '1', 'semester' => '1st'],
            ['code' => 'CC102', 'name' => 'Computer Programming', 'description' => null, 'units_lec' => 2.0, 'units_lab' => 1.0, 'year_level' => '1', 'semester' => '1st'],
            ['code' => 'REED1', 'name' => 'Salvation History', 'description' => null, 'units_lec' => 3.0, 'units_lab' => 0.0, 'year_level' => '1', 'semester' => '1st'],
            ['code' => 'ENGPLUS', 'name' => 'English Enhancement', 'description' => null, 'units_lec' => 3.0, 'units_lab' => 0.0, 'year_level' => '1', 'semester' => '1st'],
            ['code' => 'MATHPLUS', 'name' => 'Basic Mathematics', 'description' => 'Basic Mathematics', 'units_lec' => 3.0, 'units_lab' => 0.0, 'year_level' => '1', 'semester' => '1st'],
            ['code' => 'PATHFIT1', 'name' => 'Movement Competency Training', 'description' => 'Movement Competency Training', 'units_lec' => 2.0, 'units_lab' => 0.0, 'year_level' => '1', 'semester' => '1st'],
            ['code' => 'NSTP1', 'name' => 'National Services Training Program1', 'description' => 'National Services Training Program1', 'units_lec' => 3.0, 'units_lab' => 0.0, 'year_level' => '1', 'semester' => '1st'],
            ['code' => 'FL', 'name' => 'Foreign Language', 'description' => 'Foreign Language', 'units_lec' => 3.0, 'units_lab' => 0.0, 'year_level' => '1', 'semester' => '2nd'],
            ['code' => 'FIL2', 'name' => 'Masining na Pagpapahayag', 'description' => 'Masining na Pagpapahayag', 'units_lec' => 3.0, 'units_lab' => 0.0, 'year_level' => '1', 'semester' => '2nd'],
            ['code' => 'GE5', 'name' => 'Purposive Communication', 'description' => 'Purposive Communication', 'units_lec' => 3.0, 'units_lab' => 0.0, 'year_level' => '1', 'semester' => '2nd'],
            ['code' => 'GE7', 'name' => 'Contemporary World', 'description' => 'Contemporary World', 'units_lec' => 3.0, 'units_lab' => 0.0, 'year_level' => '1', 'semester' => '2nd'],
            ['code' => 'HCI101', 'name' => 'Introduction to Human Computer Interaction', 'description' => 'Introduction to Human Computer Interaction', 'units_lec' => 2.0, 'units_lab' => 1.0, 'year_level' => '1', 'semester' => '2nd'],
            ['code' => 'CC103', 'name' => 'Computer Programming 2', 'description' => 'Computer Programming 2', 'units_lec' => 2.0, 'units_lab' => 1.0, 'year_level' => '1', 'semester' => '2nd'],
            ['code' => 'MS101', 'name' => 'Discrete Mathematics', 'description' => 'Discrete Mathematics', 'units_lec' => 3.0, 'units_lab' => 0.0, 'year_level' => '1', 'semester' => '2nd'],
            ['code' => 'NSTP2', 'name' => 'National Services Training Program 2', 'description' => 'National Services Training Program 2', 'units_lec' => 3.0, 'units_lab' => 0.0, 'year_level' => '1', 'semester' => '2nd'],
            ['code' => 'PATHFIT2', 'name' => 'Exercise Based Fitness', 'description' => 'Exercise Based Fitness', 'units_lec' => 3.0, 'units_lab' => 0.0, 'year_level' => '1', 'semester' => '2nd'],
            ['code' => 'GE8', 'name' => 'Art Appreciation', 'description' => 'Art Appreciation', 'units_lec' => 3.0, 'units_lab' => 0.0, 'year_level' => '2', 'semester' => '1st'],
            ['code' => 'PF201', 'name' => 'Object Oriented Programming 1', 'description' => 'Object Oriented Programming 1', 'units_lec' => 2.0, 'units_lab' => 1.0, 'year_level' => '2', 'semester' => '1st'],
        ];

        foreach ($subjects as $subject) {
            $course = str_starts_with($subject['code'], 'GE') ? null : 'BS Information Technology';

            Subject::updateOrCreate(
                [
                    'code' => $subject['code'],
                    'course' => $course,
                    'year_level' => $subject['year_level'],
                    'semester' => $subject['semester'],
                ],
                [
                    ...$subject,
                    'program_type' => 'college',
                    'course' => $course,
                    'strand' => null,
                    'is_active' => true,
                ]
            );
        }
    }
}
 