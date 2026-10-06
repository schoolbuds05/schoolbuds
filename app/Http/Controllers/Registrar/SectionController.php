<?php

namespace App\Http\Controllers\Registrar;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Web\Concerns\AuthorizesPortal;
use App\Models\Course;
use App\Models\Section;
use App\Models\SectionSubject;
use App\Models\Student;
use App\Models\Subject;
use App\Models\User;
use App\Services\ArchiveService;
use Illuminate\Http\Request;

class SectionController extends Controller
{
    use AuthorizesPortal;

    public function index(Request $request)
    {
        $this->requireAnyRole($request, ['admin', 'registrar']);

        $sections = Section::query()
            ->with([
                'sectionSubjects.subject',
                'sectionSubjects.teacher',
                'students' => fn ($query) => $query
                    ->wherePivot('status', 'enrolled')
                    ->orderBy('name')
                    ->select('users.id', 'users.name', 'users.email'),
            ])
            ->when($request->program_type, fn ($query) => $query->where('program_type', $request->program_type))
            ->when($request->filled('course'), fn ($query) => $query->where('course', $request->course))
            ->when($request->filled('semester'), fn ($query) => $query->where('semester', $request->semester))
            ->when($request->filled('school_year'), fn ($query) => $query->where('school_year', $request->school_year))
            ->when($request->has('is_active'), fn ($query) => $query->where('is_active', (bool) $request->boolean('is_active')))
            ->when($request->search, function ($query) use ($request) {
                $term = "%{$request->search}%";
                $query->where(function ($innerQuery) use ($term, $request) {
                    $innerQuery->where('name', 'like', $term)
                        ->orWhere('course', 'like', $term)
                        ->orWhere('strand', 'like', $term)
                        ->orWhere('school_year', 'like', $term);
                });
            })
            ->orderByDesc('school_year')
            ->orderBy('name')
            ->paginate(15)
            ->withQueryString();
        $courses = Course::query()
            ->where('is_active', true)
            ->where('program_type', 'college')
            ->orderBy('name')
            ->get();
        $subjects = Subject::query()
            ->where('is_active', true)
            ->orderBy('code')
            ->get();
        $teachers = User::query()
            ->whereIn('role', User::FACULTY_ROLES)
            ->orWhereHas('roles', fn ($query) => $query->whereIn('name', User::FACULTY_ROLES))
            ->orderBy('name')
            ->get(['id', 'name', 'email']);
        $students = Student::query()
            ->with('user:id,name,email')
            ->where('status', 'active')
            ->whereNotNull('user_id')
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->get(['id', 'user_id', 'student_id', 'first_name', 'last_name', 'email', 'grade_level', 'section', 'school_year']);
        $schoolYears = Section::query()
            ->whereNotNull('school_year')
            ->where('school_year', '!=', '')
            ->distinct()
            ->orderByDesc('school_year')
            ->pluck('school_year');

        return view('registrar.sections.index', compact('sections', 'courses', 'subjects', 'teachers', 'students', 'schoolYears'));
    }

    public function store(Request $request)
    {
        $this->requireAnyRole($request, ['admin', 'registrar']);
        Section::create($this->validated($request));

        return back()->with('status', 'Section created.');
    }

    public function update(Request $request, Section $section)
    {
        $this->requireAnyRole($request, ['admin', 'registrar']);
        $section->update($this->validated($request));

        return back()->with('status', 'Section updated.');
    }

    public function assignSubject(Request $request, Section $section)
    {
        $this->requireAnyRole($request, ['admin', 'registrar']);

        $data = $request->validate([
            'subject_id' => ['required', 'integer', 'exists:subjects,id'],
            'teacher_id' => ['nullable', 'integer', 'exists:users,id'],
            'day' => ['nullable', 'string', 'max:100'],
            'days' => ['nullable', 'array'],
            'days.*' => ['string', 'in:Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday'],
            'time_start' => ['nullable', 'string', 'max:10'],
            'time_end' => ['nullable', 'string', 'max:10'],
            'room' => ['nullable', 'string', 'max:50'],
        ]);

        SectionSubject::updateOrCreate(
            [
                'section_id' => $section->id,
                'subject_id' => $data['subject_id'],
            ],
            [
                'teacher_id' => $data['teacher_id'] ?? null,
                'day' => !empty($data['days']) ? implode(', ', $data['days']) : ($data['day'] ?? null),
                'time_start' => $data['time_start'] ?? null,
                'time_end' => $data['time_end'] ?? null,
                'room' => $data['room'] ?? null,
            ]
        );

        return back()->with('status', 'Subject assigned to section.');
    }

    public function removeSubject(Request $request, Section $section, SectionSubject $sectionSubject)
    {
        $this->requireAnyRole($request, ['admin', 'registrar']);
        abort_unless((int) $sectionSubject->section_id === (int) $section->id, 404);

        ArchiveService::record($sectionSubject, $request->user()?->id, 'web.sections.subjects');
        $sectionSubject->delete();

        return back()->with('status', 'Subject removed from section.');
    }

    public function destroy(Request $request, Section $section)
    {
        $this->requireAnyRole($request, ['admin', 'registrar']);

        ArchiveService::record($section, $request->user()?->id, 'web.sections');
        $section->delete();

        return back()->with('status', 'Section archived and removed.');
    }

    public function enrollStudent(Request $request, Section $section)
    {
        $this->requireAnyRole($request, ['admin', 'registrar']);

        $data = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
        ]);

        if ($section->students()->wherePivot('status', 'enrolled')->count() >= $section->max_students) {
            return back()->withErrors(['section' => 'This section has reached its maximum students.']);
        }

        $studentUser = User::findOrFail($data['user_id']);
        if ($studentUser->role !== User::ROLE_STUDENT && !$studentUser->hasRole(User::ROLE_STUDENT)) {
            return back()->withErrors(['student' => 'Only student accounts can be enrolled in a section.']);
        }

        $section->students()->syncWithoutDetaching([
            $studentUser->id => ['status' => 'enrolled'],
        ]);

        Student::where('user_id', $studentUser->id)->update(['section' => $section->name]);

        return back()->with('status', 'Student added to section.');
    }

    public function removeStudent(Request $request, Section $section, User $student)
    {
        $this->requireAnyRole($request, ['admin', 'registrar']);

        $section->students()->detach($student->id);
        Student::where('user_id', $student->id)->update(['section' => 'TBA']);

        return back()->with('status', 'Student removed from section.');
    }

    private function validated(Request $request): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'course' => ['nullable', 'string', 'max:100'],
            'year_level' => ['nullable', 'string', 'max:5'],
            'program_type' => ['required', 'in:shs,college'],
            'strand' => ['nullable', 'string', 'max:20'],
            'school_year' => ['required', 'string', 'max:20'],
            'semester' => ['required', 'in:1st,2nd,summer'],
            'max_students' => ['required', 'integer', 'min:1'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        return [
            ...$data,
            'course' => $data['program_type'] === 'college' ? ($data['course'] ?: null) : null,
            'strand' => $data['program_type'] === 'shs' ? ($data['strand'] ?: null) : null,
            'is_active' => (bool) ($data['is_active'] ?? false),
        ];
    }
}
