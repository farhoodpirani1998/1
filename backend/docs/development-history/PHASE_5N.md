# Phase 5N: Global Search

## Overview

Phase 5N adds a single cross-entity search endpoint, `GET /search`, for
school_admin/accountant/staff. No existing module was rewritten — auth,
roles, tenant isolation, students, parents/guardians, teachers,
subjects, homework, and announcements all work exactly as they did in
Phase 5M; this phase only adds one new, self-contained
`modules/search` and one new line in `AppModule`'s imports array.

## What It Searches

A single free-text term (`q`) is matched case-insensitively and
partially (`ILIKE '%term%'`) against six existing entities, each scoped
to the caller's own school:

| Category        | Entity        | Matched columns          |
|------------------|---------------|---------------------------|
| `students`       | `Student`     | `fullName`, `nationalId`  |
| `parents`        | `Guardian`    | `fullName`, `phone`       |
| `teachers`       | `User` (role = `teacher`) | `fullName`, `phone` |
| `subjects`       | `Subject`     | `title`                   |
| `homework`       | `Homework`    | `title`, `description`    |
| `announcements`  | `Announcement`| `title`, `message`        |

"Parents" maps to `Guardian` (the per-school contact record every
`Student` links to via `guardianId`) rather than a `role = 'parent'`
`User` row — a school_admin/accountant/staff searching for "a parent"
means the guardian on file for a student, not a parent-portal login
account.

## Design Choices

- **No new business logic.** Every query is a plain, tenant-scoped
  `ILIKE` lookup using TypeORM's query builder — the same pattern
  `StudentsService.findWithFilters()` already uses for its own `search`
  filter. No creation, update, assignment-checking, or linking logic is
  duplicated; those all stay exactly where they already live
  (`HomeworkService`, `TeacherService`, `ParentService`, etc.).
- **Own narrow repos, no cross-module import.** `SearchModule` declares
  `TypeOrmModule.forFeature([...])` for the six entities it reads,
  rather than importing `StudentsModule`/`UsersModule`/`HomeworkModule`/
  `AnnouncementsModule`/`StudentAssessmentsModule` — the same "own
  narrow repos instead of a cross-module import" shape `HomeworkModule`/
  `TimetableModule`/`StudentDocumentsModule` already use to avoid an
  unnecessary dependency for what is, on each side, a single read query.
- **Simple, optimized SQL — not full-text search.** No Elasticsearch, no
  Postgres `tsvector`/`GIN` index, no ranking. Six independent, cheap,
  indexable-by-schoolId `ILIKE` queries run in parallel
  (`Promise.all`), each capped by `limit`.
- **Per-category limit, not a combined one.** `limit` (default 10, max
  50) caps how many rows come back *per category* — a caller asking for
  `limit=10` gets up to 10 students **and** up to 10 parents **and** so
  on, not 10 total split across six groups. This keeps the shape
  predictable regardless of how many categories a term happens to match.
- **Every group always present.** The response always has all six keys,
  each an array (empty when nothing matches) — never an omitted key —
  so callers can destructure without existence checks.
- **Blank term short-circuits.** A whitespace-only `q` (after `.trim()`)
  returns every group empty without running any query, rather than six
  "match everything" scans of the school's full data.

## Access Control

`@Roles('school_admin', 'accountant', 'staff')` on `GET /search` — the
same staff-only shape `HomeworkController`'s `GET /homework` and
`AnnouncementsController` already use. Never granted to `parent` or
`teacher`: both already have their own narrower, purpose-built read
surfaces (`/parent/*`, `/teacher/*`); a global cross-entity search over
the whole school is out of scope for either portal role.

## Files Added

- `src/modules/search/dto/query-search.dto.ts`
- `src/modules/search/dto/search-result-view.dto.ts`
- `src/modules/search/search.service.ts`
- `src/modules/search/search.controller.ts`
- `src/modules/search/search.module.ts`
- `test/search.e2e-spec.ts`

## Files Changed

- `src/app.module.ts` — one new import + one new entry in the `imports`
  array (`SearchModule`). No other module was touched.
