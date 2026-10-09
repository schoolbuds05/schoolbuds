<?php

namespace App\Http\Controllers\Registrar;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Web\Concerns\AuthorizesPortal;
use App\Models\ActivityLog;
use App\Models\Course;
use App\Models\SectionSubject;
use App\Models\Subject;
use App\Services\ArchiveService;
use Illuminate\Http\Request;

class SubjectController extends Controller
{
    use AuthorizesPortal;

    public function index(Request $request)
    {
        $this->requireAnyRole($request, ['admin', 'registrar']);

        $subjects = Subject::query()
            ->with('prerequisites:id,code,name')
            ->when($request->program_type, fn ($query) => $query->where('program_type', $request->program_type))
            ->when($request->filled('scope') || $request->filled('course'), function ($query) use ($request) {
                if ($request->filled('scope')) {
                    $scopeParts = explode('|', (string) $request->query('scope'), 2);
                    if (count($scopeParts) === 2 && in_array($scopeParts[0], ['college', 'shs'], true)) {
                        [$programType, $scopeValue] = $scopeParts;
                        $scopeColumn = $programType === 'college' ? 'course' : 'strand';

                        $query->where('program_type', $programType)
                            ->where(function ($scopeQuery) use ($scopeColumn, $scopeValue) {
                                if ($scopeValue === '__general__') {
                                    $scopeQuery->whereNull($scopeColumn)->orWhere($scopeColumn, '');
                                } else {
                                    $scopeQuery->where($scopeColumn, $scopeValue);
                                }
                            });
                    }

                    return;
                }

                $courseValue = (string) $request->course;
                $query->where(function ($courseQuery) use ($courseValue) {
                    $courseQuery->where('course', $courseValue)
                        ->orWhere('strand', $courseValue);
                });
            })
            ->when($request->filled('semester'), fn ($query) => $query->where('semester', $request->semester))
            ->when($request->filled('year_level'), fn ($query) => $query->where('year_level', $request->year_level))
            ->when($request->search, fn ($query) => $query->where(fn ($inner) => $inner
                ->where('code', 'like', "%{$request->search}%")
                ->orWhere('name', 'like', "%{$request->search}%")))
            ->orderBy('code')
            ->paginate(20)
            ->withQueryString();
        $courses = Course::query()
            ->where('is_active', true)
            ->where('program_type', 'college')
            ->select('name')
            ->distinct()
            ->orderBy('name')
            ->get();
        $collegeScopes = Subject::query()
            ->where('program_type', 'college')
            ->whereNotNull('course')
            ->where('course', '!=', '')
            ->distinct()
            ->orderBy('course')
            ->pluck('course');
        $shsStrands = Subject::query()
            ->where('program_type', 'shs')
            ->whereNotNull('strand')
            ->where('strand', '!=', '')
            ->distinct()
            ->orderBy('strand')
            ->pluck('strand');
        $yearLevels = Subject::query()
            ->whereNotNull('year_level')
            ->where('year_level', '!=', '')
            ->distinct()
            ->orderByRaw('CAST(year_level AS UNSIGNED) ASC')
            ->pluck('year_level');
        $allSubjects = Subject::orderBy('code')->get(['id', 'code', 'name', 'program_type']);

        return view('registrar.subjects.index', compact('subjects', 'courses', 'collegeScopes', 'shsStrands', 'yearLevels', 'allSubjects'));
    }

    public function store(Request $request)
    {
        $this->requireAnyRole($request, ['admin', 'registrar']);

        $data = $this->validated($request);
        $subject = Subject::create($data);

        if ($request->filled('prerequisite_ids')) {
            $prerequisitesBefore = [];
            $subject->prerequisites()->sync($request->input('prerequisite_ids'));
            ActivityLog::recordRelationChange(
                $request,
                $subject,
                'prerequisites',
                $prerequisitesBefore,
                $subject->prerequisites()->allRelatedIds()->all()
            );
        }

        return back()->with('status', 'Subject created.');
    }

    public function update(Request $request, Subject $subject)
    {
        $this->requireAnyRole($request, ['admin', 'registrar']);

        $prerequisitesBefore = $subject->prerequisites()->allRelatedIds()->all();
        $subject->update($this->validated($request));

        $prerequisiteIds = $request->input('prerequisite_ids', []);
        $prerequisiteIds = array_filter((array) $prerequisiteIds, fn($id) => (int) $id !== $subject->id);
        $subject->prerequisites()->sync($prerequisiteIds);
        ActivityLog::recordRelationChange(
            $request,
            $subject,
            'prerequisites',
            $prerequisitesBefore,
            $subject->prerequisites()->allRelatedIds()->all()
        );

        return back()->with('status', 'Subject updated.');
    }

    public function destroy(Request $request, Subject $subject)
    {
        $this->requireAnyRole($request, ['admin', 'registrar']);

        ArchiveService::record($subject, $request->user()?->id, 'web.subjects');
        $subject->sectionSubjects()->get()->each(fn (SectionSubject $sectionSubject) => $sectionSubject->delete());
        $prerequisitesBefore = $subject->prerequisites()->allRelatedIds()->all();
        $requiredByBefore = $subject->requiredBy()->allRelatedIds()->all();
        $subject->prerequisites()->detach();
        $subject->requiredBy()->detach();
        ActivityLog::recordRelationChange($request, $subject, 'prerequisites', $prerequisitesBefore, []);
        ActivityLog::recordRelationChange($request, $subject, 'required_by', $requiredByBefore, []);
        $subject->delete();

        return back()->with('status', 'Subject removed.');
    }

    private function validated(Request $request): array
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:20'],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'units_lec' => ['required', 'numeric', 'min:0'],
            'units_lab' => ['required', 'numeric', 'min:0'],
            'program_type' => ['required', 'in:shs,college'],
            'course' => ['nullable', 'string', 'max:100'],
            'year_level' => ['nullable', 'string', 'max:5'],
            'strand' => ['nullable', 'string', 'max:20'],
            'semester' => ['nullable', 'in:1st,2nd,summer'],
            'is_active' => ['nullable', 'boolean'],
            'prerequisite_ids' => ['nullable', 'array'],
            'prerequisite_ids.*' => ['distinct', 'integer', 'exists:subjects,id'],
        ]);

        return [
            ...$data,
            'course' => $data['program_type'] === 'college' ? ($data['course'] ?: null) : null,
            'strand' => $data['program_type'] === 'shs' ? ($data['strand'] ?: null) : null,
            'is_active' => (bool) ($data['is_active'] ?? false),
        ];
    }
}
