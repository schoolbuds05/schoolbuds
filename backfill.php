<?php

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

function generateStudentId(int $appId): string
{
    $prefix = 'SCC';
    $year   = date('y');
    $seq    = str_pad($appId, 8, '0', STR_PAD_LEFT);
    return "{$prefix}-{$year}-{$seq}";
}

$fixed = 0;

\App\Models\EnrollmentApplication::where('status', 'approved')
    ->each(function($record) use (&$fixed) {

        // 1. Ensure id_no is set
        $studentId = $record->id_no && !str_starts_with($record->id_no, 'ENR')
            ? $record->id_no
            : generateStudentId($record->id);

        if ($record->id_no !== $studentId) {
            $record->update(['id_no' => $studentId]);
            echo "ID updated #{$record->id} -> {$studentId}\n";
        }

        // 2. Sync to students table
        if (!$record->user_id) {
            echo "Skipping #{$record->id} — no user_id (not yet approved properly)\n";
            return;
        }

        \App\Models\Student::updateOrCreate(
            ['user_id' => $record->user_id],
            [
                'student_id'  => $studentId,
                'first_name'  => $record->first_name,
                'last_name'   => $record->last_name,
                'email'       => $record->email,
                'phone'       => $record->contact_number,
                'birthdate'   => $record->birthdate,
                'gender'      => in_array($record->gender, ['male','female']) ? $record->gender : 'male',
                'address'     => $record->address,
                'grade_level' => $record->program_type === 'college' ? $record->year_level : $record->grade_level,
                'section'     => 'TBA',
                'school_year' => $record->school_year,
                'status'      => 'active',
                'user_id'     => $record->user_id,
            ]
        );

        echo "Synced #{$record->id} ({$record->first_name} {$record->last_name}) -> {$studentId}\n";
        $fixed++;
    });

echo "\nDone. Synced {$fixed} records.\n";