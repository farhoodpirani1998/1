# Phase 5G: Teacher Portal Foundation

## Overview

Phase 5G adds a fourth portal role — `teacher` — alongside the existing
`school_admin` / `accountant` / `staff` / `parent` roles. A teacher is a
login scoped to only the grade+subject combinations a `school_admin` has
explicitly assigned them (`TeacherAssignment`, table
`teacher_assignments`), and can only read or write within that scope: own
profile, own classes, own subjects, own students, and — reusing the
existing `AttendanceService` and `AssessmentsService` unchanged — take
attendance and record assessment scores for students in an assigned
class.

No existing module was rewritten. Auth, roles, tenant isolation, tuition,
payments, attendance, assessments, and notifications all work exactly as
they did in Phase 5F; this phase only adds a new role value, a new
assignment table, and a new `modules/teacher` that calls into
`AttendanceService` / `AssessmentsService` the same way `modules/parent`
already does.

## Why a Separate Assignment Table, Not a Column on `users`?

A teacher isn't scoped to one grade or one subject — they may teach
several subjects to the same grade, or the same subject across several
grades. A single `grade_id`/`subject_id` pair on `users` couldn't express
that, so `teacher_assignments` is a small join table: one row per
(teacher, grade, subject), same shape `parent_students` already uses for
the parent↔student many-to-many. A unique constraint on
`(teacher_id, grade_id, subject_id)` makes assigning idempotent — the
same triple twice is a no-op, not a duplicate row — same pattern as
`uq_parent_student`.

## Role Addition

`Role.TEACHER = 'teacher'` was added to `common/authorization/roles.enum.ts`
and given an empty entry in `permissions.ts`'s `ROLE_PERMISSIONS` map (same
as `PARENT` — teachers never need `@RequirePermission`, only `@Roles`, and
only on `/teacher/*`). `users.role` has always been a free-text
`VARCHAR(30)` with no CHECK constraint, so — same note as Phase 5A's
`parent` — no migration was needed for the column itself, and
`RegisterDto`'s `@IsIn(Object.values(Role))` picked up `teacher` for free.

## Attendance vs. Assessments: Different Scope Granularity

- **Attendance has no subject of its own** (see `Attendance` entity) — a
  teacher may take attendance for any student in **any grade they hold at
  least one assignment for**, regardless of which subject that assignment
  is for. This matches how attendance is recorded by every other role: per
  class, not per subject.
- **Assessments are per-subject** — a teacher must hold the **exact**
  `(grade, subject)` assignment matching both the student's current grade
  and the `subjectId` in the request body. Holding `(gradeA, mathSubject)`
  does not authorize recording a math score for a student in `gradeB`,
  even though the teacher does teach math somewhere.

Both checks live in `TeacherService` (`recordAttendance` /
`recordAssessment`), in front of an unmodified call into
`AttendanceService.record()` / `AssessmentsService.record()`. Every other
piece of business logic — upsert-on-resubmit, `academicYearId`
derivation, DTO validation (score vs. maxScore, date format, enum values)
— is entirely owned by those two services, unchanged from Phase 5E/5F.

## Tenant Isolation & Authorization

- `POST /teacher/assignments`, `GET /teacher/assignments`,
  `DELETE /teacher/assignments/:id` — `@Roles('school_admin')`. Each of
  `teacherId`/`gradeId`/`subjectId` is fetched by id alone, then its
  `schoolId` compared to the caller's — `NotFound` if it doesn't exist at
  all, `Forbidden` if it exists but belongs to another school (same shape
  as `ParentService.link()`). `teacherId` must also reference a user whose
  `role` is `teacher`, or a `BadRequest` is raised.
- `GET /teacher/profile`, `/teacher/classes`, `/teacher/subjects`,
  `/teacher/students` — `@Roles('teacher')`. Every read is derived from
  `TeacherAssignment` rows scoped to `(teacherId, schoolId)` from the
  caller's own JWT — never a school-wide view. A `gradeId` filter on
  `/teacher/students` that isn't one of the teacher's own assignments is
  rejected (`Forbidden`), never silently returning an empty list.
- `POST /teacher/attendance`, `POST /teacher/assessments` —
  `@Roles('teacher')`. Rejected (`Forbidden`) if the teacher holds no
  matching assignment; `NotFound` if the referenced student doesn't exist;
  every other validation delegated to the underlying service as described
  above.
- None of the pre-existing staff-facing routes (`/students`, `/grades`,
  `/attendance`, `/assessments`, `/subjects`, etc.) grant `teacher`
  anything — same as `parent` never being added to those `@Roles()` lists.

## No New Module Cycles

`TeacherModule` imports `AttendanceModule` and `StudentAssessmentsModule`
to reuse their services directly, and declares its own narrow TypeORM
repositories for `User`, `Student`, `Grade`, and `Subject` — the same
shape `AttendanceModule`/`StudentAssessmentsModule` already use for their
own student/parent-link reads, so no back-import or cycle is introduced.

## API

### POST `/teacher/assignments`

**Access:** `school_admin`.

```json
{ "teacherId": "uuid", "gradeId": "uuid", "subjectId": "uuid" }
```

### GET `/teacher/assignments`

**Access:** `school_admin`. Optional `?teacherId=` filter.

### DELETE `/teacher/assignments/:id`

**Access:** `school_admin`.

### GET `/teacher/profile`

**Access:** `teacher`. Own account plus assignment summary.

### GET `/teacher/classes`, `GET /teacher/subjects`

**Access:** `teacher`. Distinct grades / subjects across the caller's own
assignments.

### GET `/teacher/students`

**Access:** `teacher`. Every student in one of the teacher's assigned
grades; optional `?gradeId=` narrows to one (must be one of the teacher's
own assignments).

### POST `/teacher/attendance`

**Access:** `teacher`. Same body shape as `POST /attendance`
(`studentId`, `date`, `status`, optional `note`); delegates to
`AttendanceService.record()` after the grade-assignment check.

### POST `/teacher/assessments`

**Access:** `teacher`. Same body shape as `POST /assessments`
(`studentId`, `subjectId`, `term`, `score`, optional `maxScore`/`note`);
delegates to `AssessmentsService.record()` after the exact
grade+subject-assignment check.

## Tests

`test/teacher-portal.e2e-spec.ts` covers: assignment creation and its
idempotent-upsert behavior, tenant isolation and role gates on assignment
management, DTO validation on all three write endpoints, the teacher-only
role gate and per-teacher scoping on every `/teacher/*` read (including
the empty-list case for an unassigned teacher and the rejected
out-of-scope `gradeId` filter), attendance succeeding for any assigned
grade regardless of subject while assessments require the exact
grade+subject match, both writes correctly reusing
`AttendanceService`/`AssessmentsService`'s upsert-on-resubmit behavior and
validation, and confirmation that `teacher` is rejected on every
pre-existing staff-facing endpoint it was never granted.
