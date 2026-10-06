<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AcademicTerm;
use App\Models\Section;
use Illuminate\Http\Request;

class SystemControlController extends Controller
{
    public function index()
    {
        $terms = AcademicTerm::query()
            ->orderByDesc('school_year')
            ->orderBy('semester')
            ->get();
        $currentTerm = AcademicTerm::query()
            ->latest('updated_at')
            ->first();

        return view('admin.controls.index', compact('terms', 'currentTerm'));
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
}
