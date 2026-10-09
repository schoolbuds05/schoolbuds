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

    public function __construct(private PointsConfiguration $configuration)
    {
    }

    public function rules(): array
    {
        return $this->configuration->all();
    }

    public function rule(string $key): int|float
    {
        return $this->configuration->get($key);
    }

    public function emptySummary(): array
    {
        $redemptionCap = (int) $this->configuration->get('redemption_cap');
        $semesterCap = (int) $this->configuration->get('semester_cap');
        $pointsPerLevel = (int) $this->configuration->get('points_per_level');

        return [
            'points' => 0,
            'earned_points' => 0,
            'redeemable_points' => 0,
            'redemption_cap' => $redemptionCap,
            'peso_value' => 0,
            'level' => 1,
            'current_level_points' => 0,
            'level_interval' => $pointsPerLevel,
            'next_level_at' => $pointsPerLevel,
            'points_to_next_level' => $pointsPerLevel,
            'semester_cap' => $semesterCap,
            'semester_cap_remaining' => $semesterCap,
            'redemption_cap_remaining' => $redemptionCap,
            'rewards_count' => 0,
            'by_source' => [],
        ];
    }

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
            StudentReward::where('student_id', $student->id)->where('source_key', $sourceKey)->get()
                ->each(fn (StudentReward $reward) => $reward->delete());
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
        ], (int) $this->configuration->get('grade_cap'));
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
            StudentReward::where('student_id', $student->id)->where('source_key', $sourceKey)->get()
                ->each(fn (StudentReward $reward) => $reward->delete());
            return null;
        }

        return $this->awardOrUpdate($student, [
            'awarded_by_id' => $awardedBy?->id,
            'source' => 'attendance',
            'source_key' => $sourceKey,
            'category' => 'attendance',
            'title' => 'Daily attendance points',
            'description' => 'Perfect daily attendance earned ' . $this->configuration->get('attendance_daily_points') . ' points.',
            'points' => (int) $this->configuration->get('attendance_daily_points'),
            'school_year' => $schoolYear,
            'semester' => $semester,
            'meta' => $meta + ['status' => $status],
        ], (int) $this->configuration->get('attendance_cap'));
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
            StudentReward::where('student_id', $student->id)->where('source_key', $sourceKey)->get()
                ->each(fn (StudentReward $reward) => $reward->delete());
            return null;
        }

        return $this->awardOrUpdate($student, [
            'awarded_by_id' => $awardedBy?->id,
            'source' => 'attendance',
            'source_key' => $sourceKey,
            'category' => 'attendance',
            'title' => 'Monthly perfect attendance bonus',
            'description' => 'Perfect recorded attendance for the month earned ' . $this->configuration->get('attendance_monthly_points') . ' bonus points.',
            'points' => (int) $this->configuration->get('attendance_monthly_points'),
            'school_year' => $schoolYear,
            'semester' => $semester,
            'meta' => ['month' => $month],
        ], (int) $this->configuration->get('attendance_cap'));
    }

    public function awardVerifiedPoints(Student $student, array $data, ?User $awardedBy = null): StudentReward
    {
        $source = $data['source'];
        $cap = match ($source) {
            'events' => (int) $this->configuration->get('event_cap'),
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
        $pointsPerLevel = max(1, (int) $this->configuration->get('points_per_level'));
        $redemptionCap = (int) $this->configuration->get('redemption_cap');
        $semesterCap = (int) $this->configuration->get('semester_cap');
        $redemptionRate = (float) $this->configuration->get('redemption_rate');
        $level = intdiv($earnedPoints, $pointsPerLevel) + 1;

        return [
            'points' => $redemptionBalance,
            'earned_points' => $earnedPoints,
            'redeemable_points' => $redemptionBalance,
            'redemption_cap' => $redemptionCap,
            'peso_value' => $redemptionBalance * $redemptionRate,
            'level' => $level,
            'current_level_points' => max(0, $earnedPoints - (($level - 1) * $pointsPerLevel)),
            'level_interval' => $pointsPerLevel,
            'next_level_at' => $level * $pointsPerLevel,
            'points_to_next_level' => max(0, ($level * $pointsPerLevel) - $earnedPoints),
            'semester_cap' => $semesterCap,
            'semester_cap_remaining' => max(0, $semesterCap - $earnedPoints),
            'redemption_cap_remaining' => max(0, $redemptionCap - min($redemptionCap, $earnedPoints)),
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

        return max(0, min((int) $this->configuration->get('redemption_cap'), (int) $earnedQuery->sum('points')) + (int) $redemptionQuery->sum('points'));
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

        $semesterRemaining = max(0, (int) $this->configuration->get('semester_cap') - (int) $periodQuery->sum('points'));
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
        if ($score >= $this->configuration->get('shs_grade_high_threshold')) return (int) $this->configuration->get('shs_grade_high_points');
        if ($score >= $this->configuration->get('shs_grade_mid_threshold')) return (int) $this->configuration->get('shs_grade_mid_points');
        if ($score >= $this->configuration->get('shs_grade_pass_threshold')) return (int) $this->configuration->get('shs_grade_pass_points');
        return 0;
    }

    private function pointsForCollegeGrade(float $score): int
    {
        if ($score <= $this->configuration->get('college_grade_top_max')) return (int) $this->configuration->get('college_grade_top_points');
        if ($score <= $this->configuration->get('college_grade_mid_max')) return (int) $this->configuration->get('college_grade_mid_points');
        if ($score <= $this->configuration->get('college_grade_pass_max')) return (int) $this->configuration->get('college_grade_pass_points');
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
