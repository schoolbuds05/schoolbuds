# Automatic section, schedule and teacher generation

In the web or mobile **Sections** screen choose **Generate sections, schedules & teachers**. The web flow is available to course department chairs and registrars. The authenticated API also supports administrators. General subject departments supply subjects and approved teachers; they cannot generate sections. Generation currently targets college courses (year levels 1–4).

## Chair flow

1. Select an active course owned by an active course department, year level and semester. Chairs can select only their department's courses.
2. Enter school year, expected students and capacity per section. The count is `ceil(expected students / capacity)`: 100 students with capacity 40 creates 3 sections, with expected groups of 40, 40 and 20. Capacity remains 40 for each section.
3. Choose available days, daily start/end, suitable rooms and a teacher weekly minute limit (default 1,080 minutes / 18 hours).
4. Choose matching course subjects and general subjects. Review their weekly meeting counts and minutes per meeting. The editable suggestion is 3 × 60 minutes; lecture/lab units are shown for reference. The application does not infer institutional lab contact-hour rules from credits.
5. Preview. The system automatically picks current approved teachers and creates meeting times and room allocations. The preview creates no sections, student enrollments or notifications. It expires in 30 minutes.
6. Save drafts. Availability and eligibility are checked again. A changed plan requires a fresh preview. Saving all sections, subjects and meetings is transactional; retrying the same confirmation returns the original section IDs.
7. Review/edit the drafts using existing section controls, submit them, then let the registrar approve them. A course department chair submits the drafts, including drafts created for the department by a registrar or administrator. Drafts are inactive and unavailable for enrollment. Registrar review checks all weekly meetings for teacher, section and room conflicts within the same term, and rechecks teacher eligibility for generated sections.

Generation adds the requested number of **new** sections. It does not top up existing capacity or enroll students. Names use the course acronym (or name), year and an available numeric suffix in the selected term.

## Scheduling rules

- The subject must be active, college level, general (empty course) or connected to the selected course. A specified year/semester must match; an unspecified year/semester is applicable across those values.
- A teacher must have a current approved eligibility record for the subject's current active managing department. Approvals can come from course or general subject departments. Pending/rejected/revoked/stale approvals are excluded.
- Each subject in a section uses one teacher and meets on distinct selected days, once per day. Durations are 15–240 minutes in multiples of 15. Starts advance in 15-minute steps from the configured daily start.
- Candidates are ordered by existing plus newly planned weekly teaching minutes, then teacher ID. Subjects with fewer eligible teachers are placed first. This is a bounded greedy planner; failure means it did not find a complete plan with the supplied choices, not proof that no possible timetable exists.
- Existing assignments in the same school year and semester reserve teachers and rooms, including drafts, pending and rejected sections. Closed sections and other terms do not reserve times. Primary and additional meeting rows are combined and duplicates removed. Legacy MWF/TTH and AM/PM schedules are understood. Unknown day formats conservatively reserve every day. Incomplete relevant schedules require correction.
- Teacher loads include existing and proposed weekly meeting minutes, with duplicate primary/additional meetings counted once. There is no override that assigns an unapproved teacher or exceeds the supplied limit.
- The selected rooms must have suitable capacity and equipment. The repository has no room inventory, room capacity/equipment rules, teacher personal availability or institutional holiday/break calendar. Supply only suitable rooms and teaching windows; verify the preview against institutional rules. A single daily window cannot represent a lunch break.
- Limits: 20 sections, 40 subjects, 20 rooms and 1,000 meetings per batch, plus a bounded search budget. Use smaller batches if needed.

Generator confirmations are serialized across departments sharing rooms/teachers. Existing manual edit paths remain available and can change schedules after preview or saving, so review validates the current timetable again. The generator does not promise an optimal timetable or freeze manual assignments.

## API and deployment

Run `php artisan migrate` before using generation. The migration adds persisted previews and a database mutex for generator confirmations.

Authenticated endpoints:

- `GET /api/section-generation/options` — courses; optional `course_id`, `year_level`, `semester` selects applicable subjects.
- `POST /api/section-generation/preview` — returns `batch_id` and the proposed `plan`.
- `POST /api/section-generation` with `{ "batch_id": "..." }` — saves drafts, returns `section_ids`. Only the preview's creator can confirm it. Subsequent confirmations are idempotent.

Preview input:

```json
{
  "course_id": 1,
  "year_level": "1",
  "school_year": "2026-2027",
  "semester": "1st",
  "expected_students": 100,
  "max_students": 40,
  "days": ["Monday", "Wednesday", "Friday"],
  "time_start": "08:00",
  "time_end": "17:00",
  "rooms": ["Room 101", "Room 102"],
  "max_teacher_minutes": 1080,
  "subjects": [{ "subject_id": 1, "meetings": 3, "minutes": 60 }]
}
```

Expired preview records are retained for audit/history; expiry prevents new saves. Successful records retain the original input, proposal and created section IDs.

## Verification

Use a disposable MariaDB/MySQL database (existing migrations contain MySQL-specific syntax):

```sh
php artisan test --filter='SectionGenerationTest|DepartmentTypeTest|TeachingEligibilityTest'
```
