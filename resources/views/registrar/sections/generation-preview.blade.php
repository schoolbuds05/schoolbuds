@extends('layouts.portal', ['title' => 'Generation preview'])
@section('content')
@php
    $prefix = request()->routeIs('department-chair.*') ? 'department-chair.sections' : 'registrar.sections';
@endphp
<h1 class="text-2xl font-black">Generation preview</h1>
<p class="my-3">{{ count($plan['sections']) }} sections for {{ $plan['course'] }}. No sections have been saved. This preview expires in 30 minutes.</p>
@if($plan['schedule_validation']['conflict_free'])
<section class="my-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900" role="status">
    <h2 class="font-black">Schedule comparison passed — no conflicts found</h2>
    <p class="mt-1 text-sm">
        Checked {{ $plan['schedule_validation']['generated_meetings'] }} proposed meeting(s) against the term schedule;
        {{ $plan['schedule_validation']['existing_meetings_compared'] }} existing meeting(s) were included in the comparison for
        {{ $plan['schedule_validation']['school_year'] }} · {{ ucfirst($plan['schedule_validation']['semester']) }} semester.
        New meetings were also checked against one another for overlapping sections, teachers, and rooms.
    </p>
</section>
@endif
@foreach($plan['sections'] as $section)
    @php
        $meetings = collect($section['assignments'])->flatMap(fn ($assignment) => collect($assignment['meetings'])->map(fn ($meeting) => $meeting + [
            'subject_code' => $assignment['subject_code'],
            'subject_name' => $assignment['subject_name'],
            'teacher_name' => $assignment['teacher_name'],
        ]))->values();
        $days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        if ($meetings->contains('day', 'Sunday')) {
            $days[] = 'Sunday';
        }
        $startMinutes = $meetings->isEmpty()
            ? 450
            : min(450, intdiv($meetings->min(fn ($meeting) => \Illuminate\Support\Carbon::parse($meeting['time_start'])->hour * 60 + \Illuminate\Support\Carbon::parse($meeting['time_start'])->minute), 30) * 30);
        $endMinutes = $meetings->isEmpty()
            ? 1260
            : max(1260, (int) ceil($meetings->max(fn ($meeting) => \Illuminate\Support\Carbon::parse($meeting['time_end'])->hour * 60 + \Illuminate\Support\Carbon::parse($meeting['time_end'])->minute) / 30) * 30);
        $slotCount = intdiv($endMinutes - $startMinutes, 30);
        $timelineHeight = $slotCount * 28;
        $scheduleColors = collect($section['assignments'])->map(function ($assignment, $index) {
            $hue = (int) round(fmod($index * 137.508, 360));

            return [
                'background' => "hsl({$hue}, 55%, 82%)",
                'border' => "hsl({$hue}, 45%, 48%)",
            ];
        });
    @endphp
    <section class="my-4 overflow-x-auto rounded-xl bg-white p-4">
        <details>
            <summary class="flex cursor-pointer list-none items-center justify-between gap-4 rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
                <span>
                    <span class="block text-lg font-bold">{{ $section['name'] }} · {{ $section['expected_students'] }} expected students</span>
                    <span class="block text-sm text-slate-600">Click to view this section's weekly schedule</span>
                </span>
                <span class="shrink-0 rounded-lg bg-portal-accent px-3 py-2 text-sm font-bold text-white">View schedule</span>
            </summary>
            <div class="mt-4">
        <p class="text-sm text-slate-600">Weekly timetable · 30-minute intervals</p>
        <div class="my-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-700" aria-label="Subject color key">
            @foreach($section['assignments'] as $assignmentIndex => $assignment)
                @php
                    $color = $scheduleColors[$assignmentIndex];
                @endphp
                <span class="inline-flex items-center gap-1.5">
                    <span class="inline-block h-3 w-3 rounded-sm border" style="background-color: {{ $color['background'] }}; border-color: {{ $color['border'] }}"></span>
                    <strong>{{ $assignment['subject_code'] }}</strong>
                    <span>{{ $assignment['subject_name'] }}</span>
                </span>
            @endforeach
        </div>
        <div class="schedule-timetable min-w-[900px] overflow-hidden rounded-lg border border-slate-300" style="min-width: 900px; border: 1px solid #cbd5e1; border-radius: 8px">
            <table class="w-full table-fixed border-collapse" style="width: 100%; table-layout: fixed; border-collapse: collapse">
                <thead>
                    <tr style="background-color: #ed7d31; color: #111827">
                        <th class="text-xs font-black" style="width: 100px; border: 1px solid #cbd5e1; padding: 10px 6px">Time</th>
                        @foreach($days as $day)
                            <th class="text-center text-xs font-black" style="border: 1px solid #cbd5e1; padding: 10px 6px">{{ $day }}</th>
                        @endforeach
                    </tr>
                </thead>
            </table>
            <div class="grid" style="grid-template-columns: 100px minmax(0, 1fr)">
                <div class="relative border-r border-slate-300 bg-slate-50 text-[11px] font-semibold text-slate-700" style="height: {{ $timelineHeight }}px">
                    @for($slot = 0; $slot < $slotCount; $slot++)
                        @php
                            $slotStart = \Illuminate\Support\Carbon::createFromTime(intdiv($startMinutes + $slot * 30, 60), ($startMinutes + $slot * 30) % 60);
                            $slotEnd = $slotStart->copy()->addMinutes(30);
                        @endphp
                        <div class="absolute left-0 right-0 border-b border-slate-300 px-1" style="top: {{ $slot * 28 }}px; height: 28px; display: flex; align-items: center; justify-content: center; white-space: nowrap">
                            {{ $slotStart->format('g:i') }}–{{ $slotEnd->format('g:i A') }}
                        </div>
                    @endfor
                </div>
                <div class="relative grid" style="height: {{ $timelineHeight }}px; grid-template-columns: repeat({{ count($days) }}, minmax(0, 1fr)); background-image: repeating-linear-gradient(to bottom, transparent 0, transparent 27px, #d7dee8 27px, #d7dee8 28px)">
                    @foreach($days as $day)
                        <div class="relative border-r border-slate-300">
                            @foreach($section['assignments'] as $assignmentIndex => $assignment)
                                @foreach($assignment['meetings'] as $meeting)
                                    @if($meeting['day'] === $day)
                                        @php
                                            $meetingStart = \Illuminate\Support\Carbon::parse($meeting['time_start']);
                                            $meetingEnd = \Illuminate\Support\Carbon::parse($meeting['time_end']);
                                            $meetingStartMinutes = $meetingStart->hour * 60 + $meetingStart->minute;
                                            $meetingEndMinutes = $meetingEnd->hour * 60 + $meetingEnd->minute;
                                            $meetingTop = ($meetingStartMinutes - $startMinutes) * 28 / 30;
                                            $meetingHeight = ($meetingEndMinutes - $meetingStartMinutes) * 28 / 30;
                                            $color = $scheduleColors[$assignmentIndex];
                                            $meetingLabel = $meeting['type'].' · '.$day.' '.$meetingStart->format('g:i A').'–'.$meetingEnd->format('g:i A');
                                            $roomTypeLabel = ucfirst($meeting['room_type']).' room';
                                        @endphp
                                        <div
                                            class="absolute left-1 right-1 z-10 overflow-hidden rounded border text-center font-bold leading-tight text-slate-900"
                                            style="top: {{ $meetingTop }}px; height: {{ $meetingHeight }}px; background-color: {{ $color['background'] }}; border-color: {{ $color['border'] }}; color: #111827; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 1px 3px; font-size: 10px; line-height: 1.05"
                                            data-subject-color="{{ $color['background'] }}"
                                            title="{{ $meetingLabel }} · {{ $assignment['subject_code'] }} — {{ $assignment['subject_name'] }} · {{ $meeting['room'] }} · {{ $roomTypeLabel }} · {{ $assignment['teacher_name'] }}"
                                            aria-label="{{ $meetingLabel }} · {{ $assignment['subject_code'] }} · {{ $meeting['room'] }} · {{ $roomTypeLabel }} · {{ $assignment['teacher_name'] }}"
                                        >
                                            @if($meetingHeight >= 40)
                                                <span>{{ $assignment['subject_code'] }}</span>
                                                <span>{{ $meeting['room'] }} · {{ $roomTypeLabel }}</span>
                                                <span class="schedule-teacher-name" style="font-size: 9px; font-weight: 500">{{ $assignment['teacher_name'] }}</span>
                                            @elseif($meetingHeight >= 22)
                                                <span style="font-size: 8px; line-height: 1">{{ $assignment['subject_code'] }}</span>
                                                <span style="font-size: 8px; line-height: 1; white-space: nowrap">{{ $meeting['room'] }} · {{ $roomTypeLabel }}</span>
                                                <span class="schedule-teacher-name" style="font-size: 8px; font-weight: 500; line-height: 1; white-space: nowrap">{{ $assignment['teacher_name'] }}</span>
                                            @else
                                                <span class="schedule-teacher-name" style="font-size: 7px; font-weight: 600; white-space: nowrap">{{ $assignment['teacher_name'] }} · {{ ucfirst($meeting['room_type']) }}</span>
                                            @endif
                                        </div>
                                    @endif
                                @endforeach
                            @endforeach
                        </div>
                    @endforeach
                    @if($startMinutes <= 720 && $endMinutes >= 780)
                        <div class="pointer-events-none absolute left-0 right-0 z-20 flex items-center justify-center border-y px-2 text-xs font-black uppercase" style="top: {{ (720 - $startMinutes) * 28 / 30 }}px; height: 56px; background-color: #ff4d4f; border-color: #c62828; color: #ffffff">
                            Lunch Break
                        </div>
                    @endif
                </div>
            </div>
        </div>
            </div>
        </details>
    </section>
@endforeach
<form method="POST" action="{{ route($prefix.'.generate.store') }}" class="flex flex-wrap gap-3">
    @csrf<input type="hidden" name="batch_id" value="{{ $batch_id }}">
    <button class="rounded-lg bg-portal-accent px-4 py-3 font-bold text-white">Save section drafts</button>
    <a href="{{ route($prefix.'.generate') }}" class="rounded-lg border border-slate-300 px-4 py-3">Start new preview</a>
</form>
<p class="mt-3 text-sm text-slate-600">Saving checks current availability again. Draft sections remain closed to enrollment until the existing review process approves them.</p>
@endsection
