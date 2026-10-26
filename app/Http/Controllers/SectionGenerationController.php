<?php

namespace App\Http\Controllers;

use App\Http\Requests\GenerateSectionsRequest;
use App\Models\ActivityLog;
use App\Models\Course;
use App\Models\Room;
use App\Services\SectionDepartmentAccess;
use App\Services\SectionGenerationService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class SectionGenerationController extends Controller
{
    public function __construct(private SectionGenerationService $generator) {}

    public function options(Request $request)
    {
        $department = SectionDepartmentAccess::authorize($request->user());
        $courses = Course::where('is_active', true)->where('program_type', 'college')
            ->whereHas('department', fn ($q) => $q->where('type', 'course')->where('is_active', true))
            ->when($department, fn ($q) => $q->where('department_id', $department->id))->orderBy('name')->get(['id', 'name']);
        $fixedCourse = $department && $courses->count() === 1 ? $courses->first() : null;
        if ($fixedCourse && ! $request->filled('course_id') && ! $request->expectsJson()) {
            $request->merge(['course_id' => $fixedCourse->id]);
        }
        $data = $request->validate(['course_id' => ['nullable', 'integer'], 'year_level' => ['nullable', Rule::in(['1', '2', '3', '4'])], 'semester' => ['nullable', Rule::in(['1st', '2nd', 'summer'])]]);
        $subjects = collect();
        if (! empty($data['course_id'])) {
            $course = $this->generator->course($request->user(), (int) $data['course_id']);
            $subjects = $this->generator->subjects($course, $data['year_level'] ?? '1', $data['semester'] ?? '1st');
        }
        if ($request->expectsJson()) {
            return response()->json([
                'courses' => $courses,
                'subjects' => $subjects->map(fn ($subject) => $subject->only(['id', 'code', 'name', 'units_lec', 'units_lab'])),
                'rooms' => Room::query()->where('is_active', true)->orderBy('name')->get(['id', 'name', 'room_type', 'capacity']),
            ]);
        }

        $rooms = Room::query()->where('is_active', true)->orderBy('name')->get(['id', 'name', 'room_type', 'capacity']);

        return view('registrar.sections.generate', compact('courses', 'subjects', 'fixedCourse', 'rooms'));
    }

    public function preview(GenerateSectionsRequest $request)
    {
        $result = $this->generator->preview($request->user(), $request->validated());
        if ($request->expectsJson()) {
            return response()->json($result);
        }

        return view('registrar.sections.generation-preview', $result);
    }

    public function store(Request $request)
    {
        SectionDepartmentAccess::authorize($request->user());
        $data = $request->validate(['batch_id' => ['required', 'uuid']]);
        try {
            $ids = $this->generator->commit($request->user(), $data['batch_id']);
        } catch (ValidationException $exception) {
            if ($request->expectsJson()) {
                throw $exception;
            }

            return redirect()->route($request->routeIs('department-chair.*') ? 'department-chair.sections.generate' : 'registrar.sections.generate')->withErrors($exception->errors());
        }
        ActivityLog::record($request, 'sections_generated', 'Saved generated section drafts.', ['meta' => ['batch_id' => $data['batch_id'], 'section_ids' => $ids]]);
        $message = count($ids).' section drafts saved with schedules and teachers. Review them before submitting for approval.';
        if ($request->expectsJson()) {
            return response()->json(['message' => $message, 'section_ids' => $ids]);
        }

        return redirect()->route($request->routeIs('department-chair.*') ? 'department-chair.sections.index' : 'registrar.sections.index')->with('status', $message);
    }
}
