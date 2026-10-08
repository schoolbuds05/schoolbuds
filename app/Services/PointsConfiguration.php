<?php

namespace App\Services;

use App\Models\MarketplaceSetting;
use Illuminate\Support\Facades\Schema;

class PointsConfiguration
{
    private ?array $cachedValues = null;

    public const DEFAULTS = [
        'semester_cap' => 250,
        'redemption_cap' => 200,
        'grade_cap' => 80,
        'attendance_cap' => 60,
        'event_cap' => 40,
        'shs_grade_high_threshold' => 90,
        'shs_grade_high_points' => 15,
        'shs_grade_mid_threshold' => 85,
        'shs_grade_mid_points' => 8,
        'shs_grade_pass_threshold' => 75,
        'shs_grade_pass_points' => 3,
        'college_grade_top_max' => 1.75,
        'college_grade_top_points' => 15,
        'college_grade_mid_max' => 2.5,
        'college_grade_mid_points' => 8,
        'college_grade_pass_max' => 3,
        'college_grade_pass_points' => 3,
        'attendance_daily_points' => 2,
        'attendance_monthly_points' => 20,
        'event_points_per_event_max' => 25,
        'event_default_points' => 10,
        'early_enrollment_points' => 30,
        'early_payment_regular_points' => 25,
        'early_payment_early_points' => 40,
        'points_per_level' => 100,
        'redemption_rate' => 0.5,
        'max_redemption_percent' => 40,
        'redemption_min_points' => 50,
        'redemption_max_points' => 100,
    ];

    public function all(): array
    {
        if ($this->cachedValues !== null) {
            return $this->cachedValues;
        }

        $values = self::DEFAULTS;

        if (!Schema::hasTable('marketplace_settings')) {
            return $this->cachedValues = $values;
        }

        $stored = MarketplaceSetting::query()
            ->whereIn('key', array_keys(self::DEFAULTS))
            ->get(['key', 'value']);

        foreach ($stored as $setting) {
            $value = $setting->value;
            if (is_array($value) && array_key_exists('value', $value)) {
                $value = $value['value'];
                if (is_numeric($value)) {
                    $values[$setting->key] = is_int(self::DEFAULTS[$setting->key])
                        ? (int) $value
                        : (float) $value;
                }
            }
        }

        return $this->cachedValues = $values;
    }

    public function get(string $key): int|float
    {
        return $this->all()[$key] ?? self::DEFAULTS[$key];
    }
}
