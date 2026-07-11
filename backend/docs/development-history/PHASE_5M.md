# Phase 5M: School Settings

## Overview

Phase 5M adds a per-school settings/profile record: branding
(name/logo/colors), contact info, localization (timezone/language/
currency), calendar defaults (week start/working days), and a handful of
operational defaults (passing score, attendance-late threshold, tuition
reminder lead time, sms/email toggles). No existing module was
rewritten — auth, roles, tenant isolation, tuition, payments,
attendance, assessments, announcements, student documents, timetable,
homework, and the teacher/parent portals all work exactly as they did
in Phase 5L; this phase only adds one new table (`school_settings`) and
one new `modules/school-settings`.

Wiring these settings into other modules' actual runtime behavior (e.g.
having `SmsProviderService` check `smsEnabled`, or `AssessmentsService`
enforce `passingScore`) is explicitly out of scope for this phase — this
is the data model and CRUD surface only, same "additive, minimal-change"
mandate every recent phase has followed.

## Exactly One Row Per School

`SchoolSettings.schoolId` is itself the table's primary key (and a
foreign key to `schools.id`) rather than a separate generated `id` with
a unique index on `school_id` — the same one-to-one relationship
`AcademicYear`/`Homework`/etc. express as a many-to-one column doesn't
apply here, since every school has *exactly* one settings row, never
zero-after-creation and never more than one. This makes "exactly one
settings record per school" a database guarantee, not just an
application-level convention.

Rows are created lazily — the first time a school's `school_admin` calls
`GET /settings` or `PUT /settings` and no row exists yet,
`SchoolSettingsService.findOrCreate()` inserts one, seeded from the
school's own `name`/`address`/`phone` where available and sensible
defaults everywhere else (see below). There is no separate "create"
endpoint and no migration-time backfill — a school created before this
migration and one created after it both get their settings row the same
way, on first access.

### Race Safety

Two concurrent first-requests for the same school (e.g. two admin tabs
both loading a settings page) both trying to insert the default row
race on the table's primary key (`school_id`) — the loser hits a
Postgres unique-violation (`23505`), and
`SchoolSettingsService.createDefault()` catches exactly that and re-reads
the row the winner already inserted, rather than erroring out. Same
"let the DB be the source of truth for the race, re-read on conflict"
shape already documented for `AcademicYear.isCurrent`.

## Defaults

| Field | Default |
|---|---|
| `schoolName` | the school's own `name` |
| `address` / `phone` | the school's own `address`/`phone` (`null` if unset) |
| `logoUrl`, `email`, `website`, `primaryColor`, `secondaryColor` | `null` |
| `timezone` | `Asia/Tehran` |
| `language` | `fa` |
| `currency` | `IRR` |
| `weekStartsOn` | `0` (Saturday — reuses `Weekday` from `modules/timetable`) |
| `workingDays` | `[0,1,2,3,4]` (Saturday–Wednesday) |
| `passingScore` | `10` (out of the standard 20-point scale — see `Assessment.maxScore`) |
| `attendanceLateMinutes` | `15` |
| `tuitionReminderDays` | `7` |
| `smsEnabled` | `true` |
| `emailEnabled` | `false` |

## Reusing `Weekday`

`weekStartsOn` and `workingDays` reuse the existing `Weekday` enum from
`modules/timetable/entities/timetable-entry.entity.ts` (the Saturday-first
Iranian school week already used by `TimetableEntry.weekday`) rather than
inventing a second weekday representation — one closed, numeric,
`0`(Saturday)–`6`(Friday) enum for "which day of the week" anywhere in
this schema.

## Access

- `GET /settings` — `@Roles('school_admin')`. Returns the caller's own
  school's settings, auto-creating the default row first if none exists.
- `PUT /settings` — `@Roles('school_admin')`. Partial update; only the
  fields present in the body are changed, everything else keeps its
  current value. Creates the default row first if none exists yet, then
  applies the update on top of it.
- Every other role (`accountant`, `staff`, `teacher`, `parent`) is
  rejected (`403`) on both routes.
- `schoolId` always comes from the authenticated user's own JWT
  (`@CurrentUser('schoolId')`) — there is no `:schoolId` or `:id` route
  parameter anywhere in `SchoolSettingsController`, so a `school_admin`
  can never address, view, or mutate another school's settings, even by
  guessing an id.

## No New Module Cycles

`SchoolSettingsModule` declares its own narrow TypeORM repository for
`School` (rather than importing `SchoolsModule`) purely to read the
school's own `name`/`address`/`phone` when seeding the default row — the
same "declare a narrow repo instead of importing the owning module back"
choice `TimetableModule`/`HomeworkModule` already made for
`AcademicYear`/`Grade`/`Subject`/etc.

## API

### GET `/settings`

**Access:** `school_admin`.

```json
{
  "schoolId": "uuid",
  "schoolName": "School A",
  "logoUrl": null,
  "address": "123 Main St",
  "phone": "02112345678",
  "email": null,
  "website": null,
  "timezone": "Asia/Tehran",
  "language": "fa",
  "currency": "IRR",
  "weekStartsOn": 0,
  "workingDays": [0, 1, 2, 3, 4],
  "passingScore": 10,
  "attendanceLateMinutes": 15,
  "tuitionReminderDays": 7,
  "smsEnabled": true,
  "emailEnabled": false,
  "primaryColor": null,
  "secondaryColor": null,
  "createdAt": "2026-...",
  "updatedAt": "2026-..."
}
```

### PUT `/settings`

**Access:** `school_admin`. Every field optional; only the given fields
are changed. `logoUrl`, `address`, `phone`, `email`, `website`,
`primaryColor`, and `secondaryColor` can be explicitly cleared by sending
`null` (omitting them entirely leaves the current value unchanged).

```json
{
  "schoolName": "Updated School Name",
  "website": "https://example.com",
  "primaryColor": "#1A73E8",
  "weekStartsOn": 0,
  "workingDays": [0, 1, 2, 3, 4],
  "passingScore": 10,
  "smsEnabled": true
}
```

Validation: `email` must be a valid email; `logoUrl`/`website` must be
valid URLs; `phone` must be a valid Iranian phone number; `language`
must be `fa` or `en`; `weekStartsOn`/each entry of `workingDays` must be
a valid `Weekday` (`0`–`6`); `passingScore` is `0`–`20`;
`attendanceLateMinutes` is `0`–`180`; `tuitionReminderDays` is `0`–`90`;
`primaryColor`/`secondaryColor` must be a `#RRGGBB` hex color; unknown
fields are rejected (global `whitelist`/`forbidNonWhitelisted`
validation, same as every other endpoint).

## Tests

`test/school-settings.e2e-spec.ts` covers: default-row auto-creation on
first `GET` (seeded from the school's own name/address/phone, defaults
for everything else); exactly one row per school (a second `GET` returns
the same row, verified against the table directly); partial updates via
`PUT` leaving omitted fields unchanged across repeated calls; explicit
`null` clearing a nullable field; updating `workingDays`/`weekStartsOn`;
DTO validation rejecting a malformed email, an invalid hex color, an
invalid `weekStartsOn` enum value, an out-of-range `passingScore`, an
unsupported `language`, and unknown fields; the role gate rejecting
every non-`school_admin` role (and unauthenticated requests) on both
routes; and tenant isolation — school A's settings are seeded/updated
independently of school B's, with no route surface that could even
attempt cross-school access.
