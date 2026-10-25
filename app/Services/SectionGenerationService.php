<?php

namespace App\Services;

use App\Models\Course;
use App\Models\Section;
use App\Models\SectionSubject;
use App\Models\Subject;
use App\Models\TeacherSubjectEligibility;
use App\Models\User;
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
        $rooms = array_values(array_unique(array_map(fn ($room) => strtolower(trim($room)), $input['rooms'])));
        if (count($rooms) !== count($input['rooms'])) {
            $this->fail('rooms', 'Room names must be unique after removing spaces and ignoring case.');
        }
        $teachers = $eligibilities->flatten()->pluck('teacher_id')->unique()->all();
        $busy = [];
        $loads = array_fill_keys($teachers, 0);
        $assignments = SectionSubject::with('schedules')->whereHas('section', fn ($q) => $q->where('school_year', $input['school_year'])->where('semester', $input['semester'])->where('workflow_status', '!=', 'closed'))->orderBy('id')->get();
        foreach ($assignments as $assignment) {
            $roomMatches = in_array(strtolower(trim($assignment->room ?? '')), $rooms, true) || $assignment->schedules->contains(fn ($row) => in_array(strtolower(trim($row->room ?? '')), $rooms, true));
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
        // Place subjects with fewer teachers first; stable ties keep previews reproducible.
        $requirements = $requirements->sortBy(fn ($r) => sprintf('%05d-%05d-%010d', $eligibilities[$r['subject_id']]->count(), 10000 - $r['minutes'] * $r['meetings'], $r['subject_id']))->values();
        $start = $this->schedules->minutes($input['time_start']);
        $end = $this->schedules->minutes($input['time_end']);
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
            foreach ($requirements as $requirement) {
                $subject = $subjects[$requirement['subject_id']];
                $candidates = $eligibilities[$subject->id]->sortBy(fn ($e) => sprintf('%08d-%010d', $loads[$e->teacher_id], $e->teacher_id));
                $selected = null;
                foreach ($candidates as $eligibility) {
                    if ($input['max_teacher_minutes'] < $loads[$eligibility->teacher_id] + $requirement['meetings'] * $requirement['minutes']) {
                        continue;
                    }
                    $placements = [];
                    foreach ($input['days'] as $day) {
                        for ($time = $start; $time + $requirement['minutes'] <= $end; $time += 15) {
                            foreach ($rooms as $roomIndex => $room) {
                                $slot = ['day' => $day, 'start' => $time, 'end' => $time + $requirement['minutes'], 'room' => $room, 'teacher_id' => $eligibility->teacher_id, 'section_id' => $sectionKey];
                                $conflict = false;
                                foreach ($busy as $reserved) {
                                    if (++$checks > 5000000) {
                                        $this->fail('schedule', 'The planner reached its search limit. Reduce the batch size or simplify the room and teacher choices.');
                                    }
                                    if ($this->schedules->overlaps($slot, $reserved) && ($reserved['section_id'] === $sectionKey || $reserved['teacher_id'] === $eligibility->teacher_id || $reserved['room'] === $room)) {
                                        $conflict = true;
                                        break;
                                    }
                                }
                                if (! $conflict) {
                                    $placements[] = $slot + ['display_room' => trim($input['rooms'][$roomIndex])];
                                    break 2;
                                }
                            }
                        }
                        if (count($placements) === (int) $requirement['meetings']) {
                            break;
                        }
                    }
                    if (count($placements) === (int) $requirement['meetings']) {
                        $selected = [$eligibility, $placements];
                        break;
                    }
                }
                if (! $selected) {
                    $this->fail('schedule', "Could not find a complete schedule for {$name}, {$subject->code}. Add days, rooms, teaching hours or eligible teachers, adjust the weekly load limit, or reduce the batch size.");
                }
                [$eligibility, $placements] = $selected;
                $busy = array_merge($busy, $placements);
                $loads[$eligibility->teacher_id] += $requirement['meetings'] * $requirement['minutes'];
                $section['assignments'][] = ['subject_id' => $subject->id, 'subject_code' => $subject->code, 'subject_name' => $subject->name, 'teacher_id' => $eligibility->teacher_id, 'teacher_name' => $eligibility->teacher->name, 'meetings' => array_map(fn ($p) => ['day' => $p['day'], 'time_start' => sprintf('%02d:%02d', intdiv($p['start'], 60), $p['start'] % 60), 'time_end' => sprintf('%02d:%02d', intdiv($p['end'], 60), $p['end'] % 60), 'room' => $p['display_room']], $placements)];
            }
            $plan[] = $section;
        }

        return ['course_id' => $course->id, 'course' => $course->name, 'department_id' => $course->department_id, 'sections' => $plan];
    }

    public function preview(User $user, array $input): array
    {
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
            $plan = $this->plan($user, $input);
            if ($plan !== json_decode($batch->plan, true)) {
                $this->fail('batch_id', 'Availability changed since this preview. Generate a new preview before saving.');
            }
            $ids = [];
            foreach ($plan['sections'] as $item) {
                $section = Section::create(['name' => $item['name'], 'program_type' => 'college', 'course' => $plan['course'], 'year_level' => $input['year_level'], 'school_year' => $input['school_year'], 'semester' => $input['semester'], 'max_students' => $input['max_students'], 'department_id' => $plan['department_id'], 'created_by' => $user->id, 'workflow_status' => 'draft', 'is_active' => false]);
                foreach ($item['assignments'] as $itemAssignment) {
                    $assignment = $section->sectionSubjects()->create(['subject_id' => $itemAssignment['subject_id'], 'teacher_id' => $itemAssignment['teacher_id']] + $itemAssignment['meetings'][0]);
                    $assignment->schedules()->createMany($itemAssignment['meetings']);
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
