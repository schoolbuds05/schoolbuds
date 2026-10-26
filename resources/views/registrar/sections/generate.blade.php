@extends('layouts.portal', ['title' => 'Generate sections'])
@section('content')
@php($prefix = request()->routeIs('department-chair.*') ? 'department-chair.sections' : 'registrar.sections')
<h1 class="text-2xl font-black text-slate-900">Generate sections</h1>
<p class="mt-2 text-sm text-slate-600">Select a college course and its subjects. Preview sections, weekly schedules and assigned teachers before saving drafts.</p>
@if($errors->any())
    <div role="alert" class="my-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
        <ul class="list-inside list-disc">@foreach($errors->all() as $error)<li>{{ $error }}</li>@endforeach</ul>
    </div>
@endif
<form method="GET" class="my-5 grid gap-3 rounded-xl bg-white p-5 md:grid-cols-4">
    @if($fixedCourse)
        <label>Course
            <input type="hidden" name="course_id" value="{{ $fixedCourse->id }}">
            <input value="{{ $fixedCourse->name }}" readonly class="mt-1 w-full rounded-lg border-slate-300 bg-slate-100 text-slate-700">
        </label>
    @else
        <label>Course<select name="course_id" required class="mt-1 w-full rounded-lg border-slate-300"><option value="">Select course</option>@foreach($courses as $course)<option value="{{ $course->id }}" @selected(request('course_id') == $course->id)>{{ $course->name }}</option>@endforeach</select></label>
    @endif
    <label>Year level<select name="year_level" class="mt-1 w-full rounded-lg border-slate-300">@foreach(['1','2','3','4'] as $year)<option @selected(request('year_level', '1') == $year)>{{ $year }}</option>@endforeach</select></label>
    <label>Semester<select name="semester" class="mt-1 w-full rounded-lg border-slate-300">@foreach(['1st','2nd','summer'] as $semester)<option @selected(request('semester', '1st') === $semester)>{{ $semester }}</option>@endforeach</select></label>
    <button class="rounded-lg bg-portal-accent px-4 py-2 font-bold text-white">{{ $fixedCourse ? 'Update course subjects' : 'Load course subjects' }}</button>
</form>
@if(request('course_id'))
<form method="POST" action="{{ route($prefix.'.generate.preview') }}" class="grid gap-4 rounded-xl bg-white p-5 md:grid-cols-3">
    @csrf
    <input type="hidden" name="course_id" value="{{ request('course_id') }}">
    <input type="hidden" name="year_level" value="{{ request('year_level', '1') }}">
    <input type="hidden" name="semester" value="{{ request('semester', '1st') }}">
    <label>School year<input name="school_year" required value="{{ old('school_year', date('Y').'-'.(date('Y') + 1)) }}" class="mt-1 w-full rounded-lg border-slate-300"></label>
    <label>Expected students<input type="number" name="expected_students" required min="1" max="2000" value="{{ old('expected_students', 100) }}" class="mt-1 w-full rounded-lg border-slate-300"></label>
    <label>Students per section<input type="number" name="max_students" required min="1" max="200" value="{{ old('max_students', 40) }}" class="mt-1 w-full rounded-lg border-slate-300"></label>
    <label>Daily start<input type="time" name="time_start" required value="{{ old('time_start', '08:00') }}" class="mt-1 w-full rounded-lg border-slate-300"></label>
    <label>Daily end<input type="time" name="time_end" required value="{{ old('time_end', '17:00') }}" class="mt-1 w-full rounded-lg border-slate-300"></label>
    <label>Teacher weekly minute limit<input type="number" name="max_teacher_minutes" required min="15" max="3600" value="{{ old('max_teacher_minutes', 1080) }}" class="mt-1 w-full rounded-lg border-slate-300"></label>
    <fieldset class="md:col-span-3"><legend class="font-bold">Available days</legend><div class="mt-2 flex flex-wrap gap-4">@foreach(\App\Services\SectionScheduleService::DAYS as $day)<label><input type="checkbox" name="days[]" value="{{ $day }}" @checked(in_array($day, old('days', ['Monday','Tuesday','Wednesday','Thursday','Friday'])))> {{ $day }}</label>@endforeach</div></fieldset>
    <fieldset class="md:col-span-3 rounded-lg border border-slate-200 p-3">
        <legend class="px-1 font-bold">Available rooms</legend>
        <p class="mb-2 text-sm text-slate-600">Select registered rooms. Lecture and lab meetings use compatible rooms with enough capacity; a section can use one lecture room and a separate lab room.</p>
        @if($rooms->isEmpty())
            <p class="text-sm font-semibold text-amber-700">No active rooms are available. Ask the registrar to add rooms to the inventory before generating sections.</p>
        @else
            <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                @foreach($rooms as $room)
                    <label class="flex items-start gap-2 rounded-lg border border-slate-200 p-3 text-sm">
                        <input type="checkbox" name="room_ids[]" value="{{ $room->id }}" @checked(in_array((int) $room->id, array_map('intval', old('room_ids', $rooms->pluck('id')->all())), true)) class="mt-1 rounded border-slate-300">
                        <span><span class="block font-bold text-slate-800">{{ $room->name }}</span><span class="text-xs text-slate-500">{{ ucfirst($room->room_type) }} · {{ $room->capacity }} seats</span></span>
                    </label>
                @endforeach
            </div>
        @endif
        @if(request()->routeIs('registrar.*'))
            <a href="{{ route('registrar.rooms.index') }}" class="mt-3 inline-block text-sm font-bold text-portal-accent">Manage room inventory</a>
        @endif
    </fieldset>
    <fieldset class="md:col-span-3"><legend class="font-bold">Weekly subject requirements</legend><p class="my-2 text-sm text-slate-600">Select subjects to include. Set meeting counts and minutes from your curriculum; the suggested 3 × 60 is editable. Lecture and lab units are shown for reference. Only currently approved teachers are assigned, including teachers from general subject departments.</p>
        @forelse($subjects as $subject)
        <div class="my-2 grid items-center gap-2 rounded-lg border border-slate-200 p-3 md:grid-cols-3">
            <label><input type="checkbox" data-generation-subject checked> <strong>{{ $subject->code }}</strong> — {{ $subject->name }} ({{ $subject->units_lec }} lec / {{ $subject->units_lab }} lab)</label>
            <input type="hidden" name="subjects[{{ $loop->index }}][subject_id]" value="{{ $subject->id }}">
            <label>Meetings / week<input type="number" name="subjects[{{ $loop->index }}][meetings]" min="1" max="7" value="3" required class="mt-1 w-full rounded-lg border-slate-300"></label>
            <label>Minutes / meeting<input type="number" name="subjects[{{ $loop->index }}][minutes]" min="15" max="240" step="15" value="60" required class="mt-1 w-full rounded-lg border-slate-300"></label>
        </div>
        @empty<p>No matching subjects. Add active subjects for this course/year/semester, or general subjects.</p>@endforelse
    </fieldset>
    <p class="text-sm text-slate-600 md:col-span-3">Existing sections in this term reserve their teacher and room times. Each subject uses one teacher and meets on distinct days. Generation adds new sections; it does not enroll students or replace existing sections.</p>
    <button class="rounded-lg bg-portal-accent px-4 py-3 font-bold text-white" @disabled(count($subjects) === 0 || $rooms->isEmpty())>Preview generation</button>
    <a href="{{ route($prefix.'.index') }}" class="p-3">Back to sections</a>
</form>
<script>
document.querySelectorAll('[data-generation-subject]').forEach(box => box.addEventListener('change', () => {
    box.closest('div').querySelectorAll('input[name]').forEach(input => input.disabled = !box.checked);
}));
</script>
@endif
@endsection
