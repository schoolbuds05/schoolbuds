<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Web\Concerns\AuthorizesPortal;
use App\Models\ArchivedRecord;
use App\Models\Course;
use App\Models\Section;
use App\Models\SectionSubject;
use App\Models\Student;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Role;

class ArchiveController extends Controller
{
    use AuthorizesPortal;

    public function index(Request $request)
    {
        $this->requireAnyRole($request, ['admin']);

        $archives = ArchivedRecord::query()
            ->with(['deletedBy:id,name,email', 'restoredBy:id,name,email'])
            ->when($request->record_type, fn ($query) => $query->where('record_type', $request->record_type))
            ->when($request->search, fn ($query) => $query->where(fn ($inner) => $inner
                ->where('label', 'like', "%{$request->search}%")
                ->orWhere('record_type', 'like', "%{$request->search}%")
                ->orWhere('source', 'like', "%{$request->search}%")))
            ->latest('deleted_at')
            ->paginate(20)
            ->withQueryString();

        $recordTypes = ArchivedRecord::query()
            ->select('record_type')
            ->distinct()
            ->orderBy('record_type')
            ->pluck('record_type');

        return view('archive.index', compact('archives', 'recordTypes'));
    }

    public function restore(Request $request, ArchivedRecord $archive)
    {
        $this->requireAnyRole($request, ['admin']);

        if ($archive->restored_at) {
            return back()->withErrors(['archive' => 'This archive item has already been restored.']);
        }

        try {
            DB::transaction(function () use ($archive, $request) {
                $this->restoreRecord($archive);
                $archive->update([
                    'restored_by' => $request->user()->id,
                    'restored_at' => now(),
                ]);
            });
        } catch (\Throwable $exception) {
            return back()->withErrors(['archive' => $exception->getMessage()]);
        }

        return back()->with('status', "{$archive->record_type} restored.");
    }

    private function restoreRecord(ArchivedRecord $archive): void
    {
        $attributes = $archive->payload['attributes'] ?? [];

        match ($archive->record_type) {
            'Course' => $this->restoreModel(Course::class, $attributes),
            'Subject' => $this->restoreModel(Subject::class, $attributes),
            'Section' => $this->restoreModel(Section::class, $attributes),
            'SectionSubject' => $this->restoreModel(SectionSubject::class, $attributes),
            'User' => $this->restoreUser($attributes, $archive->payload['relations'] ?? []),
            'Student' => $this->restoreStudent($attributes),
            default => throw new \RuntimeException("Restore is not available for {$archive->record_type}."),
        };
    }

    private function restoreModel(string $modelClass, array $attributes)
    {
        $id = $attributes['id'] ?? null;
        if ($id && $modelClass::query()->whereKey($id)->exists()) {
            throw new \RuntimeException('A record with the original ID already exists.');
        }

        return $modelClass::unguarded(function () use ($modelClass, $attributes) {
            $model = new $modelClass();
            $model->setRawAttributes($this->cleanAttributes($attributes), true);
            $model->exists = false;
            $model->save();

            return $model;
        });
    }

    private function restoreUser(array $attributes, array $relations): User
    {
        if (!empty($attributes['id']) && User::whereKey($attributes['id'])->exists()) {
            throw new \RuntimeException('A user with the original ID already exists.');
        }

        if (!empty($attributes['email']) && User::where('email', $attributes['email'])->exists()) {
            throw new \RuntimeException('A user with this email already exists.');
        }

        $user = User::unguarded(function () use ($attributes) {
            $user = new User();
            $user->setRawAttributes($this->cleanAttributes($attributes), true);
            $user->exists = false;
            $user->save();

            return $user;
        });

        $roleNames = collect($relations['roles'] ?? [])
            ->pluck('name')
            ->push($user->role)
            ->filter()
            ->unique()
            ->values();

        $roleNames->each(fn (string $role) => Role::findOrCreate($role, 'web'));
        if ($roleNames->isNotEmpty()) {
            $user->syncRoles($roleNames->all());
        }

        return $user;
    }

    private function restoreStudent(array $attributes): Student
    {
        if (!empty($attributes['id']) && Student::whereKey($attributes['id'])->exists()) {
            throw new \RuntimeException('A student with the original ID already exists.');
        }

        if (!empty($attributes['student_id']) && Student::where('student_id', $attributes['student_id'])->exists()) {
            throw new \RuntimeException('A student with this student ID already exists.');
        }

        if (!empty($attributes['email']) && Student::where('email', $attributes['email'])->exists()) {
            throw new \RuntimeException('A student with this email already exists.');
        }

        return Student::unguarded(function () use ($attributes) {
            $student = new Student();
            $student->setRawAttributes($this->cleanAttributes($attributes), true);
            $student->exists = false;
            $student->save();

            return $student;
        });
    }

    private function cleanAttributes(array $attributes): array
    {
        return Arr::except($attributes, []);
    }
}
