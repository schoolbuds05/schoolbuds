@php
    $user = auth()->user();
    $role = $user?->role;

    $navGroups = [
        'Admin' => [
            ['label' => 'Dashboard', 'route' => 'admin.dashboard', 'match' => 'admin/dashboard', 'roles' => ['admin']],
            ['label' => 'Students', 'route' => 'admin.students.index', 'match' => 'admin/students*', 'roles' => ['admin']],
            ['label' => 'Users', 'route' => 'admin.users.index', 'match' => 'admin/users*', 'roles' => ['admin']],
            ['label' => 'Departments', 'route' => 'admin.departments.index', 'match' => 'admin/departments*', 'roles' => ['admin']],
            ['label' => 'Controls', 'route' => 'admin.controls.index', 'match' => 'admin/controls*', 'roles' => ['admin']],
            ['label' => 'Activity Logs', 'route' => 'admin.activity.index', 'match' => 'admin/activity*', 'roles' => ['admin']],
            ['label' => 'Reports', 'route' => 'admin.reports.index', 'match' => 'admin/reports*', 'roles' => ['admin']],
            ['label' => 'Archive', 'route' => 'admin.archive.index', 'match' => 'admin/archive*', 'roles' => ['admin']],
        ],
        'Registrar' => [
            ['label' => 'Dashboard', 'route' => 'registrar.dashboard', 'match' => 'registrar/dashboard', 'roles' => ['admin', 'registrar']],
            ['label' => 'Enrollments', 'route' => 'registrar.enrollments.index', 'match' => 'registrar/enrollments*', 'roles' => ['admin', 'registrar']],
            ['label' => 'Students', 'route' => 'registrar.students.index', 'match' => 'registrar/students*', 'roles' => ['admin', 'registrar']],
            ['label' => 'Courses', 'route' => 'registrar.courses.index', 'match' => 'registrar/courses*', 'roles' => ['admin', 'registrar']],
            ['label' => 'Subjects', 'route' => 'registrar.subjects.index', 'match' => 'registrar/subjects*', 'roles' => ['admin', 'registrar']],
            ['label' => 'Requests', 'route' => 'registrar.subject-requests.index', 'match' => 'registrar/subject-requests*', 'roles' => ['admin', 'registrar']],
            ['label' => 'Course Shifts', 'route' => 'registrar.course-shift-requests.index', 'match' => 'registrar/course-shift-requests*', 'roles' => ['admin', 'registrar']],
            ['label' => 'Sections', 'route' => 'registrar.sections.index', 'match' => 'registrar/sections*', 'roles' => ['admin', 'registrar']],
            ['label' => 'Grades', 'route' => 'registrar.grades.index', 'match' => 'registrar/grades*', 'roles' => ['admin', 'registrar']],
            ['label' => 'Points', 'route' => 'registrar.points.index', 'match' => 'registrar/points*', 'roles' => ['admin', 'registrar']],
            ['label' => 'Reports', 'route' => 'registrar.reports.index', 'match' => 'registrar/reports*', 'roles' => ['admin', 'registrar']],
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
            ['label' => 'Students', 'route' => 'department-chair.students', 'match' => 'department-chair/students', 'roles' => ['head_department']],
            ['label' => 'Report', 'route' => 'department-chair.reports', 'match' => 'department-chair/reports', 'roles' => ['head_department']],
        ],
        'Staff' => [
            ['label' => 'Property', 'route' => 'property-custodian.dashboard', 'match' => 'property-custodian/dashboard', 'roles' => ['admin', 'property_custodian']],
            ['label' => 'Market', 'route' => 'property-custodian.market', 'match' => 'property-custodian/market*', 'roles' => ['admin', 'property_custodian']],
            ['label' => 'Reports', 'route' => 'property-custodian.reports', 'match' => 'property-custodian/reports*', 'roles' => ['admin', 'property_custodian']],
        ],
    ];

    $navIcons = [
        'Dashboard' => 'DB', 'Students' => 'ST', 'Users' => 'US', 'Departments' => 'DP',
        'Controls' => 'CT', 'Activity Logs' => 'AL', 'Reports' => 'RP', 'Archive' => 'AR',
        'Enrollments' => 'EN', 'Courses' => 'CR', 'Subjects' => 'SB', 'Requests' => 'RQ',
        'Course Shifts' => 'CS', 'Sections' => 'SC', 'Grades' => 'GR', 'Points' => 'PT',
        'Profile' => 'PF', 'Classes' => 'CL', 'Work' => 'WK', 'Market' => 'MK', 'Chat' => 'CH',
        'Teacher List' => 'TL', 'Grade' => 'GD', 'Report' => 'RT', 'Property' => 'PR',
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
<body class="portal-shell min-h-screen bg-[#d9b9b8] text-slate-900 antialiased lg:h-screen lg:overflow-hidden">
    <div id="portal-loading-bar" class="pointer-events-none fixed left-0 top-0 z-50 h-1 w-0 bg-rose-600 opacity-0 shadow-lg shadow-rose-600/30 transition-all duration-300"></div>
    <div class="portal-frame-wrap min-h-screen p-4 lg:h-screen lg:min-h-0 lg:py-5">
        <div class="min-h-[calc(100vh-2rem)] overflow-hidden rounded-[22px] border border-[#e8c4c7] bg-[#f6efee]/80 shadow-[0_26px_48px_rgba(121,84,89,0.12)] backdrop-blur lg:grid lg:h-[calc(100vh-2.5rem)] lg:min-h-0 lg:grid-cols-[330px_1fr]">
            <aside class="hidden border-r border-[#9d7478] bg-[#b58a8d] lg:flex lg:h-full lg:min-h-0 lg:flex-col">
            <div class="px-5 pb-5 pt-8">
                <div class="mx-auto flex w-fit max-w-full items-center gap-3">
                    <img src="{{ asset('images/schoolbuds-logo.png') }}" alt="SchoolBuds logo" class="h-16 w-16 shrink-0 object-contain">
                    <div class="min-w-0">
                        <p class="text-sm font-black leading-tight text-[#3f2b2b]">St. Cecilia College</p>
                        <p class="mt-1 text-xs font-bold leading-tight text-[#7a5d5d]">Cebu-Inc Portal</p>
                    </div>
                </div>
            </div>

            <nav id="portal-sidebar-nav" class="portal-sidebar-scroll min-h-0 flex-1 space-y-6 overflow-y-auto px-3 pb-6">
                @foreach($visibleGroups as $group => $items)
                    <div>
                        <p class="px-3 text-[10px] font-black uppercase tracking-[0.18em] text-[#713f43]">{{ $group }}</p>
                        <div class="mt-2 space-y-1.5">
                            @foreach($items as $item)
                                @php($active = request()->is($item['match']))
                                <a href="{{ route($item['route']) }}"
                                    class="portal-nav-link group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold {{ $active ? 'is-active bg-[#f7e4e5] text-[#d6535e] shadow-sm ring-1 ring-[#f0d1d5]' : 'text-[#7a5d5d] hover:bg-[#f5ecec] hover:text-[#b5545b]' }}">
                                    <span class="portal-nav-icon flex h-7 w-7 items-center justify-center rounded-lg text-[10px] font-black {{ $active ? 'bg-[#d95f64] text-white shadow-sm' : 'bg-[#f0e7e7] text-[#8d6d6f] group-hover:bg-[#f1dfe0] group-hover:text-[#a4565d]' }}">{{ $navIcons[$item['label']] ?? strtoupper(substr($item['label'], 0, 2)) }}</span>
                                    <span class="min-w-0 flex-1 truncate">{{ $item['label'] }}</span>
                                </a>
                            @endforeach
                        </div>
                    </div>
                @endforeach
            </nav>

            <div class="mt-auto border-t border-[#f0dfe2] px-4 py-4">
                <form method="POST" action="{{ route('logout') }}">
                    @csrf
                    <button type="submit" class="portal-sidebar-logout flex w-full items-center justify-center gap-2 rounded-lg border border-[#ead6d8] bg-white px-3 py-2.5 text-sm font-bold text-[#7a5d5d] transition hover:bg-[#f9ecec] hover:text-[#c5585e]" aria-label="Logout">
                        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M10 17l5-5-5-5m5 5H3m9-9h6a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-6" />
                        </svg>
                        <span>Logout</span>
                    </button>
                </form>
            </div>

            </aside>

        <div class="portal-content-panel min-w-0 bg-[#f8f3f2]">
            <header class="sticky top-0 z-20 border-b border-[#f3dfe2] bg-white/90 backdrop-blur lg:flex-none">
                <div class="flex items-center justify-between gap-4 px-3 py-3 sm:px-4 lg:px-5">
                    <div class="min-w-0">
                        <p class="text-sm font-black text-slate-950 lg:hidden">SchoolBuds</p>
                        <p class="hidden text-[10px] font-black uppercase tracking-[0.18em] text-[#d8636d] lg:block">Workspace</p>
                        <p class="truncate text-sm font-bold text-slate-700">{{ $title ?? 'Dashboard' }}</p>
                    </div>

                    <div class="flex items-center gap-3">
                        <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f7e3e4] text-[#c95a62]" aria-hidden="true">
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
                            <button type="submit" class="rounded-xl border border-rose-100 bg-white px-3 py-2 text-sm font-bold text-slate-600 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-700">
                                Logout
                            </button>
                        </form>
                    </div>
                </div>

                <nav class="flex gap-2 overflow-x-auto border-t border-[#f2dfe1] px-4 py-2 sm:px-6 lg:hidden">
                    @foreach($visibleGroups as $items)
                        @foreach($items as $item)
                            @php($active = request()->is($item['match']))
                            <a href="{{ route($item['route']) }}"
                                class="whitespace-nowrap rounded-xl px-3 py-2 text-xs font-bold transition {{ $active ? 'bg-[#d95f64] text-white' : 'bg-white text-slate-600 shadow-sm' }}">
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
