@extends('layouts.portal', ['title' => 'Attendance'])

@section('content')
<nav aria-label="Breadcrumb" class="mb-4 text-sm">
    <ol class="flex flex-wrap items-center gap-2">
        <li><a href="{{ route('teacher.dashboard') }}" class="font-bold text-rose-700 hover:underline">Teacher Dashboard</a></li>
        <li aria-hidden="true" class="text-slate-400">/</li>
        <li>
            <a
                href="{{ route('teacher.classes', $isPastView ? ['view' => 'past'] : ['view' => 'current']) }}"
                class="font-bold text-rose-700 hover:underline"
            >{{ $isPastView ? 'Past Classes' : 'Classes' }}</a>
        </li>
        <li aria-hidden="true" class="text-slate-400">/</li>
        <li aria-current="page" class="font-semibold text-slate-600">{{ $isPastView ? 'Past Attendance' : 'Attendance' }} · {{ $class->subject }}</li>
    </ol>
</nav>

<div class="mb-6">
    <h1 class="text-2xl font-black text-slate-900">{{ $isPastView ? 'Past Attendance' : 'Mark Attendance' }}</h1>
    <p class="mt-1 text-sm text-slate-500">{{ $class->subject }} · Grade {{ $class->grade_level }} - {{ $class->section }}</p>
</div>

@if($isPastView)
    <form method="GET" action="{{ route('teacher.attendance', $class) }}" class="portal-card mb-4 flex flex-wrap items-end gap-3 p-5">
        <input type="hidden" name="view" value="past">
        <label for="attendance-date" class="text-sm font-bold text-slate-700">Attendance date</label>
        <select id="attendance-date" name="date" class="portal-field min-w-48" @disabled($attendanceDates->isEmpty())>
            @forelse($attendanceDates as $attendanceDate)
                <option value="{{ $attendanceDate }}" @selected($attendanceDate === $date)>{{ \Illuminate\Support\Carbon::parse($attendanceDate)->format('F j, Y') }}</option>
            @empty
                <option value="">No past attendance records</option>
            @endforelse
        </select>
        <button type="submit" class="portal-button-secondary" @disabled($attendanceDates->isEmpty())>View attendance</button>
    </form>

    @if(!$date)
        <section class="portal-card p-8 text-center text-sm font-semibold text-slate-500">
            No past attendance records are available for this class.
        </section>
    @else
        <section class="portal-card overflow-hidden">
            <div class="border-b border-slate-100 px-5 py-3 text-sm font-bold text-slate-600">
                Attendance for {{ \Illuminate\Support\Carbon::parse($date)->format('F j, Y') }} · {{ $students->count() }} students
            </div>
            <div class="divide-y divide-slate-100">
                @forelse($students as $student)
                    @php($att = $existing[$student->id] ?? null)
                    <div class="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                        <div>
                            <p class="font-bold text-slate-800">{{ $student->first_name }} {{ $student->last_name }}</p>
                            <p class="text-xs text-slate-500">{{ $student->student_id }}</p>
                        </div>
                        <span @class([
                            'rounded-full px-3 py-1 text-xs font-black uppercase',
                            'bg-green-100 text-green-800' => $att?->status === 'present',
                            'bg-yellow-100 text-yellow-800' => $att?->status === 'late',
                            'bg-portal-accent-soft text-portal-accent' => $att?->status === 'excused',
                            'bg-red-100 text-red-800' => $att?->status === 'absent',
                            'bg-slate-100 text-slate-600' => !$att,
                        ])>{{ $att?->status ?? 'Not recorded' }}</span>
                    </div>
                @empty
                    <p class="p-8 text-center text-sm text-slate-500">No students are currently assigned to this class.</p>
                @endforelse
            </div>
        </section>
    @endif
@else
<form method="POST" action="{{ route('teacher.attendance.store', $class) }}">
    @csrf
    <section class="portal-card mb-4 p-5">
        <div class="flex flex-col gap-3 md:flex-row md:items-center">
            <label class="text-sm font-bold text-slate-700">
                Date
                <input type="date" name="date" value="{{ $today }}" class="portal-field ml-0 mt-2 md:ml-3 md:mt-0">
            </label>
            <div class="flex flex-wrap gap-2 md:ml-auto">
                <button type="button" onclick="markAll('present')" class="portal-button-secondary">All present</button>
                <button type="button" onclick="markAll('absent')" class="portal-button-secondary">All absent</button>
            </div>
        </div>
    </section>

    <section class="portal-card overflow-hidden">
        <table class="w-full text-sm">
            <thead class="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                    <th class="px-5 py-3 text-left">Student</th>
                    <th class="px-5 py-3 text-center">Present</th>
                    <th class="px-5 py-3 text-center">Late</th>
                    <th class="px-5 py-3 text-center">Excused</th>
                    <th class="px-5 py-3 text-center">Absent</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
                @foreach($students as $student)
                    @php($att = $existing[$student->id] ?? null)
                    <tr id="row-{{ $student->id }}">
                        <td class="px-5 py-3">
                            <div class="flex flex-wrap items-center gap-2">
                                <p class="font-bold text-slate-800">{{ $student->first_name }} {{ $student->last_name }}</p>
                                @if($student->is_irregular)
                                    <span class="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase text-amber-800">Irregular</span>
                                @endif
                            </div>
                            <p class="text-xs text-slate-500">{{ $student->student_id }}</p>
                        </td>
                        @foreach(['present','late','excused','absent'] as $status)
                            <td class="px-5 py-3 text-center">
                                <input type="radio" name="attendance[{{ $student->id }}][status]" value="{{ $status }}" @checked(($att?->status ?? 'present') === $status) onchange="highlightRow({{ $student->id }}, '{{ $status }}')" class="h-4 w-4 accent-violet-600">
                            </td>
                        @endforeach
                    </tr>
                @endforeach
            </tbody>
        </table>
        <div class="flex items-center justify-between border-t border-violet-100 px-5 py-4">
            <p class="text-sm font-semibold text-slate-500">{{ $students->count() }} students</p>
            <button type="submit" class="portal-button-primary">Save attendance</button>
        </div>
    </section>
</form>
@endif

@unless($isPastView)
<script>
function markAll(status) {
    document.querySelectorAll(`input[type=radio][value=${status}]`).forEach((radio) => {
        radio.checked = true;
        const sid = radio.name.match(/\d+/)[0];
        highlightRow(sid, status);
    });
}

function highlightRow(studentId, status) {
    const row = document.getElementById('row-' + studentId);
    row.classList.remove('bg-green-50', 'bg-red-50', 'bg-yellow-50', 'bg-portal-accent-soft');
    if (status === 'present') row.classList.add('bg-green-50');
    else if (status === 'absent') row.classList.add('bg-red-50');
    else if (status === 'late') row.classList.add('bg-yellow-50');
    else if (status === 'excused') row.classList.add('bg-portal-accent-soft');
}

document.querySelectorAll('input[type=radio]:checked').forEach((radio) => {
    const sid = radio.name.match(/\d+/)[0];
    highlightRow(sid, radio.value);
});
</script>
@endunless
@endsection
