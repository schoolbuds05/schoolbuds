<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\AcademicTerm;
use App\Models\MarketplaceSetting;
use App\Models\Section;
use App\Services\PointsConfiguration;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class SystemControlController extends Controller
{
    public function index(PointsConfiguration $points)
    {
        $terms = AcademicTerm::query()
            ->orderByDesc('school_year')
            ->orderBy('semester')
            ->get();
        $currentTerm = AcademicTerm::query()
            ->latest('updated_at')
            ->first();

        $pointsSettings = $points->all();

        return view('admin.controls.index', compact('terms', 'currentTerm', 'pointsSettings'));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'school_year' => ['required', 'string', 'max:20'],
            'semester' => ['required', 'in:1st,2nd,summer'],
            'exam_date' => ['nullable', 'date'],
            'grade_finalization_deadline' => ['nullable', 'date'],
            'enrollment_opens_at' => ['nullable', 'date'],
            'enrollment_closes_at' => ['nullable', 'date', 'after_or_equal:enrollment_opens_at'],
            'is_active' => ['nullable', 'boolean'],
        ]);
        $isActive = (bool) ($data['is_active'] ?? false);

        if ($isActive) {
            AcademicTerm::query()
                ->where(function ($query) use ($data) {
                    $query->where('school_year', '!=', $data['school_year'])
                        ->orWhere('semester', '!=', $data['semester']);
                })
                ->update(['is_active' => false]);

            Section::query()
                ->where('is_active', true)
                ->where(function ($query) use ($data) {
                    $query->where('school_year', '!=', $data['school_year'])
                        ->orWhere('semester', '!=', $data['semester']);
                })
                ->update(['is_active' => false]);
        }

        AcademicTerm::updateOrCreate(
            [
                'school_year' => $data['school_year'],
                'semester' => $data['semester'],
            ],
            [
                ...$data,
                'is_active' => $isActive,
                'updated_by' => $request->user()->id,
            ]
        );

        return back()->with('status', 'System academic controls updated.');
    }

    public function storePoints(Request $request, PointsConfiguration $points)
    {
        $defaults = PointsConfiguration::DEFAULTS;
        $integerKeys = array_diff(array_keys($defaults), [
            'shs_grade_high_threshold',
            'shs_grade_mid_threshold',
            'shs_grade_pass_threshold',
            'college_grade_top_max',
            'college_grade_mid_max',
            'college_grade_pass_max',
            'redemption_rate',
            'max_redemption_percent',
        ]);
        $rules = [];

        foreach (array_keys($defaults) as $key) {
            $rules[$key] = in_array($key, $integerKeys, true)
                ? ['required', 'integer', 'min:0', 'max:100000']
                : ['required', 'numeric', 'min:0', 'max:100000'];
        }

        $rules['shs_grade_high_threshold'] = ['required', 'numeric', 'min:0', 'max:100'];
        $rules['shs_grade_mid_threshold'] = ['required', 'numeric', 'min:0', 'max:100'];
        $rules['shs_grade_pass_threshold'] = ['required', 'numeric', 'min:0', 'max:100'];
        $rules['college_grade_top_max'] = ['required', 'numeric', 'min:0', 'max:5'];
        $rules['college_grade_mid_max'] = ['required', 'numeric', 'min:0', 'max:5'];
        $rules['college_grade_pass_max'] = ['required', 'numeric', 'min:0', 'max:5'];
        $rules['redemption_rate'] = ['required', 'numeric', 'gt:0', 'max:1000'];
        $rules['max_redemption_percent'] = ['required', 'numeric', 'min:0', 'max:100'];
        $rules['redemption_min_points'] = ['required', 'integer', 'min:0', 'max:100000'];
        $rules['redemption_max_points'] = ['required', 'integer', 'min:1', 'max:100000'];
        $rules['points_per_level'] = ['required', 'integer', 'min:1', 'max:100000'];

        $validator = Validator::make($request->all(), $rules);
        $validator->after(function ($validator) use ($request): void {
            foreach ([
                ['shs_grade_high_threshold', 'shs_grade_mid_threshold', 'SHS high-score threshold must be at least the mid-score threshold.'],
                ['shs_grade_mid_threshold', 'shs_grade_pass_threshold', 'SHS mid-score threshold must be at least the passing threshold.'],
                ['college_grade_top_max', 'college_grade_mid_max', 'College top-grade limit must not exceed the mid-grade limit.'],
                ['college_grade_mid_max', 'college_grade_pass_max', 'College mid-grade limit must not exceed the passing limit.'],
            ] as [$higher, $lower, $message]) {
                $higherValue = $request->input($higher);
                $lowerValue = $request->input($lower);
                $invalidOrder = str_starts_with($higher, 'shs_grade_')
                    ? (float) $higherValue < (float) $lowerValue
                    : (float) $higherValue > (float) $lowerValue;

                if (is_numeric($higherValue) && is_numeric($lowerValue) && $invalidOrder) {
                    $validator->errors()->add($higher, $message);
                }
            }

            if (is_numeric($request->input('redemption_min_points'))
                && is_numeric($request->input('redemption_max_points'))
                && (int) $request->input('redemption_min_points') > (int) $request->input('redemption_max_points')) {
                $validator->errors()->add('redemption_min_points', 'Minimum redemption points cannot exceed the maximum.');
            }

            if (is_numeric($request->input('event_default_points'))
                && is_numeric($request->input('event_points_per_event_max'))
                && (int) $request->input('event_default_points') > (int) $request->input('event_points_per_event_max')) {
                $validator->errors()->add('event_default_points', 'Default event points cannot exceed the per-event maximum.');
            }
        });

        $data = $validator->validate();
        foreach ($data as $key => $value) {
            $data[$key] = is_int($defaults[$key]) ? (int) $value : (float) $value;
        }
        $previous = $points->all();

        DB::transaction(function () use ($data, $request, $previous): void {
            foreach ($data as $key => $value) {
                MarketplaceSetting::updateOrCreate(
                    ['key' => $key],
                    ['value' => ['value' => $value], 'updated_by' => $request->user()->id]
                );
            }

            ActivityLog::record($request, 'points_configuration_updated', "{$request->user()->name} updated the points configuration.", [
                'meta' => ['before' => $previous, 'after' => $data],
            ]);
        });

        return back()->with('status', 'Points configuration updated.');
    }
}
