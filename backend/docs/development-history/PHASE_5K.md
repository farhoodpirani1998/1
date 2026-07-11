# Phase 5K: Timetable Foundation

## Overview

Phase 5K adds a weekly class schedule: `school_admin` schedules a
(grade, subject, teacher) period on a weekday with a time range, and
teachers/parents get their own read-only view of it. No existing module
was rewritten — auth, roles, tenant isolation, tuition, payments,
attendance, assessments, announcements, student documents, and the
teacher/parent portals all work exactly as they did in Phase 5J; this
phase only adds one new table (`timetable_entries`), one new
`modules/timetable`, and one read-only route each on the existing
`TeacherController` / `ParentController`. No calendar UI, no
date-specific events, no recurrence rules beyond "this weekday, every
week" — out of scope per the phase brief.

## Reusing Teacher Assignment Validation

A period can only be scheduled for a teacher who already holds a
`TeacherAssignment` for the exact `(gradeId, subjectId)` pair being
scheduled — `TimetableService` queries the same `teacher_assignments`
table `TeacherService.recordAssessment()` already checks against, rather
than inventing a second notion of "who's allowed to teach what". A
`school_admin` must assign a teacher to a grade+subject (Phase 5G's
`POST /teacher/assignments`) before that teacher can be scheduled for it.

## Overlap Prevention

Two rules, enforced in `TimetableService` before every insert/update:

1. **Same teacher, same weekday, overlapping time range** — a teacher
   can't be in two places at once.
2. **Same grade, same weekday, overlapping time range** — a class can't
   have two different periods running simultaneously.

Both are scoped to `(schoolId, academicYearId, weekday)` — a school only
ever runs one academic year's timetable at a time, so entries from a
past/future year can never actually collide in real time with the one
being created. Two ranges `[s1,e1)` and `[s2,e2)` are considered
overlapping iff `s1 < e2 AND s2 < e1`; back-to-back periods (one's
`endTime` equal to the next's `startTime`) are explicitly allowed. This
is enforced in the service, not a Postgres `EXCLUDE` constraint — an
exclusion constraint would need the `btree_gist` extension enabled,
which is a bigger infrastructure step than this phase's minimal-change
mandate calls for. The migration does add a plain `CHECK` constraint
(`start_time < end_time`) as a second line of defense, the same
belt-and-suspenders shape already used elsewhere in this schema.

`PUT /timetable/:id` merges whichever fields the caller provides onto
the existing row, then re-runs the exact same relation, assignment, and
overlap checks `create()` runs against the merged result — excluding the
row's own id from the overlap scan — so a partial update can never land
in a state `create()` would have rejected outright, and updating a row
without moving it never conflicts with its own previous state.

## Tenant Isolation & Authorization

- `POST /timetable`, `GET /timetable`, `PUT /timetable/:id`,
  `DELETE /timetable/:id` — `@Roles('school_admin')`. Every referenced id
  (`academicYearId`, `gradeId`, `subjectId`, `teacherId`) is fetched by id
  alone, then its `schoolId` compared to the caller's — `NotFound` if it
  doesn't exist at all, `Forbidden` if it exists but belongs to another
  school, same shape as `TeacherService.assign()`. `teacherId` must also
  reference a user whose `role` is `teacher`, or a `BadRequest` is raised.
  `PUT`/`DELETE` fetch by `(id, schoolId)` together, so a wrong-tenant id
  `404`s exactly like a nonexistent one.
- `GET /teacher/timetable` — `@Roles('teacher')`, added to the existing
  `TeacherController`. Calls `TimetableService.findForTeacher(teacherId,
  schoolId)` — always the caller's own id and school, never taken from
  the request.
- `GET /parent/students/:id/timetable` — `@Roles('parent')`, added to the
  existing `ParentController`. Same "linked child only" rule as every
  other `/parent/students/:id/*` route — checks the `parent_students`
  link before returning anything, so an unlinked or cross-school id
  `404`s the same way `findMyStudent()` does. Returns the *grade's*
  timetable (a student doesn't have a schedule of their own — they attend
  whatever's scheduled for their grade).
- No pre-existing staff-facing route was touched, and neither `teacher`
  nor `parent` gained access to anything outside their own new read
  route.

## No New Module Cycles

`TimetableModule` exports `TimetableService` and is imported by both
`TeacherModule` and `ParentModule` — a one-way import, same shape
`AnnouncementsModule` / `StudentDocumentsModule` already have from those
two modules. `TimetableModule` itself declares its own narrow TypeORM
repositories for `AcademicYear`, `Grade`, `Subject`, `User`, `Student`,
`ParentStudent`, and `TeacherAssignment` rather than importing their
owning modules — the same "declare narrow repos instead of importing the
owning module back" choice `TeacherModule` itself already made for
`Grade`/`Subject`, and `StudentDocumentsModule`/`StudentAssessmentsModule`
already make for `Student`/`ParentStudent`.

## API

### POST `/timetable`

**Access:** `school_admin`.

```json
{
  "academicYearId": "uuid",
  "gradeId": "uuid",
  "subjectId": "uuid",
  "teacherId": "uuid",
  "weekday": 0,
  "startTime": "08:00",
  "endTime": "09:00",
  "room": "Room 101"
}
```

`weekday` is `0`–`6` (Saturday–Friday). `startTime`/`endTime` are
`HH:MM` 24-hour strings; `room` is optional.

### GET `/timetable`

**Access:** `school_admin`. Optional `?gradeId=` / `?teacherId=` /
`?academicYearId=` filters. Every entry in the caller's own school,
ordered by weekday then start time.

### PUT `/timetable/:id`

**Access:** `school_admin`. Every field optional; only the given fields
are changed.

### DELETE `/timetable/:id`

**Access:** `school_admin`. `404` on a nonexistent or another school's
id.

### GET `/teacher/timetable`

**Access:** `teacher`. Every scheduled period for the caller, within
their own school.

### GET `/parent/students/:id/timetable`

**Access:** `parent`. The linked child's grade timetable. `404` if the
student doesn't exist, belongs to another school, or isn't linked to the
caller.

## Tests

`test/timetable.e2e-spec.ts` covers: `school_admin` create/list/update/
delete and the role gate rejecting every other role on all four routes;
relation validation (`404` on a nonexistent id, `403` on a cross-school
id, `400` on a non-teacher `teacherId`, `403` on a teacher with no
matching `TeacherAssignment`); DTO validation (malformed time strings,
`startTime >= endTime`, an invalid `weekday`); overlap rejection (`409`)
for the same teacher and for the same grade, back-to-back periods being
allowed, the same time range on a different weekday being allowed, and
an update not conflicting with the row's own previous state;
`GET`/`PUT`/`DELETE` never leaking or acting on another school's rows
(`404`, not `403`); and `GET /teacher/timetable` /
`GET /parent/students/:id/timetable` each returning only the caller's
own scope with the role gate rejecting every other role.
