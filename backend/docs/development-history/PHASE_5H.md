# Phase 5H: School Announcements

## Overview

Phase 5H adds a school-wide announcement board. A `school_admin` posts an
announcement aimed at one audience (`all`, `parents`, `teachers`, or
`staff`), and every user in that school who belongs to that audience can
read it. No existing module was rewritten — auth, roles, tenant
isolation, tuition, payments, attendance, assessments, and the teacher /
parent portals all work exactly as they did in Phase 5G; this phase only
adds one new table (`announcements`), one new `modules/announcements`,
and one read-only route each on the existing `TeacherController` /
`ParentController`.

## Why One Table, Not Per-Audience Tables

An announcement is a single row with a `target_type` column, not four
separate tables — the read side only ever needs "give me every row aimed
at `all` or my own audience", which is one indexed `IN (...)` filter
(`AnnouncementsService.findForAudience`), same shape a per-audience-table
split would need to fan out across anyway. Unlike `attendance` /
`student_assessments`, there's no upsert key: an announcement is a
one-shot post (create or delete, never "correct in place"), so no unique
index beyond the primary key was needed.

## Tenant Isolation & Authorization

- `POST /announcements`, `GET /announcements`,
  `DELETE /announcements/:id` — `@Roles('school_admin')`. `schoolId` and
  `createdById` are always derived from the caller's own JWT
  (`AnnouncementsService.create`), never accepted from the request body.
  `GET /announcements` only ever returns the caller's own school's rows.
  `DELETE /announcements/:id` fetches by `(id, schoolId)` together, so a
  wrong-tenant id `404`s exactly like a nonexistent one — same
  "can't tell doesn't-exist from isn't-yours" shape as
  `AssessmentsService`'s student lookups.
- `GET /teacher/announcements` — `@Roles('teacher')`, added to the
  existing `TeacherController`. Calls
  `AnnouncementsService.findForAudience(schoolId, TEACHERS)` — the
  audience is hardcoded in the controller, never taken from the request,
  so a teacher can't widen their own view. Only `all`/`teachers` rows
  from the caller's own school are ever returned.
- `GET /parent/announcements` — `@Roles('parent')`, added to the existing
  `ParentController`. Same shape as the teacher route, hardcoded to
  `PARENTS`. Not scoped to one linked child (unlike
  `/parent/students/:id/*`) — a school's announcements are the same for
  every child a parent has there.
- No pre-existing staff-facing route (`/students`, `/attendance`,
  `/assessments`, etc.) was touched, and neither `teacher` nor `parent`
  gained access to anything outside their own new read route.

## No New Module Cycles

`AnnouncementsModule` exports `AnnouncementsService` and is imported by
both `TeacherModule` and `ParentModule` — a one-way import, same shape
`AttendanceModule` / `StudentAssessmentsModule` already have from those
two modules. `AnnouncementsModule` itself imports nothing from either, so
no cycle is introduced. `TeacherController` / `ParentController` inject
`AnnouncementsService` directly for their read route, the same
"dedicated portal controller reads a shared service directly" pattern
already used for `AttendanceService` / `AssessmentsService` in
`ParentController`, rather than adding an announcements pass-through
method to `TeacherService` / `ParentService`.

## API

### POST `/announcements`

**Access:** `school_admin`.

```json
{ "title": "Holiday Notice", "message": "School will be closed Monday.", "targetType": "all" }
```

`targetType` is one of `all` / `parents` / `teachers` / `staff`.

### GET `/announcements`

**Access:** `school_admin`. Every announcement in the caller's own
school, most recent first.

### DELETE `/announcements/:id`

**Access:** `school_admin`. `404` on a nonexistent or another school's
id.

### GET `/teacher/announcements`

**Access:** `teacher`. Announcements targeted at `all` or `teachers`,
from the caller's own school.

### GET `/parent/announcements`

**Access:** `parent`. Announcements targeted at `all` or `parents`, from
the caller's own school.

## Tests

`test/announcements.e2e-spec.ts` covers: `school_admin` create/list/delete
and the role gate rejecting every other role on all three routes; DTO
validation (missing/blank title or message, invalid `targetType`,
over-length title, unknown extra fields); `GET /announcements` and
`DELETE /announcements/:id` never leaking or accepting another school's
rows (`404`, not `403`); `GET /teacher/announcements` and
`GET /parent/announcements` each returning only `all` + their own
audience, scoped to the caller's own school, with the role gate rejecting
every other role.
