<?php

namespace App\Services;

use App\Models\SchoolNotification;
use App\Models\Student;
use App\Models\StudentReward;
use App\Models\User;
use App\Models\Attendance;

class PointsService
{
    public const SEMESTER_CAP = 250;
    public const REDEMPTION_CAP = 200;
    public const GRADE_CAP = 80;
    public const ATTENDANCE_CAP = 60;
    public const EVENT_CAP = 40;

    public function awardGradePoints(
        Student $student,
        float $score,
        string $sourceKey,
        ?User $awardedBy = null,
        ?string $schoolYear = null,
        ?string $semester = null,
        array $meta = [],
        bool $collegeScale = false
    ): ?StudentReward {
        $points = $collegeScale ? $this->pointsForCollegeGrade($score) : $this->pointsForGrade($score);

        if ($points <= 0) {
            StudentReward::where('student_id', $student->id)->where('source_key', $sourceKey)->delete();
            return null;
        }

        return $this->awardOrUpdate($student, [
            'awarded_by_id' => $awardedBy?->id,
            'source' => 'grades',
            'source_key' => $sourceKey,
            'category' => 'academic',
            'title' => 'Grade points earned',
            'description' => "Score {$score} earned {$points} points.",
            'points' => $points,
            'school_year' => $schoolYear,
            'semester' => $semester,
            'meta' => $meta + ['score' => $score],
        ], self::GRADE_CAP);
    }

    public function awardDailyAttendancePoints(
        Student $student,
        string $status,
        string $sourceKey,
        ?User $awardedBy = null,
        ?string $schoolYear = null,
        ?string $semester = null,
        array $meta = []
    ): ?StudentReward {
        if ($status !== 'present') {
            StudentReward::where('student_id', $student->id)->where('source_key', $sourceKey)->delete();
            return null;
        }

        return $this->awardOrUpdate($student, [
            'awarded_by_id' => $awardedBy?->id,
            'source' => 'attendance',
            'source_key' => $sourceKey,
            'category' => 'attendance',
            'title' => 'Daily attendance points',
            'description' => 'Perfect daily attendance earned 2 points.',
            'points' => 2,
            'school_year' => $schoolYear,
            'semester' => $semester,
            'meta' => $meta + ['status' => $status],
        ], self::ATTENDANCE_CAP);
    }

    public function syncMonthlyPerfectAttendance(
        Student $student,
        string $date,
        ?User $awardedBy = null,
        ?string $schoolYear = null,
        ?string $semester = null
    ): ?StudentReward {
        $month = substr($date, 0, 7);
        $sourceKey = "attendance-monthly:{$student->id}:{$month}";

        $records = Attendance::where('student_id', $student->id)
            ->where('date', 'like', "{$month}%")
            ->get();

        if ($records->isEmpty() || $records->where('status', '!=', 'present')->isNotEmpty()) {
            StudentReward::where('student_id', $student->id)->where('source_key', $sourceKey)->delete();
            return null;
        }

        return $this->awardOrUpdate($student, [
            'awarded_by_id' => $awardedBy?->id,
            'source' => 'attendance',
            'source_key' => $sourceKey,
            'category' => 'attendance',
            'title' => 'Monthly perfect attendance bonus',
            'description' => 'Perfect recorded attendance for the month earned 20 bonus points.',
            'points' => 20,
            'school_year' => $schoolYear,
            'semester' => $semester,
            'meta' => ['month' => $month],
        ], self::ATTENDANCE_CAP);
    }

    public function awardVerifiedPoints(Student $student, array $data, ?User $awardedBy = null): StudentReward
    {
        $source = $data['source'];
        $cap = match ($source) {
            'events' => self::EVENT_CAP,
            default => null,
        };

        return $this->awardOrUpdate($student, [
            'awarded_by_id' => $awardedBy?->id,
            'source' => $source,
            'source_key' => $data['source_key'],
            'category' => $source,
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'points' => (int) $data['points'],
            'school_year' => $data['school_year'] ?? null,
            'semester' => $data['semester'] ?? null,
            'meta' => $data['meta'] ?? [],
        ], $cap);
    }

    public function summaryFor(Student $student, ?string $schoolYear = null, ?string $semester = null): array
    {
        $query = StudentReward::where('student_id', $student->id);
        $this->scopePeriod($query, $schoolYear, $semester);

        $earnedPoints = (int) (clone $query)
            ->where('points', '>', 0)
            ->sum('points');
        $redemptionBalance = $this->redemptionBalanceFor($student, $schoolYear, $semester);
        $level = intdiv($earnedPoints, 100) + 1;

        return [
            'points' => $redemptionBalance,
            'earned_points' => $earnedPoints,
            'redeemable_points' => $redemptionBalance,
            'redemption_cap' => self::REDEMPTION_CAP,
            'peso_value' => $redemptionBalance * 0.5,
            'level' => $level,
            'current_level_points' => max(0, $earnedPoints - (($level - 1) * 100)),
            'next_level_at' => $level * 100,
            'points_to_next_level' => max(0, ($level * 100) - $earnedPoints),
            'semester_cap' => self::SEMESTER_CAP,
            'semester_cap_remaining' => max(0, self::SEMESTER_CAP - $earnedPoints),
            'redemption_cap_remaining' => max(0, self::REDEMPTION_CAP - min(self::REDEMPTION_CAP, $earnedPoints)),
            'rewards_count' => (clone $query)->count(),
            'by_source' => $this->sourceTotals($student, $schoolYear, $semester),
        ];
    }

    public function redemptionBalanceFor(Student $student, ?string $schoolYear = null, ?string $semester = null): int
    {
        $earnedQuery = StudentReward::where('student_id', $student->id)
            ->where('points', '>', 0)
            ->whereNotIn('category', ['redemption']);
        $this->scopePeriod($earnedQuery, $schoolYear, $semester);

        $redemptionQuery = StudentReward::where('student_id', $student->id)
            ->where('category', 'redemption');
        $this->scopePeriod($redemptionQuery, $schoolYear, $semester);

        return max(0, min(self::REDEMPTION_CAP, (int) $earnedQuery->sum('points')) + (int) $redemptionQuery->sum('points'));
    }

    private function awardOrUpdate(Student $student, array $attributes, ?int $sourceCap): StudentReward
    {
        $existing = StudentReward::where('student_id', $student->id)
            ->where('source_key', $attributes['source_key'])
            ->first();

        $points = $this->cappedPoints(
            $student,
            $attributes['source'],
            (int) $attributes['points'],
            $attributes['school_year'] ?? null,
            $attributes['semester'] ?? null,
            $sourceCap,
            $existing?->id
        );

        $reward = StudentReward::updateOrCreate(
            ['student_id' => $student->id, 'source_key' => $attributes['source_key']],
            [...$attributes, 'points' => $points]
        );

        if (!$existing && $points > 0 && $student->user_id) {
            SchoolNotification::create([
                'user_id' => $student->user_id,
                'type' => 'points_earned',
                'title' => 'Points earned',
                'body' => "You earned {$points} points: {$attributes['title']}.",
                'channels' => ['in_app'],
                'data' => ['reward_id' => $reward->id, 'points' => $points, 'source' => $attributes['source']],
            ]);
        }

        return $reward;
    }

    private function cappedPoints(
        Student $student,
        string $source,
        int $points,
        ?string $schoolYear,
        ?string $semester,
        ?int $sourceCap,
        ?int $excludeId = null
    ): int {
        $periodQuery = StudentReward::where('student_id', $student->id)
            ->where('points', '>', 0)
            ->whereNotIn('category', ['redemption']);
        $this->scopePeriod($periodQuery, $schoolYear, $semester);
        if ($excludeId) {
            $periodQuery->where('id', '!=', $excludeId);
        }

        $semesterRemaining = max(0, self::SEMESTER_CAP - (int) $periodQuery->sum('points'));
        $allowed = min($points, $semesterRemaining);

        if ($sourceCap !== null) {
            $sourceQuery = StudentReward::where('student_id', $student->id)
                ->where('source', $source)
                ->where('points', '>', 0);
            $this->scopePeriod($sourceQuery, $schoolYear, $semester);
            if ($excludeId) {
                $sourceQuery->where('id', '!=', $excludeId);
            }
            $allowed = min($allowed, max(0, $sourceCap - (int) $sourceQuery->sum('points')));
        }

        return max(0, $allowed);
    }

    private function pointsForGrade(float $score): int
    {
        if ($score >= 90) return 15;
        if ($score >= 85) return 8;
        if ($score >= 75) return 3;
        return 0;
    }

    private function pointsForCollegeGrade(float $score): int
    {
        if ($score <= 1.75) return 15;
        if ($score <= 2.5) return 8;
        if ($score <= 3) return 3;
        return 0;
    }

    private function sourceTotals(Student $student, ?string $schoolYear, ?string $semester): array
    {
        $query = StudentReward::where('student_id', $student->id);
        $this->scopePeriod($query, $schoolYear, $semester);

        return $query
            ->selectRaw('source, SUM(points) as total')
            ->groupBy('source')
            ->pluck('total', 'source')
            ->map(fn ($value) => (int) $value)
            ->all();
    }

    private function scopePeriod($query, ?string $schoolYear, ?string $semester): void
    {
        if ($schoolYear) {
            $query->where('school_year', $schoolYear);
        }

        if ($semester) {
            $query->where('semester', $semester);
        }
    }
}
