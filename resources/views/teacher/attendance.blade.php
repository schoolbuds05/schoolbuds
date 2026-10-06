@extends('layouts.portal', ['title' => 'Attendance'])

@section('content')
<a href="{{ route('teacher.classes') }}" class="text-sm font-bold text-violet-700 hover:underline">Back to classes</a>

<div class="mt-4 mb-6">
    <h1 class="text-2xl font-black text-slate-900">Mark Attendance</h1>
    <p class="mt-1 text-sm text-slate-500">{{ $class->subject }} · Grade {{ $class->grade_level }} - {{ $class->section }}</p>
</div>

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
                            <p class="font-bold text-slate-800">{{ $student->first_name }} {{ $student->last_name }}</p>
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
            <button class="portal-button-primary">Save attendance</button>
        </div>
    </section>
</form>

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
    row.classList.remove('bg-green-50', 'bg-red-50', 'bg-yellow-50', 'bg-blue-50');
    if (status === 'present') row.classList.add('bg-green-50');
    else if (status === 'absent') row.classList.add('bg-red-50');
    else if (status === 'late') row.classList.add('bg-yellow-50');
    else if (status === 'excused') row.classList.add('bg-blue-50');
}

document.querySelectorAll('input[type=radio]:checked').forEach((radio) => {
    const sid = radio.name.match(/\d+/)[0];
    highlightRow(sid, radio.value);
});
</script>
@endsection
