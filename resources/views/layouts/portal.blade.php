@php
    $user = auth()->user();
    $role = $user?->role;

    $navGroups = [
        'Admin' => [
            ['label' => 'Dashboard', 'route' => 'admin.dashboard', 'match' => 'admin/dashboard', 'roles' => ['admin']],
            ['label' => 'Student', 'route' => 'admin.students.index', 'match' => 'admin/students*', 'roles' => ['admin']],
            ['label' => 'User', 'route' => 'admin.users.index', 'match' => 'admin/users*', 'roles' => ['admin']],
            ['label' => 'Department', 'route' => 'admin.departments.index', 'match' => 'admin/departments*', 'roles' => ['admin']],
            ['label' => 'Control', 'route' => 'admin.controls.index', 'match' => 'admin/controls*', 'roles' => ['admin']],
            ['label' => 'Activity Log', 'route' => 'admin.activity.index', 'match' => 'admin/activity*', 'roles' => ['admin']],
            ['label' => 'Report', 'route' => 'admin.reports.index', 'match' => 'admin/reports*', 'roles' => ['admin']],
            ['label' => 'Archive', 'route' => 'admin.archive.index', 'match' => 'admin/archive*', 'roles' => ['admin']],
        ],
        'Registrar' => [
            ['label' => 'Dashboard', 'route' => 'registrar.dashboard', 'match' => 'registrar/dashboard', 'roles' => ['admin', 'registrar']],
            ['label' => 'Enrollment', 'route' => 'registrar.enrollments.index', 'match' => 'registrar/enrollments*', 'roles' => ['admin', 'registrar']],
            ['label' => 'Student', 'route' => 'registrar.students.index', 'match' => 'registrar/students*', 'roles' => ['admin', 'registrar']],
            ['label' => 'Course', 'route' => 'registrar.courses.index', 'match' => 'registrar/courses*', 'roles' => ['admin', 'registrar']],
            ['label' => 'Subject', 'route' => 'registrar.subjects.index', 'match' => 'registrar/subjects*', 'roles' => ['admin', 'registrar']],
            ['label' => 'Request', 'route' => 'registrar.subject-requests.index', 'match' => 'registrar/subject-requests*', 'roles' => ['admin', 'registrar']],
            ['label' => 'Course Shifts', 'route' => 'registrar.course-shift-requests.index', 'match' => 'registrar/course-shift-requests*', 'roles' => ['admin', 'registrar']],
            ['label' => 'Section', 'route' => 'registrar.sections.index', 'match' => 'registrar/sections*', 'roles' => ['admin', 'registrar']],
            ['label' => 'Grade', 'route' => 'registrar.grades.index', 'match' => 'registrar/grades*', 'roles' => ['admin', 'registrar']],
            ['label' => 'Points', 'route' => 'registrar.points.index', 'match' => 'registrar/points*', 'roles' => ['admin', 'registrar']],
            ['label' => 'Report', 'route' => 'registrar.reports.index', 'match' => 'registrar/reports*', 'roles' => ['admin', 'registrar']],
            ['label' => 'Profile', 'route' => 'registrar.profile.show', 'match' => 'registrar/profile*', 'roles' => ['admin', 'registrar']],
        ],
        'Teacher' => [
            ['label' => 'Dashboard', 'route' => 'teacher.dashboard', 'match' => 'teacher/dashboard', 'roles' => ['faculty', 'teacher', 'head_department', 'head_teacher', 'dean']],
            ['label' => 'Classes', 'route' => 'teacher.classes', 'match' => 'teacher/classes', 'roles' => ['faculty', 'teacher', 'head_department', 'head_teacher', 'dean']],
            ['label' => 'Work', 'route' => 'teacher.assignments', 'match' => 'teacher/assignments*', 'roles' => ['faculty', 'teacher', 'head_department', 'head_teacher', 'dean']],
            ['label' => 'Market', 'route' => 'teacher.market', 'match' => 'teacher/market', 'roles' => ['faculty', 'teacher', 'head_department', 'head_teacher', 'dean']],
            ['label' => 'Chat', 'route' => 'teacher.chat', 'match' => 'teacher/chat', 'roles' => ['faculty', 'teacher', 'head_department', 'head_teacher', 'dean']],
            ['label' => 'Profile', 'route' => 'teacher.profile', 'match' => 'teacher/profile', 'roles' => ['faculty', 'teacher', 'head_department', 'head_teacher', 'dean']],
        ],
        'Department Chair' => [
            ['label' => 'Teacher List', 'route' => 'department-chair.teachers', 'match' => 'department-chair/teachers', 'roles' => ['head_department']],
            ['label' => 'Grade', 'route' => 'department-chair.grades', 'match' => 'department-chair/grades', 'roles' => ['head_department']],
            ['label' => 'Student', 'route' => 'department-chair.students', 'match' => 'department-chair/students', 'roles' => ['head_department']],
            ['label' => 'Report', 'route' => 'department-chair.reports', 'match' => 'department-chair/reports', 'roles' => ['head_department']],
        ],
        'Staff' => [
            ['label' => 'Property', 'route' => 'property-custodian.dashboard', 'match' => 'property-custodian/dashboard', 'roles' => ['admin', 'property_custodian']],
            ['label' => 'Market', 'route' => 'property-custodian.market', 'match' => 'property-custodian/market*', 'roles' => ['admin', 'property_custodian']],
            ['label' => 'Report', 'route' => 'property-custodian.reports', 'match' => 'property-custodian/reports*', 'roles' => ['admin', 'property_custodian']],
        ],
    ];

    $navIcons = [
        'Dashboard' => '<rect x="3" y="3" width="8" height="8" rx="1" /><rect x="13" y="3" width="8" height="5" rx="1" /><rect x="13" y="10" width="8" height="11" rx="1" /><rect x="3" y="13" width="8" height="8" rx="1" />',
        'Student' => '<path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />',
        'User' => '<path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 8v6m3-3h-6" />',
        'Department' => '<path d="M3 21h18M5 21V7l8-4v18m6 0V11l-6-4" /><path d="M9 9v.01M9 12v.01M9 15v.01M9 18v.01" />',
        'Control' => '<path d="M4 21v-7m0-4V3m8 18v-9m0-4V3m8 18v-5m0-4V3M1 14h6m2-6h6m2 8h6" />',
        'Activity Log' => '<path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5m4-1v5l3 2" />',
        'Archive' => '<path d="M3 4h18v4H3zM5 8v12h14V8m-9 4h4" />',
        'Enrollment' => '<path d="M8 4h-3a2 2 0 0 0-2 2v14h18V6a2 2 0 0 0-2-2h-3" /><rect x="8" y="2" width="8" height="4" rx="1" /><path d="m9 14 2 2 4-4" />',
        'Course' => '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />',
        'Subject' => '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" /><path d="M8 7h8m-8 4h8" />',
        'Request' => '<path d="M4 4h16v16H4zM8 8h8m-8 4h8m-8 4h4" />',
        'Course Shifts' => '<path d="M7 7h14l-4-4m4 4-4 4M17 17H3l4 4m-4-4 4-4" />',
        'Section' => '<path d="M12 3 3 8l9 5 9-5-9-5Z" /><path d="m3 12 9 5 9-5m-18 4 9 5 9-5" />',
        'Grades' => '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" /><path d="m9 10 2 2 4-4" />',
        'Grade' => '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" /><path d="m9 10 2 2 4-4" />',
        'Points' => '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" />',
        'Profile' => '<circle cx="12" cy="8" r="5" /><path d="M20 21a8 8 0 0 0-16 0" />',
        'Classes' => '<path d="M2 7h20v13H2zM2 7l10-5 10 5M12 12v8m-5-8v8m10-8v8" />',
        'Work' => '<path d="M9 5V3h6v2m-13 4h20v12H2z" /><path d="M2 13h20m-12-4v2h4V9" />',
        'Market' => '<path d="M3 3h2l2.4 12.4A2 2 0 0 0 9.4 17h8.8a2 2 0 0 0 2-1.6L22 8H6" /><circle cx="10" cy="21" r="1" /><circle cx="18" cy="21" r="1" />',
        'Chat' => '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z" />',
        'Teacher List' => '<path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M17 11h5m-2.5-2.5v5" />',
        'Report' => '<path d="M3 3v18h18" /><path d="M7 14v3m5-7v7m5-11v11" />',
        'Reports' => '<path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-5 5" />',
        'Property' => '<path d="M3 7h18v14H3zM5 7l2-4h10l2 4M8 11h8m-8 4h8" />',
    ];

    $portalGroupsForRole = match (true) {
        $role === 'admin' => ['Admin'],
        $role === 'registrar' => ['Registrar'],
        $user?->position === 'head_department' => ['Teacher', 'Department Chair'],
        in_array($role, ['faculty', 'teacher', 'head_teacher', 'dean'], true)
            || in_array($user?->position, ['teacher', 'head_teacher', 'dean'], true) => ['Teacher'],
        $role === 'property_custodian' || $user?->position === 'property_custodian' => ['Staff'],
        default => [],
    };

    $visibleGroups = collect($navGroups)
        ->when($portalGroupsForRole !== [], fn ($groups) => $groups->only($portalGroupsForRole))
        ->map(fn ($items) => collect($items)->filter(fn ($item) => in_array($role, $item['roles'], true) || in_array($user?->position, $item['roles'], true))->values())
        ->filter(fn ($items) => $items->isNotEmpty());
@endphp

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>{{ $title ?? 'SchoolBuds Portal' }}</title>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body class="portal-shell min-h-screen bg-portal-page text-portal-text antialiased lg:h-screen lg:overflow-hidden">
    <div id="portal-loading-bar" class="portal-loading-bar pointer-events-none fixed left-0 top-0 z-50 h-1 w-0 bg-portal-accent opacity-0 transition-all duration-300"></div>
    <div class="portal-frame-wrap min-h-screen p-4 lg:h-screen lg:min-h-0 lg:py-5">
        <div class="portal-frame min-h-[calc(100vh-2rem)] overflow-hidden rounded-[22px] border border-portal-border bg-portal-shell backdrop-blur lg:grid lg:h-[calc(100vh-2.5rem)] lg:min-h-0 lg:grid-cols-[330px_1fr]">
            <aside class="hidden border-r border-portal-border bg-portal-sidebar lg:flex lg:h-full lg:min-h-0 lg:flex-col">
            <div class="px-5 pb-5 pt-8">
                <div class="-ml-3 flex w-fit max-w-full items-center gap-3">
                    <img src="{{ asset('images/schoolbuds-logo.png') }}" alt="SchoolBuds logo" class="portal-sidebar-logo h-16 w-16 shrink-0 object-contain">
                    <div class="min-w-0">
                        <p class="text-sm font-black leading-tight text-portal-text">St. Cecelia's College - Cebu, Inc.</p>
                        <p class="mt-1 text-xs font-bold leading-tight text-portal-sidebar-text">SchoolBuds Portal</p>
                    </div>
                </div>
            </div>

            <nav id="portal-sidebar-nav" class="portal-sidebar-scroll min-h-0 flex-1 space-y-6 overflow-y-auto px-3 pb-6">
                @foreach($visibleGroups as $group => $items)
                    <div>
                        <p @class([
                            'px-3 text-[10px] font-black uppercase tracking-[0.18em] text-portal-sidebar-heading',
                            'pointer-events-none sticky top-0 z-10 bg-portal-sidebar py-2' => $group === 'Registrar',
                        ])>{{ $group }}</p>
                        <div class="mt-2 space-y-1.5">
                            @foreach($items as $item)
                                @php($active = request()->is($item['match']))
                                <a href="{{ route($item['route']) }}"
                                    class="portal-nav-link group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold {{ $active ? 'is-active bg-portal-accent-soft text-portal-accent shadow-sm ring-1 ring-portal-accent-border' : 'text-portal-sidebar-text hover:bg-portal-hover hover:text-portal-accent' }}">
                                    <span class="portal-nav-icon flex h-7 w-7 items-center justify-center rounded-lg {{ $active ? 'bg-portal-accent text-white shadow-sm' : 'bg-portal-sidebar-icon text-portal-sidebar-icon-text group-hover:bg-portal-accent-soft group-hover:text-portal-accent' }}">
                                        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
                                            {!! $navIcons[$item['label']] ?? '<circle cx="12" cy="12" r="8" />' !!}
                                        </svg>
                                    </span>
                                    <span class="min-w-0 flex-1 truncate">{{ $item['label'] }}</span>
                                </a>
                            @endforeach
                        </div>
                    </div>
                @endforeach
            </nav>

            <div class="mt-auto border-t border-portal-border px-4 py-4">
                <form method="POST" action="{{ route('logout') }}">
                    @csrf
                    <button type="submit" class="portal-sidebar-logout flex w-full items-center justify-center gap-2 rounded-lg border border-portal-border bg-portal-card px-3 py-2.5 text-sm font-bold text-portal-sidebar-text transition hover:bg-portal-hover hover:text-portal-accent" aria-label="Logout">
                        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M10 17l5-5-5-5m5 5H3m9-9h6a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-6" />
                        </svg>
                        <span>Logout</span>
                    </button>
                </form>
            </div>

            </aside>

        <div class="portal-content-panel min-w-0 bg-portal-content">
            <header class="sticky top-0 z-20 border-b border-portal-border bg-portal-header backdrop-blur lg:flex-none">
                <div class="flex items-center justify-between gap-4 px-3 py-3 sm:px-4 lg:px-5">
                    <div class="min-w-0">
                        <p class="text-sm font-black text-slate-950 lg:hidden">SchoolBuds</p>
                        <p class="hidden text-[10px] font-black uppercase tracking-[0.18em] text-portal-accent lg:block">Workspace</p>
                        <p class="truncate text-sm font-bold text-slate-700">{{ $title ?? 'Dashboard' }}</p>
                    </div>

                    <div class="flex items-center gap-3">
                        <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-portal-accent-soft text-portal-accent" aria-hidden="true">
                            @if($user?->profile_photo_url)
                                <img src="{{ $user->profile_photo_url }}" alt="" class="h-full w-full rounded-full object-cover">
                            @else
                                <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                                    <circle cx="12" cy="8" r="3.5" />
                                    <path stroke-linecap="round" d="M5.5 20a6.5 6.5 0 0 1 13 0" />
                                </svg>
                            @endif
                        </span>
                        <div class="hidden text-right sm:block">
                            <p class="text-sm font-bold text-slate-900">{{ $user?->name }}</p>
                            <p class="text-xs text-slate-500">{{ ucfirst((string) $role) }}</p>
                        </div>
                        <form method="POST" action="{{ route('logout') }}" class="lg:hidden">
                            @csrf
                            <button type="submit" class="portal-button-secondary rounded-xl px-3 py-2 text-sm">
                                Logout
                            </button>
                        </form>
                    </div>
                </div>

                <nav class="flex gap-2 overflow-x-auto border-t border-portal-border px-4 py-2 sm:px-6 lg:hidden">
                    @foreach($visibleGroups as $items)
                        @foreach($items as $item)
                            @php($active = request()->is($item['match']))
                            <a href="{{ route($item['route']) }}"
                                class="whitespace-nowrap rounded-xl px-3 py-2 text-xs font-bold transition {{ $active ? 'bg-portal-accent text-white' : 'bg-portal-card text-portal-text-soft shadow-sm' }}">
                                {{ $item['label'] }}
                            </a>
                        @endforeach
                    @endforeach
                </nav>
            </header>

            <main class="portal-content-scroll w-full px-3 py-6 sm:px-4 lg:px-5 lg:py-8">
                @if(session('status'))
                    <div class="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{{ session('status') }}</div>
                @endif

                @if($errors->any())
                    <div data-portal-validation-summary class="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                        {{ $errors->first() }}
                    </div>
                @endif

                @yield('content')
            </main>
            </div>
        </div>
    </div>
    <script type="application/json" id="portal-validation-state">@json(['messages' => $errors->messages(), 'form_key' => old('_portal_form_key')])</script>
    @stack('scripts')
</body>
</html>
