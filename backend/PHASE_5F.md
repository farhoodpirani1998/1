# Phase 5F: Student Assessment & Report Cards

## Overview

Phase 5F adds a real academic-assessment module: two new tables
(`subjects`, `student_assessments`), a small write-and-read API for staff
to record subject scores, a read-only view for parents, a report-card
endpoint that groups and averages scores by term, and a populated
`assessments` section on the Phase 5D student profile (previously an
empty `grades` placeholder — renamed to avoid colliding with
`modules/grades`, which represents academic *grade levels*, not scores).

## Why Not `modules/grades`?

`modules/grades` already owns the word "grade" for an academic grade
*level* (e.g. "پایه هفتم" — "7th grade"). Recording a *score* is a
different concept entirely. To keep the two unambiguous, this phase:

- Names its entity `Assessment` (table `student_assessments`), never
  `Grade`/`GradeRecord`.
- Names the new reference list `Subject` (table `subjects`), separate
  from `Grade`.
- Renames the student profile's placeholder field from `grades` to
  `assessments`.

Nothing in `modules/grades` is touched.

## Architecture & Design Principles

### 1. One Row Per Student/Subject/Year/Term, Upsert Not Duplicate

`student_assessments` has a unique index on
`(student_id, subject_id, academic_year_id, term)`. Resubmitting a score
for the same student, subject, and term (e.g. a correction after a
regrade) updates the existing row instead of erroring or creating a
second one — the same "resubmitting corrects" shape `attendance` already
uses for `(student_id, date)`.

### 2. academicYearId Is Derived, Never Client-Supplied

`AssessmentsService.record()` copies `academicYearId` from the student's
own current record at the moment of recording, the same way
`AttendanceService.record()` does. A client can never send an
`academicYearId` that doesn't match the student it's attached to.

### 3. Scores Are Normalized for Averaging, Not Assumed to Share a Scale

Each assessment stores both `score` and `maxScore` (default 20, the
standard Iranian school scale), so a subject scored out of 100 (e.g. a
project) can coexist with subjects scored out of 20. The report-card
builder (`buildReportCard`) rescales every score to "out of 20"
(`score / maxScore * 20`) before averaging, so mixed scales don't skew the
result.

### 4. Tenant Isolation & Authorization — Same Patterns as Everywhere Else

- `POST /assessments` — `@Roles('school_admin', 'staff')`, the same pair
  as `POST /attendance`. The referenced student and subject are each
  fetched by id and their `schoolId` compared to the caller's —
  `NotFound` if either doesn't exist, `Forbidden` if either belongs to
  another school.
- `GET /assessments/student/:id` and `.../report-card` —
  `@Roles('school_admin', 'accountant', 'staff')`, the same three roles as
  `GET /attendance/student/:id`. A wrong-tenant student id 404s via a
  single schoolId-scoped query.
- `GET /parent/students/:id/assessments` and `.../report-card` —
  `@Roles('parent')`, and only for a student the caller is linked to via
  `parent_students` (404 otherwise, never 403 — same rule as every other
  `/parent/students/:id/*` route).
- `POST /subjects` — `@Roles('school_admin')`; `GET /subjects` /
  `GET /subjects/:id` — `@Roles('school_admin', 'accountant', 'staff')`.
  Same shape as `modules/grades`.

### 5. No New Module Cycles

`StudentAssessmentsModule` is imported by both `ParentModule` (for the two
parent-facing routes) and `StudentProfileModule` (for the profile's
assessments section), but does not import either back — it declares its
own narrow TypeORM repositories for `Student` and `ParentStudent`, the
same shape `AttendanceModule` already uses for the same reason.

### 6. Response Shaping

Staff-facing responses go through `toAssessmentView()`; parent-facing
responses go through the narrower `toParentAssessmentView()` (no
`recordedById`, no `schoolId`, no `studentId`) — same pattern as
`toAttendanceView()` / `toParentAttendanceView()`.

## API

### POST `/subjects`

**Access:** `school_admin`.

```json
{ "title": "ریاضی" }
```

### GET `/subjects`, `GET /subjects/:id`

**Access:** `school_admin`, `accountant`, `staff`.

### POST `/assessments`

**Access:** `school_admin`, `staff`.

```json
{
  "studentId": "uuid",
  "subjectId": "uuid",
  "term": "first_term",
  "score": 18.5,
  "maxScore": 20,
  "note": "optional"
}
```

`term` is one of `first_term`, `second_term`. `maxScore` defaults to 20
when omitted; `score` must not exceed it. Resubmitting the same
`studentId` + `subjectId` + `term` updates the existing record.

### GET `/assessments/student/:id`

**Access:** `school_admin`, `accountant`, `staff`. Full assessment history
for one student, most recently recorded first.

### GET `/assessments/student/:id/report-card`

**Access:** `school_admin`, `accountant`, `staff`.

```json
{
  "studentId": "uuid",
  "academicYearId": "uuid",
  "terms": [
    {
      "term": "first_term",
      "subjects": [
        { "subjectId": "uuid", "subjectTitle": "ریاضی", "score": 18, "maxScore": 20 }
      ],
      "average": 17
    }
  ],
  "overallAverage": 18
}
```

`average`/`overallAverage` are `null` (not `0`) when there's nothing to
average yet.

### GET `/parent/students/:id/assessments`

**Access:** `parent`, own linked children only.

```json
[{ "id": "uuid", "subjectId": "uuid", "subjectTitle": "ریاضی", "term": "first_term", "score": 18, "maxScore": 20, "note": null }]
```

### GET `/parent/students/:id/report-card`

**Access:** `parent`, own linked children only. Same shape as the
staff-side report card above.

## Student Profile Update

`GET /students/:id/profile` and `GET /parent/students/:id/profile` now
return a populated `assessments` section instead of the Phase 5D `grades`
placeholder:

```json
"assessments": {
  "available": true,
  "records": [
    { "id": "uuid", "subjectId": "uuid", "subjectTitle": "ریاضی", "term": "first_term", "score": 18, "maxScore": 20, "note": null }
  ],
  "reportSummary": { "studentId": "uuid", "academicYearId": "uuid", "terms": [...], "overallAverage": 18 }
}
```

`records` is capped at the 10 most recently recorded assessments;
`reportSummary` is built from the student's *entire* assessment history
so its average is correct even when `records` is truncated. `documents`
and `announcements` remain empty placeholders for their own future
phases.

## Tests

`test/student-assessments.e2e-spec.ts` covers: recording a score and its
upsert-on-resubmit behavior, DTO validation (unknown term enum, score
above maxScore, negative score, missing `studentId`, unknown field), role
gates on all endpoints (including `/subjects`), tenant isolation on the
staff-side reads and writes, report-card term grouping and averaging
(including the empty-report-card case), the parent "linked child only"
rule (unlinked and cross-school both 404) on both parent routes, and the
student profile's assessments section going from empty to populated once
assessments exist.

`test/student-profile.e2e-spec.ts` was updated to reflect the renamed
`assessments` field and the fact that `attendance`/`assessments` are now
real (available, just empty in that suite's fixtures) rather than
placeholder-empty like `documents`/`announcements`.
