<?php

namespace App\Services;

use App\Models\Section;
use App\Models\SectionSubject;
use App\Models\TeacherSubjectEligibility;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SectionScheduleService
{
    public const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    public function minutes(?string $value): ?int
    {
        if (! $value || ! preg_match('/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i', trim($value), $parts)) {
            return null;
        }
        $hour = (int) $parts[1];
        $minute = (int) $parts[2];
        if ($minute > 59 || $hour > (isset($parts[3]) ? 12 : 23) || (isset($parts[3]) && $hour < 1)) {
            return null;
        }
        if (isset($parts[3])) {
            $hour = $hour % 12 + (strtoupper($parts[3]) === 'PM' ? 12 : 0);
        }

        return $hour * 60 + $minute;
    }

    public function days(?string $value): array
    {
        $value = strtolower(trim((string) $value));
        $aliases = ['mon' => 'Monday', 'tue' => 'Tuesday', 'wed' => 'Wednesday', 'thu' => 'Thursday', 'fri' => 'Friday', 'sat' => 'Saturday', 'sun' => 'Sunday'];
        if (preg_match('/^[mtwfh]+$/', $value)) {
            preg_match_all('/th|m|t|w|f|h/', $value, $parts);

            return array_values(array_unique(array_map(fn ($day) => ['m' => 'Monday', 't' => 'Tuesday', 'w' => 'Wednesday', 'th' => 'Thursday', 'h' => 'Thursday', 'f' => 'Friday'][$day], $parts[0])));
        }
        $days = [];
        foreach (preg_split('/[,\/\s]+/', $value, -1, PREG_SPLIT_NO_EMPTY) as $day) {
            $full = $aliases[substr($day, 0, 3)] ?? null;
            if (! $full) {
                return self::DAYS; // Unknown legacy day: conservatively reserve every day.
            }
            $days[] = $full;
        }

        return $days ? array_values(array_unique($days)) : self::DAYS;
    }

    public function meetings(SectionSubject $assignment): array
    {
        $rows = $assignment->schedules->map->only(['day', 'time_start', 'time_end', 'room'])->all();
        if ($assignment->day || $assignment->time_start || $assignment->time_end) {
            $rows[] = $assignment->only(['day', 'time_start', 'time_end', 'room']);
        }
        $meetings = [];
        foreach ($rows as $row) {
            $start = $this->minutes($row['time_start']);
            $end = $this->minutes($row['time_end']);
            if ($start === null || $end === null || $end <= $start) {
                throw ValidationException::withMessages(['schedule' => "Complete the existing schedule for assignment #{$assignment->id} before generating or approving sections."]);
            }
            foreach ($this->days($row['day']) as $day) {
                $meeting = ['day' => $day, 'start' => $start, 'end' => $end, 'room' => strtolower(trim($row['room'] ?? '')), 'teacher_id' => $assignment->teacher_id, 'section_id' => $assignment->section_id];
                $meetings[json_encode($meeting)] = $meeting;
            }
        }

        return array_values($meetings);
    }

    public function overlaps(array $one, array $two): bool
    {
        return $one['day'] === $two['day'] && $one['start'] < $two['end'] && $one['end'] > $two['start'];
    }

    public function approvalConflict(Section $section): ?string
    {
        $assignments = SectionSubject::with('schedules')->whereHas('section', fn ($query) => $query
            ->where('school_year', $section->school_year)->where('semester', $section->semester)
            ->where('workflow_status', '!=', 'closed'))->get();
        $own = $assignments->where('section_id', $section->id);
        $generated = DB::table('section_generation_batches')->whereJsonContains('section_ids', $section->id)->exists();
        if ($generated) {
            foreach ($own as $assignment) {
                if (! TeacherSubjectEligibility::eligible()->where('subject_id', $assignment->subject_id)->where('teacher_id', $assignment->teacher_id)->exists()) {
                    return 'A generated assignment no longer has an eligible teacher. Obtain current approval or update the teacher before approving this section.';
                }
                if (! $this->meetings($assignment)) {
                    return 'Complete all generated subject schedules before approval.';
                }
            }
        }
        foreach ($own as $assignment) {
            foreach ($this->meetings($assignment) as $meeting) {
                foreach ($assignments as $other) {
                    if ($other->id === $assignment->id) {
                        continue;
                    }
                    $otherRooms = $other->schedules->pluck('room')->push($other->room)->map(fn ($room) => strtolower(trim($room ?? '')));
                    if ($other->section_id !== $assignment->section_id && (! $assignment->teacher_id || $other->teacher_id !== $assignment->teacher_id) && ($meeting['room'] === '' || ! $otherRooms->contains($meeting['room']))) {
                        continue;
                    }
                    foreach ($this->meetings($other) as $busy) {
                        if ($this->overlaps($meeting, $busy) && (
                            $meeting['section_id'] === $busy['section_id'] ||
                            ($meeting['teacher_id'] && $meeting['teacher_id'] === $busy['teacher_id']) ||
                            ($meeting['room'] !== '' && $meeting['room'] === $busy['room'])
                        )) {
                            return 'Schedule conflict: a section, teacher, or room has overlapping meetings in this term.';
                        }
                    }
                }
            }
        }

        return null;
    }
}
