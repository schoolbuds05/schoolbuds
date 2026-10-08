@extends('layouts.portal', ['title' => $student->first_name . ' ' . $student->last_name])

@section('content')
<nav aria-label="Breadcrumb" class="mb-4 text-sm">
    <ol class="flex flex-wrap items-center gap-2">
        <li><a href="{{ route(($routePrefix ?? 'admin') . '.students.index') }}" class="font-bold text-portal-accent hover:underline">Students</a></li>
        <li aria-hidden="true" class="text-slate-400">/</li>
        <li aria-current="page" class="font-semibold text-slate-600">{{ $student->first_name }} {{ $student->last_name }}</li>
    </ol>
</nav>

<section class="mt-4 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
    <div class="flex flex-col md:flex-row md:items-center gap-5 justify-between">
        <div>
            <h1 class="text-2xl font-black text-slate-900">{{ $student->first_name }} {{ $student->last_name }}</h1>
            <p class="text-sm text-slate-500 mt-1">{{ $student->student_id }} · {{ $student->email }}</p>
            <p class="text-sm text-slate-500">{{ $student->grade_level }} · {{ $student->section ?: 'TBA' }} · {{ $student->school_year }}</p>
        </div>
        <div class="grid grid-cols-2 gap-3 min-w-72">
            <div class="rounded-lg bg-emerald-50 p-4">
                <p class="text-xs font-bold text-emerald-700 uppercase">Attendance</p>
                <p class="text-2xl font-black text-emerald-800">{{ $attendancePct }}%</p>
            </div>
            <div class="rounded-lg bg-portal-accent-soft p-4">
                <p class="text-xs font-bold text-portal-accent uppercase">Status</p>
                <p class="text-lg font-black text-portal-accent">{{ ucfirst($student->status) }}</p>
            </div>
            <a href="#parent-account" class="portal-button-primary col-span-2">
                {{ $student->parent ? 'Change parent link' : 'Link parent' }}
            </a>
        </div>
    </div>
</section>

<section class="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    <div class="mb-4 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
            <h2 class="font-black text-slate-800">Student Information</h2>
            <p class="mt-1 text-sm text-slate-500">Full profile, family background, and academic placement.</p>
        </div>
        <span class="w-fit rounded-full px-3 py-1 text-xs font-black {{ $student->status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600' }}">{{ ucfirst($student->status) }}</span>
    </div>

    <div class="mb-5 grid grid-cols-1 gap-3 text-sm md:grid-cols-4">
        <div class="rounded-lg bg-slate-50 p-3">
            <p class="text-xs font-black uppercase text-slate-400">Student ID</p>
            <p class="mt-1 font-bold text-slate-800">{{ $student->student_id }}</p>
        </div>
        <div class="rounded-lg bg-slate-50 p-3">
            <p class="text-xs font-black uppercase text-slate-400">Contact</p>
            <p class="mt-1 font-bold text-slate-800">{{ $student->phone ?: 'Not set' }}</p>
        </div>
        <div class="rounded-lg bg-slate-50 p-3">
            <p class="text-xs font-black uppercase text-slate-400">Birthdate</p>
            <p class="mt-1 font-bold text-slate-800">{{ $student->birthdate ?: 'Not set' }}</p>
        </div>
        <div class="rounded-lg bg-slate-50 p-3">
            <p class="text-xs font-black uppercase text-slate-400">Gender</p>
            <p class="mt-1 font-bold text-slate-800">{{ ucfirst($student->gender) }}</p>
        </div>
        <div class="rounded-lg bg-slate-50 p-3 md:col-span-2">
            <p class="text-xs font-black uppercase text-slate-400">Mother</p>
            <p class="mt-1 font-bold text-slate-800">{{ $student->mother_name ?: 'Not set' }}</p>
            <p class="text-xs text-slate-500">{{ $student->mother_occupation ?: 'Occupation not set' }}</p>
        </div>
        <div class="rounded-lg bg-slate-50 p-3 md:col-span-2">
            <p class="text-xs font-black uppercase text-slate-400">Father</p>
            <p class="mt-1 font-bold text-slate-800">{{ $student->father_name ?: 'Not set' }}</p>
            <p class="text-xs text-slate-500">{{ $student->father_occupation ?: 'Occupation not set' }}</p>
        </div>
        <div class="rounded-lg bg-slate-50 p-3 md:col-span-2">
            <p class="text-xs font-black uppercase text-slate-400">Previous school</p>
            <p class="mt-1 font-bold text-slate-800">{{ $student->prev_school ?: 'Not set' }}</p>
            <p class="text-xs text-slate-500">{{ $student->prev_school_address ?: 'Address not set' }}</p>
        </div>
        <div class="rounded-lg bg-slate-50 p-3">
            <p class="text-xs font-black uppercase text-slate-400">Student type</p>
            <p class="mt-1 font-bold text-slate-800">{{ $student->student_type ? str_replace('_', ' ', ucfirst($student->student_type)) : 'Not set' }}</p>
        </div>
        <div class="rounded-lg bg-slate-50 p-3">
            <p class="text-xs font-black uppercase text-slate-400">Academic status</p>
            <p class="mt-1 font-bold text-slate-800">{{ $student->academic_status ?: 'Not set' }}</p>
        </div>
        <div class="rounded-lg bg-slate-50 p-3 md:col-span-4">
            <p class="text-xs font-black uppercase text-slate-400">Address</p>
            <p class="mt-1 font-bold text-slate-800">{{ $student->address ?: 'Not set' }}</p>
        </div>
    </div>

    <details class="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <summary class="cursor-pointer text-sm font-black text-slate-800">Edit full student information</summary>
        <form method="POST" action="{{ route(($routePrefix ?? 'admin') . '.students.update', $student) }}" class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4 md:items-end">
            @csrf
            @method('PUT')

            <label class="text-xs font-bold uppercase text-slate-500">
                Student ID
                <input name="student_id" value="{{ old('student_id', $student->student_id) }}" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
            </label>
            <label class="text-xs font-bold uppercase text-slate-500">
                First name
                <input name="first_name" value="{{ old('first_name', $student->first_name) }}" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
            </label>
            <label class="text-xs font-bold uppercase text-slate-500">
                Last name
                <input name="last_name" value="{{ old('last_name', $student->last_name) }}" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
            </label>
            <label class="text-xs font-bold uppercase text-slate-500">
                Email
                <input name="email" value="{{ old('email', $student->email) }}" type="email" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
            </label>

            <label class="text-xs font-bold uppercase text-slate-500">
                Phone
                <input name="phone" value="{{ old('phone', $student->phone) }}" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
            </label>
            <label class="text-xs font-bold uppercase text-slate-500">
                Birthdate
                <input name="birthdate" value="{{ old('birthdate', $student->birthdate) }}" type="date" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
            </label>
            <label class="text-xs font-bold uppercase text-slate-500">
                Gender
                <select name="gender" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                    <option value="male" @selected(old('gender', $student->gender) === 'male')>Male</option>
                    <option value="female" @selected(old('gender', $student->gender) === 'female')>Female</option>
                </select>
            </label>
            <label class="text-xs font-bold uppercase text-slate-500">
                Status
                <select name="status" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                    <option value="active" @selected(old('status', $student->status) === 'active')>Active</option>
                    <option value="inactive" @selected(old('status', $student->status) === 'inactive')>Inactive</option>
                    <option value="graduated" @selected(old('status', $student->status) === 'graduated')>Graduated</option>
                </select>
            </label>

            <label class="text-xs font-bold uppercase text-slate-500 md:col-span-4">
                Address
                <input name="address" value="{{ old('address', $student->address) }}" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
            </label>

            <label class="text-xs font-bold uppercase text-slate-500">
                Mother name
                <input name="mother_name" value="{{ old('mother_name', $student->mother_name) }}" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
            </label>
            <label class="text-xs font-bold uppercase text-slate-500">
                Mother occupation
                <input name="mother_occupation" value="{{ old('mother_occupation', $student->mother_occupation) }}" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
            </label>
            <label class="text-xs font-bold uppercase text-slate-500">
                Father name
                <input name="father_name" value="{{ old('father_name', $student->father_name) }}" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
            </label>
            <label class="text-xs font-bold uppercase text-slate-500">
                Father occupation
                <input name="father_occupation" value="{{ old('father_occupation', $student->father_occupation) }}" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
            </label>

            <label class="text-xs font-bold uppercase text-slate-500">
                Grade / year level
                <input name="grade_level" value="{{ old('grade_level', $student->grade_level) }}" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
            </label>
            <label class="text-xs font-bold uppercase text-slate-500">
                Section
                <input name="section" value="{{ old('section', $student->section) }}" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
            </label>
            <label class="text-xs font-bold uppercase text-slate-500">
                School year
                <input name="school_year" value="{{ old('school_year', $student->school_year) }}" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
            </label>
            <label class="text-xs font-bold uppercase text-slate-500">
                Academic status
                <select name="academic_status" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                    <option value="">Not set</option>
                    <option value="Regular" @selected(old('academic_status', $student->academic_status) === 'Regular')>Regular</option>
                    <option value="Irregular" @selected(old('academic_status', $student->academic_status) === 'Irregular')>Irregular</option>
                </select>
            </label>

            <label class="text-xs font-bold uppercase text-slate-500">
                Student type
                <select name="student_type" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                    <option value="">Not set</option>
                    <option value="new_student" @selected(old('student_type', $student->student_type) === 'new_student')>New student</option>
                    <option value="old_student" @selected(old('student_type', $student->student_type) === 'old_student')>Old student</option>
                    <option value="transferee" @selected(old('student_type', $student->student_type) === 'transferee')>Transferee</option>
                            <option value="shiftee" @selected(old('student_type', $student->student_type) === 'shiftee')>Shiftee</option>
                    <option value="returnee" @selected(old('student_type', $student->student_type) === 'returnee')>Returnee</option>
                </select>
            </label>
            <label class="text-xs font-bold uppercase text-slate-500">
                Previous school
                <input name="prev_school" value="{{ old('prev_school', $student->prev_school) }}" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
            </label>
            <label class="text-xs font-bold uppercase text-slate-500 md:col-span-2">
                Previous school address
                <input name="prev_school_address" value="{{ old('prev_school_address', $student->prev_school_address) }}" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
            </label>

            <button class="rounded-lg bg-portal-accent px-4 py-2 text-sm font-bold text-white hover:bg-portal-accent-hover md:col-start-4">Save student info</button>
        </form>
    </details>
</section>

<section id="parent-account" class="mt-6 scroll-mt-24 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
    <div class="mb-4">
        <h2 class="font-black text-slate-800">Parent Account</h2>
        <p class="mt-1 text-sm text-slate-500">Link this student to an existing parent account by email.</p>
    </div>

    @if($student->parent)
        <div class="mb-4 rounded-lg bg-violet-50 px-4 py-3 text-sm text-violet-800">
            Current parent: <span class="font-bold">{{ $student->parent->name }}</span> · {{ $student->parent->email }}
        </div>
    @endif

    <form method="POST" action="{{ route(($routePrefix ?? 'admin') . '.students.parent.update', $student) }}" class="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
        @csrf
        @method('PUT')
        <label class="text-xs font-bold uppercase text-slate-500">
            Parent email
            <input name="parent_email" value="{{ old('parent_email', $student->parent?->email) }}" type="email" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900" placeholder="parent@example.com">
        </label>
        <div class="flex items-end gap-2">
            <button class="portal-button-primary">Link parent</button>
            @if($student->parent)
                <button name="parent_email" value="" class="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600" formnovalidate>Unlink</button>
            @endif
        </div>
    </form>
</section>

<section class="mt-6 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
    <details class="group">
        <summary class="mb-4 flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
            <h2 class="font-black text-slate-800">Subjects</h2>
            <span class="flex items-center gap-2">
                <span class="text-xs font-black uppercase text-slate-400">{{ count($subjects) }} enrolled</span>
                <svg class="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
            </span>
        </summary>

        <div class="divide-y divide-slate-100">
            @forelse($subjects as $subject)
                @php
                    $subjectGrades = $gradeRecords->filter(function ($grade) use ($subject) {
                        $schoolClass = $grade->schoolClass;

                        return $schoolClass
                            && strcasecmp(trim((string) $schoolClass->subject), trim((string) $subject['name'])) === 0
                            && (($subject['source'] ?? '') !== 'section'
                                || strcasecmp(trim((string) $schoolClass->section), trim((string) $subject['section_name'])) === 0)
                            && (empty($subject['school_year']) || (string) $grade->school_year === (string) $subject['school_year']);
                    })->keyBy(fn ($grade) => (string) $grade->quarter);
                    $finalScore = $subjectGrades->get('4')?->score;
                    $isPassingFinal = $finalScore !== null && (($subject['program_type'] ?? null) === 'college'
                        ? (float) $finalScore <= 3
                        : (float) $finalScore >= 75);
                    $isFailingFinal = $finalScore !== null && (($subject['program_type'] ?? null) === 'college'
                        ? (float) $finalScore > 3
                        : (float) $finalScore < 75);
                    $subjectStatus = $subject['status'] === 'dropped'
                        ? 'Dropped'
                        : ($isFailingFinal
                            ? 'Failed'
                            : ($subject['status'] === 'completed' ? 'Completed' : ($isPassingFinal ? 'Passed' : 'Enrolled')));
                    $statusClass = match (strtolower($subjectStatus)) {
                        'completed' => 'bg-emerald-100 text-emerald-700',
                        'passed' => 'bg-emerald-100 text-emerald-700',
                        'failed' => 'bg-red-100 text-red-700',
                        'dropped' => 'bg-red-100 text-red-700',
                        default => 'bg-portal-accent-soft text-portal-accent',
                    };
                    $gradePeriods = ($subject['program_type'] ?? null) === 'college'
                        ? ['1' => 'Prelim', '2' => 'Midterm', '3' => 'Prefinal', '4' => 'Final']
                        : ['1' => 'Quarter 1', '2' => 'Quarter 2', '3' => 'Quarter 3', '4' => 'Quarter 4'];
                @endphp
                <details class="group/subject">
                    <summary class="flex cursor-pointer list-none items-center justify-between gap-3 py-3 [&::-webkit-details-marker]:hidden">
                        <div class="min-w-0">
                            <p class="font-bold text-slate-900">
                                {{ $subject['code'] }}{{ $subject['code'] ? ' · ' : '' }}{{ $subject['name'] }}
                            </p>
                            <p class="mt-1 text-xs text-slate-500">
                                {{ $subject['section_name'] }}
                                @if($subject['teacher'])
                                    · {{ $subject['teacher'] }}
                                @endif
                                @if($subject['schedule'])
                                    · {{ $subject['schedule'] }}
                                @endif
                            </p>
                            @if($subject['status'] === 'dropped' && $subject['drop_reason'])
                                <p class="mt-1 text-xs font-semibold text-red-600">Dropped: {{ $subject['drop_reason'] }}</p>
                            @endif
                        </div>
                        <div class="flex shrink-0 items-center gap-2">
                            <span class="rounded-full px-3 py-1 text-xs font-black {{ $statusClass }}">{{ $subjectStatus }}</span>
                            <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">{{ $subject['units'] }}u</span>
                            <svg class="h-4 w-4 text-slate-400 transition-transform group-open/subject:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                        </div>
                    </summary>

                    <div class="grid grid-cols-2 gap-2 pb-3 sm:grid-cols-4">
                        @foreach($gradePeriods as $quarter => $periodLabel)
                            @php($grade = $subjectGrades->get($quarter))
                            <div class="rounded-lg bg-slate-50 px-3 py-2">
                                <p class="text-[10px] font-black uppercase tracking-wide text-slate-400">{{ $periodLabel }}</p>
                                <p class="mt-1 text-sm font-black text-slate-800">{{ $grade?->score ?? '—' }}</p>
                            </div>
                        @endforeach
                    </div>
                </details>
            @empty
                <p class="text-sm text-slate-500">No subjects found for this student.</p>
            @endforelse
        </div>
    </details>
</section>

<details class="group mt-6 rounded-xl border border-slate-200 bg-white shadow-sm">
    <summary class="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-5 [&::-webkit-details-marker]:hidden">
        <div>
            <h2 class="font-black text-slate-800">Points Record</h2>
            <p class="mt-1 text-sm text-slate-500">Earned and redeemed student points.</p>
        </div>
        <div class="flex items-center gap-3">
            <div class="rounded-lg bg-emerald-50 px-4 py-2 text-right">
                <p class="text-xs font-bold uppercase text-emerald-700">Current balance</p>
                <p class="text-xl font-black text-emerald-800">{{ $pointSummary['points'] }} pts</p>
            </div>
            <svg class="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
        </div>
    </summary>

    <div class="divide-y divide-slate-100 border-t border-slate-100 px-5">
        @forelse($pointRecords as $pointRecord)
            <div class="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div class="min-w-0">
                    <p class="font-bold text-slate-800">{{ $pointRecord->title }}</p>
                    <p class="mt-1 text-xs text-slate-500">
                        {{ str_replace('_', ' ', ucfirst($pointRecord->source)) }}
                        @if($pointRecord->school_year)
                            · {{ $pointRecord->school_year }}
                        @endif
                        @if($pointRecord->semester)
                            · {{ ucfirst($pointRecord->semester) }} semester
                        @endif
                        · {{ $pointRecord->created_at->format('M d, Y') }}
                        · {{ $pointRecord->awardedBy?->name ?: 'System' }}
                    </p>
                    @if($pointRecord->description)
                        <p class="mt-1 text-sm text-slate-600">{{ $pointRecord->description }}</p>
                    @endif
                </div>
                <p class="shrink-0 text-lg font-black {{ $pointRecord->points < 0 ? 'text-red-600' : 'text-emerald-700' }}">{{ $pointRecord->points > 0 ? '+' : '' }}{{ $pointRecord->points }} pts</p>
            </div>
        @empty
            <p class="py-4 text-sm text-slate-500">No point records for this student.</p>
        @endforelse
    </div>
</details>

<div class="mt-6">
    <section class="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div class="mb-4 flex items-center justify-between gap-3">
            <h2 class="font-black text-slate-800">Fees</h2>
            <p class="text-xs font-black uppercase text-slate-400">Post tuition</p>
        </div>
        <div class="divide-y divide-slate-100">
            @forelse($fees as $fee)
                @php($remaining = max(0, (float) $fee->amount - (float) $fee->paid_amount))
                <div class="py-3">
                    <div class="flex items-center justify-between gap-3">
                        <div class="min-w-0">
                            <p class="font-semibold text-slate-800">{{ $fee->type }}</p>
                            <p class="text-xs text-slate-500">
                                Due {{ $fee->due_date }} · {{ ucfirst($fee->status) }} · Paid PHP {{ number_format((float) $fee->paid_amount, 2) }}
                            </p>
                        </div>
                        <p class="font-black text-slate-900">PHP {{ number_format($remaining, 2) }}</p>
                    </div>
                    @if($fee->status !== 'paid')
                        <form method="POST" action="{{ route(($routePrefix ?? 'admin') . '.students.fees.pay', [$student, $fee]) }}" class="mt-3 grid grid-cols-1 gap-2 rounded-lg bg-slate-50 p-3 md:grid-cols-[1fr_140px_1fr_auto]">
                            @csrf
                            <input name="amount" value="{{ old('amount', number_format($remaining, 2, '.', '')) }}" type="number" min="1" step="0.01" class="rounded-lg border-slate-300 text-sm" placeholder="Amount">
                            <select name="payment_method" class="rounded-lg border-slate-300 text-sm">
                                <option value="cash">Cash</option>
                                <option value="gcash">GCash</option>
                                <option value="qrph">QRPH</option>
                                <option value="bank_transfer">Bank transfer</option>
                            </select>
                            <input name="payment_reference" value="{{ old('payment_reference') }}" class="rounded-lg border-slate-300 text-sm" placeholder="Reference optional">
                            <button class="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white">Confirm</button>
                        </form>
                    @endif
                </div>
            @empty
                <p class="text-sm text-slate-500">No fees recorded.</p>
            @endforelse
        </div>

        <form method="POST" action="{{ route(($routePrefix ?? 'admin') . '.students.fees.store', $student) }}" class="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
            @csrf
            <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label class="text-xs font-bold uppercase text-slate-500">
                    Fee type
                    <input name="type" value="{{ old('type', 'Tuition Fee') }}" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                </label>
                <label class="text-xs font-bold uppercase text-slate-500">
                    Amount
                    <input name="amount" value="{{ old('amount') }}" type="number" min="1" step="0.01" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                </label>
                <label class="text-xs font-bold uppercase text-slate-500">
                    Due date
                    <input name="due_date" value="{{ old('due_date') }}" type="date" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                </label>
                <label class="text-xs font-bold uppercase text-slate-500">
                    School year
                    <input name="school_year" value="{{ old('school_year', $student->school_year) }}" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                </label>
                <label class="text-xs font-bold uppercase text-slate-500">
                    Semester
                    <select name="semester" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                        <option value="">No semester</option>
                        <option value="1st" @selected(old('semester') === '1st')>1st semester</option>
                        <option value="2nd" @selected(old('semester') === '2nd')>2nd semester</option>
                        <option value="summer" @selected(old('semester') === 'summer')>Summer</option>
                    </select>
                </label>
                <label class="text-xs font-bold uppercase text-slate-500">
                    Quarter
                    <select name="quarter" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">
                        <option value="">No quarter</option>
                        <option value="1" @selected(old('quarter') === '1')>Quarter 1</option>
                        <option value="2" @selected(old('quarter') === '2')>Quarter 2</option>
                        <option value="3" @selected(old('quarter') === '3')>Quarter 3</option>
                        <option value="4" @selected(old('quarter') === '4')>Quarter 4</option>
                    </select>
                </label>
            </div>
            <label class="mt-3 block text-xs font-bold uppercase text-slate-500">
                Notes
                <textarea name="notes" rows="2" class="mt-1 w-full rounded-lg border-slate-300 text-sm normal-case text-slate-900">{{ old('notes') }}</textarea>
            </label>
            <button class="mt-3 rounded-lg bg-portal-accent px-4 py-2 text-sm font-bold text-white hover:bg-portal-accent-hover">Post fee</button>
        </form>
    </section>
</div>
@endsection
