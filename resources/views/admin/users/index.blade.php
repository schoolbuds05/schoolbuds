@extends('layouts.portal', ['title' => 'Users'])

@section('content')
@php
    $manageableRoles = \App\Models\User::ADMIN_MANAGEABLE_ROLES;
    $allRoles = \App\Models\User::ROLES;
    $roleLabel = fn ($role) => ucwords(str_replace('_', ' ', $role));
    $positions = \App\Models\User::POSITIONS;
    $positionLabel = fn ($position) => $position === 'head_department' ? 'Department Chair' : ($position ? ucwords(str_replace('_', ' ', $position)) : null);
@endphp
<section>
        <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
            <h1 class="text-2xl font-black text-slate-900">Users</h1>
            <p class="mt-1 text-sm text-slate-500">Manage admin, registrar, faculty, parent, and staff web/mobile accounts.</p>
            </div>
        </div>

        <div id="create-user-modal" class="fixed inset-0 {{ old('form_context') === 'create_user' ? 'flex' : 'hidden' }} items-center justify-center p-4" style="z-index: 9998; background: rgba(15, 23, 42, 0.82); backdrop-filter: blur(3px);" data-user-modal role="dialog" aria-modal="true" aria-labelledby="create-user-title">
            <div class="max-h-[90vh] w-[min(92vw,440px)] overflow-y-auto rounded-xl bg-white shadow-2xl">
                <div class="flex items-start justify-between gap-4 border-b border-violet-200 bg-violet-50 p-5">
                    <div>
                        <p class="text-[10px] font-black uppercase tracking-[0.18em] text-violet-500">New account</p>
                        <h2 id="create-user-title" class="mt-1 text-lg font-black text-slate-900">Create staff user</h2>
                    </div>
                    <button type="button" data-user-modal-close="create-user-modal" class="rounded-lg bg-white px-3 py-2 text-xs font-black text-slate-600 shadow-sm hover:bg-slate-50">Close</button>
                </div>
                <form method="POST" action="{{ route('admin.users.store') }}" class="space-y-3 p-5">
                    @csrf
                    <input type="hidden" name="form_context" value="create_user">
                    <label class="block text-xs font-bold uppercase text-slate-500">
                        Full name
                        <input name="name" value="{{ old('form_context') === 'create_user' ? old('name') : '' }}" placeholder="Full name" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                    </label>
                    <label class="block text-xs font-bold uppercase text-slate-500">
                        Email
                        <input name="email" type="email" value="{{ old('form_context') === 'create_user' ? old('email') : '' }}" placeholder="Email" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                    </label>
                    <label class="block text-xs font-bold uppercase text-slate-500">
                        Role
                        <select name="role" data-role-select class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                            @foreach($manageableRoles as $role)
                                <option value="{{ $role }}" @selected(old('form_context') === 'create_user' ? old('role') === $role : $loop->first)>{{ $roleLabel($role) }}</option>
                            @endforeach
                        </select>
                    </label>
                    <label class="block text-xs font-bold uppercase text-slate-500">
                        Sub-role / Position
                        <select name="position" data-position-select class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                            <option value="">Default / No sub-role</option>
                            @foreach($positions as $role => $rolePositions)
                                @foreach($rolePositions as $position)
                                    <option value="{{ $position }}" data-position-role="{{ $role }}" @selected(old('form_context') === 'create_user' && old('position') === $position)>{{ $positionLabel($position) }}</option>
                                @endforeach
                            @endforeach
                        </select>
                    </label>
                    <label data-department-field class="hidden block text-xs font-bold uppercase text-slate-500">
                        Assigned program / department
                        <select name="department_id" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900"><option value="">Choose department</option>@foreach($departments as $department)<option value="{{ $department->id }}" @selected(old('department_id') == $department->id)>{{ $department->code }} — {{ $department->name }}</option>@endforeach</select>
                    </label>
                    <label class="block text-xs font-bold uppercase text-slate-500">
                        Temporary password
                        <input name="password" type="password" autocomplete="new-password" placeholder="Temporary password" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                    </label>
                    <div class="flex justify-end gap-3 pt-3">
                        <button type="button" data-user-modal-close="create-user-modal" class="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
                        <button class="rounded-lg bg-portal-accent px-5 py-2 text-sm font-bold text-white hover:bg-portal-accent-hover">Create user</button>
                    </div>
                </form>
            </div>
        </div>

        <form method="GET" class="mb-5 grid grid-cols-1 gap-3 rounded-xl border border-violet-100 bg-white p-3 shadow-sm md:grid-cols-[1fr_170px_auto]">
            <input name="search" value="{{ request('search') }}" placeholder="Search name or email" class="rounded-lg border-violet-200 text-sm focus:border-violet-400 focus:ring-violet-300">
            <select name="role" class="rounded-lg border-violet-200 text-sm focus:border-violet-400 focus:ring-violet-300">
                <option value="">All roles</option>
                @foreach($allRoles as $role)
                    <option value="{{ $role }}" @selected(request('role') === $role)>{{ $roleLabel($role) }}</option>
                @endforeach
            </select>
            <div class="flex justify-end gap-2">
                <button class="portal-filter-button rounded-lg bg-portal-accent px-5 py-2 text-sm font-bold text-white">Filter</button>
                <button type="button" data-user-modal-open="create-user-modal" class="rounded-lg bg-portal-accent px-5 py-2 text-sm font-bold text-white transition hover:bg-portal-accent-hover">Create user</button>
            </div>
        </form>

        <div class="overflow-hidden rounded-xl border border-violet-100 bg-white shadow-sm shadow-violet-900/5">
            <div class="hidden grid-cols-[1.45fr_1fr_150px_140px_80px] border-b border-slate-100 bg-slate-50 px-5 py-3 md:grid">
                <p class="text-[11px] font-black uppercase text-slate-500">User</p>
                <p class="text-[11px] font-black uppercase text-slate-500">Email</p>
                <p class="text-[11px] font-black uppercase text-slate-500">Role</p>
                <p class="text-[11px] font-black uppercase text-slate-500">Created</p>
                <p class="text-right text-[11px] font-black uppercase text-slate-500">Action</p>
            </div>
            <div class="divide-y divide-slate-100">
            @foreach($users as $user)
                <button
                    type="button"
                    data-user-modal-open="user-modal-{{ $user->id }}"
                    class="group grid w-full grid-cols-[44px_1fr_auto] gap-3 px-5 py-4 text-left transition hover:bg-violet-50/50 md:grid-cols-[1.45fr_1fr_150px_140px_80px] md:items-center"
                >
                    <div class="flex min-w-0 items-center gap-3">
                        <span class="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-xs font-black text-slate-500 group-hover:bg-white">
                            @if($user->profile_photo_url)
                                <img src="{{ $user->profile_photo_url }}" alt="{{ $user->name }} profile photo" class="h-full w-full object-cover" loading="lazy">
                            @else
                                {{ strtoupper(substr($user->name ?: $user->email, 0, 2)) }}
                            @endif
                        </span>
                        <div class="min-w-0">
                            <p class="truncate text-sm font-black text-slate-900">{{ $user->name }}</p>
                            <p class="mt-1 truncate text-[11px] font-semibold text-slate-500 md:hidden">{{ $user->email }}</p>
                        </div>
                    </div>
                    <p class="hidden truncate text-xs font-semibold text-slate-600 md:block">{{ $user->email }}</p>
                    <span class="w-fit rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">
                        {{ $roleLabel($user->role) }}{{ $user->position ? ' - ' . $positionLabel($user->position) : '' }}
                    </span>
                    <p class="hidden text-xs font-semibold text-slate-600 md:block">{{ $user->created_at?->format('Y-m-d') }}</p>
                    <span class="text-right text-sm font-black text-portal-accent">Open</span>
                </button>

                <div id="user-modal-{{ $user->id }}" class="fixed inset-0 hidden items-center justify-center p-4" style="z-index: 9998; background: rgba(15, 23, 42, 0.82); backdrop-filter: blur(3px);" data-user-modal>
                    <div class="w-[min(92vw,340px)] overflow-hidden rounded-xl bg-white shadow-2xl">
                        <div class="flex items-start justify-between gap-4 border-b border-violet-200 bg-violet-50 p-4">
                            <div>
                                <p class="text-[10px] font-black uppercase tracking-[0.18em] text-violet-500">User account</p>
                                <h2 class="mt-1 text-lg font-black text-slate-900">{{ $user->name }}</h2>
                                <p class="mt-1 text-sm text-slate-500">{{ $user->email }}</p>
                            </div>
                            <button type="button" data-user-modal-close="user-modal-{{ $user->id }}" class="rounded-lg bg-white px-3 py-2 text-xs font-black text-slate-600 shadow-sm hover:bg-slate-50">Close</button>
                        </div>

                        <form method="POST" action="{{ route('admin.users.update', $user) }}" class="space-y-3 p-4">
                            @csrf
                            @method('PUT')
                            <label class="block text-xs font-bold uppercase text-slate-500">
                                Full name
                                <input name="name" value="{{ $user->name }}" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                            </label>
                            <label class="block text-xs font-bold uppercase text-slate-500">
                                Email
                                <input name="email" value="{{ $user->email }}" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                            </label>
                            <label class="block text-xs font-bold uppercase text-slate-500">
                                Role
                                <select name="role" data-role-select class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                                    @foreach($manageableRoles as $role)
                                        <option value="{{ $role }}" @selected($user->role === $role)>{{ $roleLabel($role) }}</option>
                                    @endforeach
                                </select>
                            </label>
                            <label class="block text-xs font-bold uppercase text-slate-500">
                                Sub-role / Position
                                <select name="position" data-position-select class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                                    <option value="">Default / No sub-role</option>
                                    @foreach($positions as $role => $rolePositions)
                                        @foreach($rolePositions as $position)
                                            <option value="{{ $position }}" data-position-role="{{ $role }}" @selected($user->position === $position)>{{ $positionLabel($position) }}</option>
                                        @endforeach
                                    @endforeach
                                </select>
                            </label>
                            <label data-department-field class="hidden block text-xs font-bold uppercase text-slate-500">
                                Assigned program / department
                                <select name="department_id" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900"><option value="">Choose department</option>@foreach($departments as $department)<option value="{{ $department->id }}" @selected($user->department_id === $department->id)>{{ $department->code }} — {{ $department->name }}</option>@endforeach</select>
                            </label>
                            <label class="block text-xs font-bold uppercase text-slate-500">
                                New password
                                <input name="password" type="password" placeholder="Optional" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                            </label>
                            <div class="flex flex-col-reverse gap-3 pt-3 sm:flex-row sm:justify-between">
                                <button
                                    type="button"
                                    data-delete-modal-open="delete-user-modal-{{ $user->id }}"
                                    class="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                                    @disabled($user->id === auth()->id())
                                >
                                    Delete user
                                </button>
                                <button class="rounded-lg bg-portal-accent px-5 py-2 text-sm font-bold text-white hover:bg-portal-accent-hover">Save changes</button>
                            </div>
                        </form>
                        <form id="delete-user-{{ $user->id }}" method="POST" action="{{ route('admin.users.destroy', $user) }}" class="hidden">
                            @csrf
                            @method('DELETE')
                        </form>
                    </div>
                </div>

                <div id="delete-user-modal-{{ $user->id }}" class="fixed inset-0 hidden items-center justify-center p-4" style="z-index: 9999; background: rgba(15, 23, 42, 0.88); backdrop-filter: blur(4px);" data-delete-modal>
                    <div class="w-[min(92vw,300px)] overflow-hidden rounded-xl bg-white shadow-2xl">
                        <div class="border-b border-red-100 bg-red-50 p-4">
                            <p class="text-[10px] font-black uppercase tracking-[0.18em] text-red-500">Delete warning</p>
                            <h2 class="mt-1 text-lg font-black text-slate-950">Delete this user?</h2>
                            <p class="mt-2 text-xs leading-5 text-slate-600">
                                This account will be removed from active users. A recoverable archive snapshot will be saved for admin review.
                            </p>
                        </div>
                        <div class="space-y-3 p-4">
                            <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                <p class="text-sm font-black text-slate-900">{{ $user->name }}</p>
                                <p class="mt-1 text-xs font-semibold text-slate-500">{{ $user->email }}</p>
                                <p class="mt-2 w-fit rounded-full bg-white px-2.5 py-1 text-xs font-black text-slate-600">
                                    {{ $roleLabel($user->role) }}{{ $user->position ? ' - ' . $positionLabel($user->position) : '' }}
                                </p>
                            </div>
                            <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                                <button type="button" data-delete-modal-close="delete-user-modal-{{ $user->id }}" class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">
                                    Cancel
                                </button>
                                <button type="submit" form="delete-user-{{ $user->id }}" class="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700">
                                    Delete user
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            @endforeach
            </div>
            <div class="p-4">{{ $users->links() }}</div>
        </div>
</section>

<script>
    const syncPositionOptions = (roleSelect) => {
        const form = roleSelect.closest('form');
        const positionSelect = form?.querySelector('[data-position-select]');
        const departmentField = form?.querySelector('[data-department-field]');
        if (!positionSelect) return;

        const role = roleSelect.value;
        Array.from(positionSelect.options).forEach((option) => {
            const optionRole = option.dataset.positionRole;
            const shouldHide = optionRole && optionRole !== role;
            option.hidden = shouldHide;
            option.disabled = shouldHide;
        });

        if (positionSelect.selectedOptions[0]?.disabled) {
            positionSelect.value = '';
        }

        const isDepartmentChair = role === 'faculty' && positionSelect.value === 'head_department';
        departmentField?.classList.toggle('hidden', !isDepartmentChair);
    };

    document.querySelectorAll('[data-role-select]').forEach((roleSelect) => {
        syncPositionOptions(roleSelect);
        roleSelect.addEventListener('change', () => syncPositionOptions(roleSelect));
        roleSelect.closest('form')?.querySelector('[data-position-select]')?.addEventListener('change', () => syncPositionOptions(roleSelect));
    });

    document.querySelectorAll('[data-user-modal-open]').forEach((button) => {
        button.addEventListener('click', () => {
            const modal = document.getElementById(button.dataset.userModalOpen);
            modal?.classList.remove('hidden');
            modal?.classList.add('flex');
        });
    });

    document.querySelectorAll('[data-user-modal-close]').forEach((button) => {
        button.addEventListener('click', () => {
            const modal = document.getElementById(button.dataset.userModalClose);
            modal?.classList.add('hidden');
            modal?.classList.remove('flex');
        });
    });

    document.querySelectorAll('[data-user-modal]').forEach((modal) => {
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            }
        });
    });

    document.querySelectorAll('[data-delete-modal-open]').forEach((button) => {
        button.addEventListener('click', () => {
            const modal = document.getElementById(button.dataset.deleteModalOpen);
            modal?.classList.remove('hidden');
            modal?.classList.add('flex');
        });
    });

    document.querySelectorAll('[data-delete-modal-close]').forEach((button) => {
        button.addEventListener('click', () => {
            const modal = document.getElementById(button.dataset.deleteModalClose);
            modal?.classList.add('hidden');
            modal?.classList.remove('flex');
        });
    });

    document.querySelectorAll('[data-delete-modal]').forEach((modal) => {
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            }
        });
    });
</script>
@endsection
