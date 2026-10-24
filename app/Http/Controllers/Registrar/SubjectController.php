<?php

namespace App\Http\Controllers\Registrar;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Web\Concerns\AuthorizesPortal;
use App\Models\ActivityLog;
use App\Models\Course;
use App\Models\SectionSubject;
use App\Models\Subject;
use App\Models\SubjectChangeRequest;
use App\Services\ArchiveService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class SubjectController extends Controller
{
    use AuthorizesPortal;

    public function index(Request $request)
    {
        $this->requireAnyRole($request, ['admin', 'registrar']);

        $tab = $request->query('tab') === 'requests' ? 'requests' : 'catalog';
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
                if (in_array($courseValue, ['__general__', '__general_shs__'], true)) {
                    $programType = $courseValue === '__general_shs__' ? 'shs' : 'college';
                    $scopeColumn = $programType === 'shs' ? 'strand' : 'course';

                    $query->where('program_type', $programType)
                        ->where(function ($scopeQuery) use ($scopeColumn) {
                            $scopeQuery->whereNull($scopeColumn)
                                ->orWhere($scopeColumn, '');
                        });

                    return;
                }

                $query->where(function ($courseQuery) use ($courseValue) {
                    $courseQuery->where('course', $courseValue)
                        ->orWhere('strand', $courseValue);
                });
            })
            ->when($request->filled('semester'), fn ($query) => $query->where('semester', $request->semester))
            ->when($request->filled('year_level'), fn ($query) => $query->where('year_level', $request->year_level))
            ->when($request->search, function ($query) use ($request) {
                $search = trim((string) $request->search);
                $matchingCourses = Course::query()
                    ->where(function ($courseQuery) use ($search) {
                        $courseQuery->where('name', 'like', "%{$search}%")
                            ->orWhere('acronym', 'like', "%{$search}%");
                    });

                $query->where(function ($searchQuery) use ($search, $matchingCourses) {
                    $searchQuery->where('code', 'like', "%{$search}%")
                        ->orWhere('name', 'like', "%{$search}%")
                        ->orWhere('course', 'like', "%{$search}%")
                        ->orWhere('strand', 'like', "%{$search}%")
                        ->orWhereIn('course', (clone $matchingCourses)->select('name'))
                        ->orWhereIn('course', (clone $matchingCourses)->select('acronym'));
                });
            })
            ->orderBy('code')
            ->paginate(20)
            ->withQueryString();
        $requests = SubjectChangeRequest::query()
            ->with([
                'student:id,name,email',
                'subject:id,code,name,units_lec,units_lab',
                'section:id,name,course,year_level,semester',
                'reviewer:id,name',
            ])
            ->when($request->status, fn ($query) => $query->where('status', $request->status))
            ->when($request->action, fn ($query) => $query->where('action', $request->action))
            ->latest()
            ->paginate(15)
            ->withQueryString();
        $requestStats = [
            'pending' => SubjectChangeRequest::where('status', 'pending')->count(),
            'approved' => SubjectChangeRequest::where('status', 'approved')->count(),
            'rejected' => SubjectChangeRequest::where('status', 'rejected')->count(),
        ];
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
        $collegeCourseOptions = $courses->pluck('name')
            ->merge($collegeScopes)
            ->unique()
            ->sort()
            ->values();
        $shsStrands = collect(['STEM', 'ABM', 'HUMSS', 'TVL', 'GAS'])
            ->merge($shsStrands)
            ->unique()
            ->sort()
            ->values();
        $yearLevels = collect(['1', '2', '3', '4', '11', '12'])
            ->merge($yearLevels)
            ->unique()
            ->sortBy(fn ($yearLevel) => (int) $yearLevel)
            ->values();
        $allSubjects = Subject::orderBy('code')->get(['id', 'code', 'name', 'program_type']);

        return view('registrar.subjects.index', compact('tab', 'subjects', 'requests', 'requestStats', 'courses', 'collegeScopes', 'collegeCourseOptions', 'shsStrands', 'yearLevels', 'allSubjects'));
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

    public function bulkUpdate(Request $request)
    {
        $this->requireAnyRole($request, ['admin', 'registrar']);

        $collegeCourseOptions = Course::query()
            ->where('is_active', true)
            ->where('program_type', 'college')
            ->pluck('name')
            ->merge(Subject::query()->where('program_type', 'college')->whereNotNull('course')->where('course', '!=', '')->pluck('course'))
            ->unique()
            ->values();
        $shsStrands = Subject::query()
            ->where('program_type', 'shs')
            ->whereNotNull('strand')
            ->where('strand', '!=', '')
            ->pluck('strand')
            ->merge(['STEM', 'ABM', 'HUMSS', 'TVL', 'GAS'])
            ->unique()
            ->values();
        $yearLevels = Subject::query()
            ->whereNotNull('year_level')
            ->where('year_level', '!=', '')
            ->pluck('year_level')
            ->merge(['1', '2', '3', '4', '11', '12'])
            ->unique()
            ->values();

        $data = $request->validate([
            'form_context' => ['required', Rule::in(['bulk_subject_edit'])],
            'subject_ids' => ['required', 'array', 'min:1'],
            'subject_ids.*' => ['required', 'distinct', 'integer', 'exists:subjects,id'],
            'bulk_course' => ['required', 'string', Rule::in(['__unchanged__', '__general__', ...$collegeCourseOptions->all()])],
            'bulk_strand' => ['required', 'string', Rule::in(['__unchanged__', '__general__', ...$shsStrands->all()])],
            'bulk_year_level' => ['required', 'string', Rule::in(['__unchanged__', '__clear__', ...$yearLevels->all()])],
            'bulk_semester' => ['required', 'string', Rule::in(['__unchanged__', '__clear__', '1st', '2nd', 'summer'])],
            'prerequisite_mode' => ['required', Rule::in(['unchanged', 'replace', 'clear'])],
            'prerequisite_ids' => ['nullable', 'array'],
            'prerequisite_ids.*' => ['distinct', 'integer', 'exists:subjects,id'],
        ]);

        $updatedCount = DB::transaction(function () use ($data, $request): int {
            $subjects = Subject::query()->whereIn('id', $data['subject_ids'])->get();
            $prerequisiteIds = array_map('intval', $data['prerequisite_ids'] ?? []);

            foreach ($subjects as $subject) {
                $updates = [];
                if ($subject->program_type === 'college' && $data['bulk_course'] !== '__unchanged__') {
                    $updates['course'] = $data['bulk_course'] === '__general__' ? null : $data['bulk_course'];
                }
                if ($subject->program_type === 'shs' && $data['bulk_strand'] !== '__unchanged__') {
                    $updates['strand'] = $data['bulk_strand'] === '__general__' ? null : $data['bulk_strand'];
                }
                if ($data['bulk_year_level'] !== '__unchanged__') {
                    $updates['year_level'] = $data['bulk_year_level'] === '__clear__' ? null : $data['bulk_year_level'];
                }
                if ($data['bulk_semester'] !== '__unchanged__') {
                    $updates['semester'] = $data['bulk_semester'] === '__clear__' ? null : $data['bulk_semester'];
                }

                if ($updates) {
                    $subject->update($updates);
                }

                if ($data['prerequisite_mode'] === 'unchanged') {
                    continue;
                }

                $prerequisitesBefore = $subject->prerequisites()->allRelatedIds()->all();
                $nextPrerequisiteIds = $data['prerequisite_mode'] === 'replace'
                    ? array_values(array_diff($prerequisiteIds, [$subject->id]))
                    : [];
                $subject->prerequisites()->sync($nextPrerequisiteIds);
                ActivityLog::recordRelationChange(
                    $request,
                    $subject,
                    'prerequisites',
                    $prerequisitesBefore,
                    $subject->prerequisites()->allRelatedIds()->all()
                );
            }

            return $subjects->count();
        });

        return back()->with('status', "Updated {$updatedCount} subjects.");
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
