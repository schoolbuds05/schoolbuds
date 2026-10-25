# Department types

Run `php artisan migrate` to add the department type field. Existing departments default to `course`, preserving their ability to manage programs and sections. Administrators choose the type in **Admin → Department**, when creating or editing a department.

| Type | Programs and sections | Subjects and faculty |
| --- | --- | --- |
| Course department (`course`), e.g. Computing | Can own programs; its chair can create and manage department sections | Can manage subjects and teacher eligibility |
| General subject department (`general`), e.g. Mathematics | Cannot own programs or sections; its chair cannot use section management | Owns selected subjects and faculty; its chair approves subject teaching eligibility |

The type is independent of subject course applicability. A general Mathematics subject can belong to the Mathematics department and still be offered to every course. No subject ownership is inferred from its name. Use **Subject Departments** to assign the selected subjects; the department detail panel lists them and links to the ownership screen.

General subject department chairs retain Teaching Approvals and Teacher List. Section navigation is hidden in the web and mobile leadership portals. Server authorization also blocks direct requests to web and API section creation, update, submission, subject/student assignment and deletion endpoints. Course department chairs can manage only their own department sections, and college sections must use a course assigned to their department. API updates cannot bypass the draft/review workflow by submitting approval or department fields.

Admin and registrar section authority remains available. Section operations performed by chairs require an active course department. The mobile leadership dashboard exposes `department_type` and `can_manage_sections` so navigation reflects server permissions. Actual teacher eligibility decisions remain with the subject's managing department, for both types.

## Changing type

A department with assigned courses or sections cannot become a general subject department. Reassign those records first; the system returns a validation error without deleting or detaching them. Subjects and teachers do not block the conversion. A general department can become a course department and then receive programs. Omitting `type` in an existing department form preserves its type; older department creation requests default to `course`.

These changes add department types and permissions. Automatic section creation, automatic timetable generation, and automatic teacher assignment are separate features.

## Verification

Use a disposable MySQL/MariaDB test database because earlier repository migrations contain MySQL-specific syntax:

```bash
php artisan test --filter='DepartmentTypeTest|TeachingEligibilityTest|DepartmentTeacherAssignmentTest|RegistrarSectionSubjectAssignmentTest|TeacherCurrentClassesTest'
```
