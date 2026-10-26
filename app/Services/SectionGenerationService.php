<?php

namespace App\Services;

use App\Models\Course;
use App\Models\Room;
use App\Models\Section;
use App\Models\SectionSubject;
use App\Models\Subject;
use App\Models\TeacherSubjectEligibility;
use App\Models\User;
use Illuminate\Support\Arr;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class SectionGenerationService
{
    public function __construct(private SectionScheduleService $schedules) {}

    public function course(User $user, int $id): Course
    {
        $department = SectionDepartmentAccess::authorize($user);
        $course = Course::with('department')->findOrFail($id);
        abort_if($department && (int) $course->department_id !== (int) $department->id, 403);
        if (! $course->is_active || $course->program_type !== 'college' || ! $course->department?->canManageSections()) {
            $this->fail('course_id', 'Choose an active college course owned by an active course department.');
        }

        return $course;
    }

    public function subjects(Course $course, string $year, string $semester)
    {
        return Subject::with('department')->where('is_active', true)->where('program_type', 'college')
            ->where(fn ($q) => $q->whereNull('course')->orWhere('course', '')->orWhere('course', $course->name))
            ->where(fn ($q) => $q->whereNull('year_level')->orWhere('year_level', '')->orWhere('year_level', $year))
            ->where(fn ($q) => $q->whereNull('semester')->orWhere('semester', $semester))
            ->orderBy('id')->get();
    }

    public function plan(User $user, array $input): array
    {
        $course = $this->course($user, (int) $input['course_id']);
        $count = (int) ceil($input['expected_students'] / $input['max_students']);
        if ($count > 20) {
            $this->fail('expected_students', 'Generate at most 20 sections at a time. Increase capacity or reduce the expected count.');
        }
        if (array_sum(array_column($input['subjects'], 'meetings')) * $count > 1000) {
            $this->fail('subjects', 'Generate at most 1,000 meetings at a time.');
        }
        [$firstYear, $lastYear] = array_map('intval', explode('-', $input['school_year']));
        if ($lastYear !== $firstYear + 1) {
            $this->fail('school_year', 'School year must contain consecutive years, for example 2026-2027.');
        }
        $subjects = $this->subjects($course, $input['year_level'], $input['semester'])->keyBy('id');
        $requirements = collect($input['subjects'])->sortBy('subject_id')->values();
        $eligibilities = TeacherSubjectEligibility::eligible()->with('teacher')->whereIn('subject_id', $requirements->pluck('subject_id'))->orderBy('teacher_id')->get()->groupBy('subject_id');
        foreach ($requirements as $requirement) {
            $subject = $subjects->get($requirement['subject_id']);
            if (! $subject) {
                $this->fail('subjects', 'Choose active general or course subjects matching this course, year, and semester.');
            }
            if (! isset($eligibilities[$subject->id]) || $eligibilities[$subject->id]->isEmpty()) {
                $this->fail('subjects', "{$subject->code}: no teacher has current approval from its managing department.");
            }
            if ($requirement['meetings'] > count($input['days'])) {
                $this->fail('days', "{$subject->code}: choose enough days for its weekly meetings (one meeting per day).");
            }
        }
        $rooms = Room::query()->whereIn('id', $input['room_ids'])->where('is_active', true)->orderBy('name')->get();
        if ($rooms->count() !== count($input['room_ids'])) {
            $this->fail('room_ids', 'Choose active rooms from the room inventory.');
        }
        $roomNames = $rooms->map(fn ($room) => strtolower(trim($room->name)))->all();
        $teachers = $eligibilities->flatten()->pluck('teacher_id')->unique()->all();
        $busy = [];
        $loads = array_fill_keys($teachers, 0);
        $assignments = SectionSubject::with(['schedules', 'section', 'subject', 'teacher'])
            ->whereHas('section', fn ($q) => $q->where('school_year', $input['school_year'])->where('semester', $input['semester'])->where('workflow_status', '!=', 'closed'))
            ->orderBy('id')->get();
        $existingSchedule = $this->existingScheduleRows($assignments);
        foreach ($assignments as $assignment) {
            $roomMatches = in_array(strtolower(trim($assignment->room ?? '')), $roomNames, true) || $assignment->schedules->contains(fn ($row) => in_array(strtolower(trim($row->room ?? '')), $roomNames, true));
            if (! in_array($assignment->teacher_id, $teachers) && ! $roomMatches) {
                continue;
            }
            $meetings = $this->schedules->meetings($assignment);
            if (! $meetings && in_array($assignment->teacher_id, $teachers)) {
                $this->fail('schedule', "Assignment #{$assignment->id} has no schedule. Complete it before allocating this teacher.");
            }
            foreach ($meetings as $meeting) {
                $busy[] = $meeting;
                if (isset($loads[$assignment->teacher_id])) {
                    $loads[$assignment->teacher_id] += $meeting['end'] - $meeting['start'];
                }
            }
        }
        $existingMeetingCount = count($existingSchedule);
        // Place subjects with fewer teachers first; stable ties keep previews reproducible.
        $requirements = $requirements->sortBy(fn ($r) => sprintf('%05d-%05d-%010d', $eligibilities[$r['subject_id']]->count(), 10000 - $r['minutes'] * $r['meetings'], $r['subject_id']))->values();
        $start = $this->schedules->minutes($input['time_start']);
        $end = $this->schedules->minutes($input['time_end']);
        $lunchBreakStart = $this->schedules->minutes('12:00');
        $lunchBreakEnd = $this->schedules->minutes('13:00');
        $names = Section::where('school_year', $input['school_year'])->where('semester', $input['semester'])->pluck('name')->map(fn ($name) => strtolower($name))->all();
        $prefix = substr($course->acronym ?: $course->name, 0, 65).' '.$input['year_level'];
        $plan = [];
        $checks = 0;
        $sequence = 1;
        for ($index = 0; $index < $count; $index++) {
            do {
                $name = $prefix.'-'.str_pad((string) $sequence++, 2, '0', STR_PAD_LEFT);
            } while (in_array(strtolower($name), $names, true));
            $names[] = strtolower($name);
            $section = ['name' => $name, 'expected_students' => min($input['max_students'], $input['expected_students'] - $index * $input['max_students']), 'assignments' => []];
            $sectionKey = 'new-'.$index;
            $sectionRooms = [];
            $subjectIndex = 0;
            foreach ($requirements as $requirement) {
                $subject = $subjects[$requirement['subject_id']];
                $subjectIndex++;
                $lectureUnits = (float) $subject->units_lec;
                $labUnits = (float) $subject->units_lab;
                $totalUnits = $lectureUnits + $labUnits;
                $lectureMeetings = $totalUnits > 0
                    ? (int) round((int) $requirement['meetings'] * $lectureUnits / $totalUnits)
                    : (int) $requirement['meetings'];
                if ($lectureUnits > 0 && $labUnits > 0 && (int) $requirement['meetings'] > 1) {
                    $lectureMeetings = min((int) $requirement['meetings'] - 1, max(1, $lectureMeetings));
                }
                $meetingTypes = array_merge(
                    array_fill(0, $lectureMeetings, 'Lecture'),
                    array_fill(0, (int) $requirement['meetings'] - $lectureMeetings, 'Lab'),
                );
                $roomOptionsByType = [];
                foreach (array_unique($meetingTypes) as $meetingType) {
                    $roomType = strtolower($meetingType);
                    $roomOptionsByType[$meetingType] = $rooms
                        ->filter(fn ($room) => $room->capacity >= $section['expected_students'] && in_array($room->room_type, [$roomType, Room::TYPE_FLEXIBLE], true))
                        ->sortBy(fn ($room) => sprintf('%d-%s', $room->room_type === Room::TYPE_FLEXIBLE ? 1 : 0, strtolower($room->name)))
                        ->values();
                    if ($meetingType === 'Lecture') {
                        $seed = $input['_room_seed'];
                        $roomOptionsByType[$meetingType] = $roomOptionsByType[$meetingType]
                            ->sortBy(fn ($room) => hash('sha256', $seed.':'.$sectionKey.':'.$room->id))
                            ->values();
                    }
                    if ($roomOptionsByType[$meetingType]->isEmpty()) {
                        $this->fail('room_ids', "No selected active {$roomType} or flexible room can hold {$section['expected_students']} students.");
                    }
                }
                $candidates = $eligibilities[$subject->id]->sortBy(fn ($e) => sprintf('%08d-%010d', $loads[$e->teacher_id], $e->teacher_id));
                $selected = null;
                foreach ($candidates as $eligibility) {
                    if ($input['max_teacher_minutes'] < $loads[$eligibility->teacher_id] + $requirement['meetings'] * $requirement['minutes']) {
                        continue;
                    }
                    $placements = [];
                    $candidateSectionRooms = $sectionRooms;
                    foreach ($input['days'] as $day) {
                        for ($time = $start; $time + $requirement['minutes'] <= $end; $time += 15) {
                            if ($time < $lunchBreakEnd && $time + $requirement['minutes'] > $lunchBreakStart) {
                                continue;
                            }
                            $meetingType = $meetingTypes[count($placements)];
                            $roomOptions = $roomOptionsByType[$meetingType];
                            if ($meetingType === 'Lecture' && $roomOptions->count() > 1) {
                                $roomOffset = ($subjectIndex - 1) % $roomOptions->count();
                                $roomOptions = $roomOptions->slice($roomOffset)->concat($roomOptions->take($roomOffset));
                            }
                            $roomKey = $subject->id.':'.$meetingType;
                            if (isset($candidateSectionRooms[$roomKey])) {
                                $roomOptions = $roomOptions->where('id', $candidateSectionRooms[$roomKey]);
                            }
                            foreach ($roomOptions as $room) {
                                $roomName = strtolower(trim($room->name));
                                $slot = ['day' => $day, 'start' => $time, 'end' => $time + $requirement['minutes'], 'room' => $roomName, 'teacher_id' => $eligibility->teacher_id, 'section_id' => $sectionKey];
                                $conflict = false;
                                foreach ($busy as $reserved) {
                                    if (++$checks > 5000000) {
                                        $this->fail('schedule', 'The planner reached its search limit. Reduce the batch size or simplify the room and teacher choices.');
                                    }
                                    if ($this->schedules->overlaps($slot, $reserved) && ($reserved['section_id'] === $sectionKey || $reserved['teacher_id'] === $eligibility->teacher_id || $reserved['room'] === $roomName)) {
                                        $conflict = true;
                                        break;
                                    }
                                }
                                if (! $conflict) {
                                    $candidateSectionRooms[$roomKey] = $room->id;
                                    $placements[] = $slot + ['display_room' => $room->name, 'type' => $meetingType];
                                    break 2;
                                }
                            }
                        }
                        if (count($placements) === (int) $requirement['meetings']) {
                            break;
                        }
                    }
                    if (count($placements) === (int) $requirement['meetings']) {
                        $selected = [$eligibility, $placements, $candidateSectionRooms];
                        break;
                    }
                }
                if (! $selected) {
                    $this->fail('schedule', "Could not find a complete schedule for {$name}, {$subject->code}. Add days, rooms, teaching hours or eligible teachers, adjust the weekly load limit, or reduce the batch size.");
                }
                [$eligibility, $placements, $sectionRooms] = $selected;
                $busy = array_merge($busy, $placements);
                $loads[$eligibility->teacher_id] += $requirement['meetings'] * $requirement['minutes'];
                $section['assignments'][] = [
                    'subject_id' => $subject->id,
                    'subject_code' => $subject->code,
                    'subject_name' => $subject->name,
                    'teacher_id' => $eligibility->teacher_id,
                    'teacher_name' => $eligibility->teacher->name,
                    'meetings' => array_map(
                        fn ($placement) => [
                            'type' => $placement['type'],
                            'day' => $placement['day'],
                            'time_start' => sprintf('%02d:%02d', intdiv($placement['start'], 60), $placement['start'] % 60),
                            'time_end' => sprintf('%02d:%02d', intdiv($placement['end'], 60), $placement['end'] % 60),
                            'room' => $placement['display_room'],
                        ],
                        $placements,
                    ),
                ];
            }
            $plan[] = $section;
        }
        $generatedMeetingCount = collect($plan)
            ->sum(fn (array $section) => collect($section['assignments'])->sum(fn (array $assignment) => count($assignment['meetings'])));

        return [
            'course_id' => $course->id,
            'course' => $course->name,
            'department_id' => $course->department_id,
            'sections' => $plan,
            'existing_schedule' => $existingSchedule,
            'schedule_validation' => [
                'conflict_free' => true,
                'generated_meetings' => $generatedMeetingCount,
                'existing_meetings_compared' => $existingMeetingCount,
                'school_year' => $input['school_year'],
                'semester' => $input['semester'],
            ],
        ];
    }

    private function existingScheduleRows(Collection $assignments): array
    {
        $rows = [];
        foreach ($assignments as $assignment) {
            $scheduleRows = $assignment->schedules
                ->map(fn ($schedule) => $schedule->only(['day', 'time_start', 'time_end', 'room']))
                ->all();
            if ($assignment->day || $assignment->time_start || $assignment->time_end) {
                $scheduleRows[] = $assignment->only(['day', 'time_start', 'time_end', 'room']);
            }

            $seen = [];
            foreach ($scheduleRows as $schedule) {
                foreach ($this->schedules->days($schedule['day'] ?? null) as $day) {
                    $meeting = [
                        'section_id' => $assignment->section_id,
                        'section' => $assignment->section?->name ?? 'Unknown section',
                        'course' => $assignment->section?->course ?: ($assignment->section?->strand ?: '—'),
                        'subject' => trim(($assignment->subject?->code ?? '').' — '.($assignment->subject?->name ?? 'Unknown subject')),
                        'teacher' => $assignment->teacher?->name ?? 'Teacher TBA',
                        'day' => $day,
                        'time_start' => $schedule['time_start'] ?? null,
                        'time_end' => $schedule['time_end'] ?? null,
                        'room' => trim((string) ($schedule['room'] ?? '')) ?: 'Room TBA',
                    ];
                    $key = json_encode([
                        $meeting['day'],
                        $meeting['time_start'],
                        $meeting['time_end'],
                        strtolower($meeting['room']),
                    ]);
                    if (isset($seen[$key])) {
                        continue;
                    }
                    $seen[$key] = true;
                    $rows[] = $meeting;
                }
            }
        }

        usort($rows, function (array $left, array $right): int {
            $dayOrder = array_flip(SectionScheduleService::DAYS);
            $leftKey = [
                $dayOrder[$left['day']],
                $this->schedules->minutes($left['time_start']) ?? PHP_INT_MAX,
                strtolower($left['section']),
                strtolower($left['subject']),
                strtolower($left['teacher']),
                strtolower($left['room']),
            ];
            $rightKey = [
                $dayOrder[$right['day']],
                $this->schedules->minutes($right['time_start']) ?? PHP_INT_MAX,
                strtolower($right['section']),
                strtolower($right['subject']),
                strtolower($right['teacher']),
                strtolower($right['room']),
            ];

            return $leftKey <=> $rightKey;
        });

        return $rows;
    }

    public function preview(User $user, array $input): array
    {
        $input['_room_seed'] = bin2hex(random_bytes(16));
        $plan = $this->plan($user, $input);
        $id = (string) Str::uuid();
        DB::table('section_generation_batches')->insert(['id' => $id, 'created_by' => $user->id, 'input' => json_encode($input), 'plan' => json_encode($plan), 'expires_at' => now()->addMinutes(30), 'created_at' => now(), 'updated_at' => now()]);

        return ['batch_id' => $id, 'plan' => $plan];
    }

    public function commit(User $user, string $id): array
    {
        return DB::transaction(function () use ($user, $id) {
            // Serialize generator commits across departments sharing rooms and teachers.
            DB::table('section_generation_mutex')->where('id', 1)->lockForUpdate()->first();
            $batch = DB::table('section_generation_batches')->where('id', $id)->lockForUpdate()->first();
            abort_unless($batch && (int) $batch->created_by === (int) $user->id, 404);
            $input = json_decode($batch->input, true);
            $this->course($user, (int) $input['course_id']);
            if ($batch->section_ids !== null) {
                return json_decode($batch->section_ids, true);
            }
            if (now()->greaterThan($batch->expires_at)) {
                $this->fail('batch_id', 'This preview expired. Generate a new preview.');
            }
            if (! is_array($input) || ! isset($input['room_ids'])) {
                $this->fail('batch_id', 'This preview uses an outdated room list. Generate a new preview.');
            }
            if (! isset($input['_room_seed'])) {
                $this->fail('batch_id', 'This preview predates the room scheduling update. Generate a new preview before saving.');
            }
            $plan = $this->plan($user, $input);
            if ($plan !== json_decode($batch->plan, true)) {
                $this->fail('batch_id', 'Availability changed since this preview. Generate a new preview before saving.');
            }
            $ids = [];
            foreach ($plan['sections'] as $item) {
                $section = Section::create(['name' => $item['name'], 'program_type' => 'college', 'course' => $plan['course'], 'year_level' => $input['year_level'], 'school_year' => $input['school_year'], 'semester' => $input['semester'], 'max_students' => $input['max_students'], 'department_id' => $plan['department_id'], 'created_by' => $user->id, 'workflow_status' => 'draft', 'is_active' => false]);
                foreach ($item['assignments'] as $itemAssignment) {
                    $meetings = array_map(fn ($meeting) => Arr::only($meeting, ['day', 'time_start', 'time_end', 'room']), $itemAssignment['meetings']);
                    $assignment = $section->sectionSubjects()->create(['subject_id' => $itemAssignment['subject_id'], 'teacher_id' => $itemAssignment['teacher_id']] + $meetings[0]);
                    $assignment->schedules()->createMany($meetings);
                }
                $ids[] = $section->id;
            }
            DB::table('section_generation_batches')->where('id', $id)->update(['section_ids' => json_encode($ids), 'updated_at' => now()]);

            return $ids;
        }, 3);
    }

    private function fail(string $key, string $message): never
    {
        throw ValidationException::withMessages([$key => $message]);
    }
}
