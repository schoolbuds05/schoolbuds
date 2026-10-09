<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\User;
use App\Services\ArchiveService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Spatie\Permission\Models\Role;

class AdminUserController extends Controller
{
    private array $manageableRoles = User::ADMIN_MANAGEABLE_ROLES;

    public function dashboard(Request $request)
    {
        $this->authorizeAdmin($request);

        $counts = User::query()
            ->selectRaw('role, COUNT(*) as total')
            ->whereIn('role', User::ROLES)
            ->groupBy('role')
            ->pluck('total', 'role');

        $positionCounts = User::query()
            ->selectRaw('position, COUNT(*) as total')
            ->whereNotNull('position')
            ->groupBy('position')
            ->pluck('total', 'position');

        $recentUsers = User::query()
            ->whereIn('role', $this->manageableRoles)
            ->latest()
            ->limit(5)
            ->get(['id', 'name', 'email', 'role', 'position', 'created_at']);

        return response()->json([
            'counts' => [
                'admins'     => (int) ($counts['admin'] ?? 0),
                'registrars' => (int) ($counts['registrar'] ?? 0),
                'faculty'    => (int) ($counts['faculty'] ?? 0) + (int) ($counts['teacher'] ?? 0),
                'head_teachers' => (int) ($positionCounts['head_teacher'] ?? 0),
                'deans'      => (int) ($positionCounts['dean'] ?? 0),
                'parents'    => (int) ($counts['parent'] ?? 0),
                'staff'      => (int) ($counts['staff'] ?? 0),
                'librarians' => (int) ($positionCounts['librarian'] ?? 0),
                'property_custodians' => (int) ($positionCounts['property_custodian'] ?? 0),
                'students'   => (int) ($counts['student'] ?? 0),
            ],
            'roles' => $this->roleOptions(),
            'positions' => $this->positionOptions(),
            'recent_users' => $recentUsers,
        ]);
    }

    public function index(Request $request)
    {
        $this->authorizeAdmin($request);

        $role = $request->query('role');
        $search = trim((string) $request->query('search', ''));

        $users = User::query()
            ->whereIn('role', $this->manageableRoles)
            ->when(in_array($role, $this->manageableRoles, true), fn ($query) => $query->where('role', $role))
            ->when($search !== '', function ($query) use ($search) {
                $escapedSearch = addcslashes($search, '%_');
                $query->where(function ($inner) use ($escapedSearch) {
                    $inner->where('name', 'like', "%{$escapedSearch}%")
                        ->orWhere('email', 'like', "%{$escapedSearch}%");
                });
            })
            ->orderBy('role')
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'role', 'position', 'department', 'created_at', 'updated_at']);

        return response()->json([
            'roles' => $this->roleOptions(),
            'positions' => $this->positionOptions(),
            'users' => $users,
        ]);
    }

    public function store(Request $request)
    {
        $this->authorizeAdmin($request);

        $data = $request->validate([
            'name'     => ['required', 'string', 'max:255'],
            'email'    => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:6'],
            'role'     => ['required', Rule::in($this->manageableRoles)],
            'position' => ['nullable', 'string', Rule::in($this->allowedPositions())],
            'department' => ['nullable', 'string', 'max:255', 'required_if:position,head_department'],
        ]);

        $data['position'] = $this->positionForRole($data['role'], $data['position'] ?? null);
        $data['department'] = $data['position'] === User::POSITION_HEAD_DEPARTMENT ? trim((string) ($data['department'] ?? '')) : null;

        $user = User::create([
            'name'     => $data['name'],
            'email'    => $data['email'],
            'password' => Hash::make($data['password']),
            'role'     => $data['role'],
            'position' => $data['position'],
            'department' => $data['department'] ?? null,
        ]);

        $this->syncRole($request, $user, $data['role']);

        ActivityLog::record($request, 'admin_user_created', "{$request->user()->name} created user {$user->name}.", [
            'subject_type' => User::class,
            'subject_id' => $user->id,
            'meta' => ['created_role' => $user->role, 'created_email' => $user->email],
        ]);

        return response()->json($user->only(['id', 'name', 'email', 'role', 'position', 'department', 'created_at', 'updated_at']), 201);
    }

    public function update(Request $request, User $user)
    {
        $this->authorizeAdmin($request);
        $this->ensureManageable($user);

        $data = $request->validate([
            'name'     => ['required', 'string', 'max:255'],
            'email'    => ['required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'password' => ['nullable', 'string', 'min:6'],
            'role'     => ['required', Rule::in($this->manageableRoles)],
            'position' => ['nullable', 'string', Rule::in($this->allowedPositions())],
            'department' => ['nullable', 'string', 'max:255', 'required_if:position,head_department'],
        ]);

        $data['position'] = $this->positionForRole($data['role'], $data['position'] ?? null);
        $data['department'] = $data['position'] === User::POSITION_HEAD_DEPARTMENT ? trim((string) ($data['department'] ?? '')) : null;

        if ($user->id === $request->user()->id && $data['role'] !== 'admin') {
            return response()->json(['message' => 'You cannot remove admin access from your own account.'], 422);
        }

        if ($this->isLastAdmin($user) && $data['role'] !== 'admin') {
            return response()->json(['message' => 'At least one admin account is required.'], 422);
        }

        $user->name = $data['name'];
        $user->email = $data['email'];
        $user->role = $data['role'];
        $user->position = $data['position'];
        $user->department = $data['department'] ?? null;

        if (!empty($data['password'])) {
            $user->password = Hash::make($data['password']);
        }

        $user->save();
        $this->syncRole($request, $user, $data['role']);

        ActivityLog::record($request, 'admin_user_updated', "{$request->user()->name} updated user {$user->name}.", [
            'subject_type' => User::class,
            'subject_id' => $user->id,
            'meta' => ['updated_role' => $user->role, 'updated_email' => $user->email],
        ]);

        return response()->json($user->only(['id', 'name', 'email', 'role', 'position', 'department', 'created_at', 'updated_at']));
    }

    public function destroy(Request $request, User $user)
    {
        $this->authorizeAdmin($request);
        $this->ensureManageable($user);

        if ($user->id === $request->user()->id) {
            return response()->json(['message' => 'You cannot delete your own account.'], 422);
        }

        if ($this->isLastAdmin($user)) {
            return response()->json(['message' => 'At least one admin account is required.'], 422);
        }

        ArchiveService::record($user, $request->user()?->id, 'api.admin.users');

        $deleted = [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
        ];

        $user->delete();

        ActivityLog::record($request, 'admin_user_deleted', "{$request->user()->name} deleted user {$deleted['name']}.", [
            'subject_type' => User::class,
            'subject_id' => $deleted['id'],
            'meta' => $deleted,
        ]);

        return response()->json(['message' => 'User deleted.']);
    }

    private function authorizeAdmin(Request $request): void
    {
        $user = $request->user();

        if (!$user || ($user->role !== 'admin' && !$user->hasRole('admin'))) {
            abort(response()->json(['message' => 'Admin access is required.'], 403));
        }
    }

    private function ensureManageable(User $user): void
    {
        if (!in_array($user->role, $this->manageableRoles, true) && !$user->hasAnyRole($this->manageableRoles)) {
            abort(response()->json(['message' => 'This user cannot be managed from the admin mobile dashboard.'], 422));
        }
    }

    private function syncRole(Request $request, User $user, string $role): void
    {
        Role::findOrCreate($role, 'web');
        $rolesBefore = $user->getRoleNames()->all();
        $user->syncRoles([$role]);
        ActivityLog::recordRelationChange($request, $user, 'roles', $rolesBefore, $user->getRoleNames()->all());
    }

    private function roleOptions(): array
    {
        return collect($this->manageableRoles)
            ->map(fn (string $role) => [
                'value' => $role,
                'label' => str($role)->replace('_', ' ')->title()->toString(),
            ])
            ->values()
            ->all();
    }

    private function positionOptions(): array
    {
        return collect(User::POSITIONS)
            ->mapWithKeys(fn (array $positions, string $role) => [
                $role => collect($positions)
                    ->map(fn (string $position) => [
                        'value' => $position,
                        'label' => $position === User::POSITION_HEAD_DEPARTMENT
                            ? 'Department Chair'
                            : str($position)->replace('_', ' ')->title()->toString(),
                    ])
                    ->values()
                    ->all(),
            ])
            ->all();
    }

    private function allowedPositions(): array
    {
        return collect(User::POSITIONS)->flatten()->values()->all();
    }

    private function positionForRole(string $role, ?string $position): ?string
    {
        if ($role === User::ROLE_FACULTY && !$position) {
            return User::POSITION_TEACHER;
        }

        if (!$position) {
            return null;
        }

        return in_array($position, User::POSITIONS[$role] ?? [], true) ? $position : null;
    }

    private function isLastAdmin(User $user): bool
    {
        if ($user->role !== 'admin' && !$user->hasRole('admin')) {
            return false;
        }

        return User::query()
            ->where('role', 'admin')
            ->orWhereHas('roles', fn ($query) => $query->where('name', 'admin'))
            ->count() <= 1;
    }
}
