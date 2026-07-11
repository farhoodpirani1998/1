# Phase 5E: Attendance System

## Overview

Phase 5E adds a real attendance module: a new `attendance` table (one row
per student per calendar day), a small CRUD-and-read API for staff, a
read-only view for parents, and a populated `attendance` section on the
Phase 5D student profile (previously an empty placeholder).

## Architecture & Design Principles

### 1. One Row Per Student Per Day, Upsert Not Duplicate

`attendance` has a unique index on `(student_id, date)`. Marking the same
student on the same day twice (e.g. a correction — "actually they arrived
late, not absent") updates the existing row instead of erroring or
creating a second one. This mirrors the "resubmitting corrects" shape
already used by `GuardiansService.findOrCreate()` and `ParentService.link()`.

### 2. academicYearId Is Derived, Never Client-Supplied

`AttendanceService.record()` copies `academicYearId` from the student's
own current record at the moment of marking, the same way the student
entity itself is scoped to one academic year. A client can never send an
`academicYearId` that doesn't match the student it's attached to, because
it's never asked for one.

### 3. Tenant Isolation & Authorization — Same Patterns as Everywhere Else

- `POST /attendance` — `@Roles('school_admin', 'staff')`, the same pair as
  `POST /students` / `PATCH /students/:id`. The referenced student is
  fetched by id and its `schoolId` compared to the caller's — `NotFound`
  if it doesn't exist, `Forbidden` if it belongs to another school, same
  shape as `StudentsService.create()`'s guardianId/academicYearId/gradeId
  checks.
- `GET /attendance/student/:id` and `GET /attendance/date/:date` —
  `@Roles('school_admin', 'accountant', 'staff')`, the same three roles as
  `GET /students/:id`. A wrong-tenant student id 404s via a single
  schoolId-scoped query, the same shape as `StudentsService.findOne()`.
- `GET /parent/students/:id/attendance` — `@Roles('parent')`, and only for
  a student the caller is linked to via `parent_students` (404 otherwise,
  never 403 — same "can't tell doesn't-exist from isn't-yours" rule as
  every other `/parent/students/:id/*` route).

### 4. No New Module Cycles

`AttendanceModule` is imported by both `ParentModule` (for
`GET /parent/students/:id/attendance`) and `StudentProfileModule` (for the
profile's attendance section), but does not import either back — it
declares its own narrow TypeORM repositories for `Student` and
`ParentStudent`, the same shape `StudentProfileModule` already uses for
the same reason.

### 5. Response Shaping

Staff-facing responses go through `toAttendanceView()`; parent-facing
responses go through the narrower `toParentAttendanceView()` (no
`recordedById`, no `schoolId`, no `studentId`) — same "reshape, don't leak
the ORM entity" pattern as `toParentPaymentView` / `toParentStudentView`.

## API

### POST `/attendance`

**Access:** `school_admin`, `staff`.

```json
{ "studentId": "uuid", "date": "2026-07-05", "status": "present", "note": "optional" }
```

`status` is one of `present`, `absent`, `late`, `excused`. Resubmitting the
same `studentId` + `date` updates the existing record.

### GET `/attendance/student/:id`

**Access:** `school_admin`, `accountant`, `staff`. Full history for one
student, most recent day first.

### GET `/attendance/date/:date`

**Access:** `school_admin`, `accountant`, `staff`. Every record for the
caller's school on one calendar day (`date` as `YYYY-MM-DD`), optionally
narrowed with `?gradeId=` and/or `?academicYearId=`.

### GET `/parent/students/:id/attendance`

**Access:** `parent`, own linked children only.

```json
[{ "id": "uuid", "date": "2026-07-01", "status": "late", "note": "Bus was delayed" }]
```

## Student Profile Update

`GET /students/:id/profile` and `GET /parent/students/:id/profile` now
return a populated `attendance` section instead of the Phase 5D
placeholder:

```json
"attendance": {
  "available": true,
  "records": [
    { "id": "uuid", "date": "2026-07-01", "status": "present", "note": null }
  ]
}
```

`records` is capped at the 10 most recent days. `grades`, `documents`, and
`announcements` remain empty placeholders for their own future phases.

## Tests

`test/attendance.e2e-spec.ts` covers: recording attendance and its
upsert-on-resubmit behavior, DTO validation (bad enum, malformed date,
missing `studentId`, unknown field), role gates on all four endpoints,
tenant isolation on the staff-side reads, the parent "linked child only"
rule (unlinked and cross-school both 404), and the student profile's
attendance section going from empty to populated once records exist.
