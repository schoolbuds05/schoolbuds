# Teaching eligibility

## Setup and use

Run `php artisan migrate` after deploying this change. Existing subjects start with no managing department; no ownership or teacher qualification is inferred from course names or existing class assignments.

1. Admin or registrar opens **Subject Departments** and assigns each subject to its managing department. Create departments and assign their chairs using the existing Department management screen first.
2. Teachers open **Teaching Subjects** (mobile: More → Teaching subjects), select a subject and describe their qualifications or teaching experience.
3. The subject department's assigned chair opens **Teaching Approvals** (mobile: Academic Overview → Teaching approvals). The chair approves or rejects requests, or chooses a teacher and grants eligibility directly with a basis for approval.
4. Approved eligibility can be revoked with a reason. Rejected or revoked requests can be resubmitted. Pending and approved duplicates are rejected.

General subjects keep an empty course/strand. Their managing department is independent of which courses can take them. Teachers may request subjects managed by another department; review belongs to the subject's department. A chair cannot approve their own eligibility. A direct grant may also resolve a pending request.

The chair must have the `head_department` position, belong to the active managing department, and be its configured `chair_user_id`. Rejection, direct grants, and revocation require remarks. Changes are recorded through the existing model activity audit.

Changing a subject's managing department revokes pending/approved eligibility. It requires a new request or direct grant by the new department. Existing class assignments are not changed by these records.

## Integration

Web and mobile use the same controller and workflow service. API routes require Sanctum authentication; authorization is enforced by the controller/service for each operation, including chair position checks for faculty accounts.

| Method | API path | Access |
| --- | --- | --- |
| GET | `/api/teaching-eligibility/mine` | Faculty: own records and requestable subjects |
| POST | `/api/teaching-eligibility/requests` | Faculty: `subject_id`, `qualification` |
| GET | `/api/teaching-eligibility/department` | Subject department chair: department records, subjects, teacher choices |
| POST | `/api/teaching-eligibility/grants` | Chair: `subject_id`, `teacher_id`, `remarks` |
| POST | `/api/teaching-eligibility/{id}/review` | Chair: `decision` (`approve`/`reject`), `remarks` |
| POST | `/api/teaching-eligibility/{id}/revoke` | Chair: `remarks` |
| GET | `/api/teaching-eligibility/subject-departments` | Admin/registrar: subject ownership and department choices |
| PUT | `/api/teaching-eligibility/subject-departments/{subject}` | Admin/registrar: nullable `department_id` |

List responses include paginated `rows` (25 per page). Use the `page` query parameter. Mutations return `message` and `data`.

`TeacherSubjectEligibility::eligible()` selects current approvals for active subjects and managing departments whose teacher is still faculty. The automatic section generator uses this scope by `subject_id`, then applies schedule conflict and weekly workload rules. Eligibility is persistent qualification approval, not a semester-specific class assignment or a preference ranking.

Department types are described in [Department types](department-types.md). Automatic section/schedule generation is described in [Section generation](section-generation.md). Existing manual teacher selection remains available.

## Verification

Use MySQL/MariaDB for feature tests; existing application migrations include MySQL-specific statements. Run against a dedicated disposable test database:

```bash
php artisan test --filter='TeachingEligibilityTest|DepartmentTeacherAssignmentTest|RegistrarSectionSubjectAssignmentTest|TeacherCurrentClassesTest'
```

Set test database connection variables in the environment to override phpunit.xml's SQLite defaults. Never point feature tests at a database containing real data.

## Automatic scheduling

[Section generation](section-generation.md) now uses current approved eligibility to choose teachers automatically for generated drafts. Registrar approval rechecks generated teacher eligibility. Existing manual assignment controls retain their current behavior.
