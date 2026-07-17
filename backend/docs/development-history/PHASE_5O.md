# Phase 5O: Founder (مؤسس) Portal

## Overview

Phase 5O adds a fifth login role, `founder` (مؤسس), for whoever owns one
or more schools on the platform. A founder gets a read-only view across
every school they own: a school list, an aggregated cross-school
dashboard, a per-school analytics dashboard, and student / teacher /
staff / tuition directories for each owned school. No existing module
was rewritten — auth, roles, tenant isolation, students, tuition,
analytics, and every other existing portal (parent/teacher/staff) all
work exactly as they did in Phase 5N; this phase adds one new table
(`founder_schools`), one new `modules/founder`, and small additive
changes to auth so a founder — like a super_admin — isn't tied to a
single `schoolId`.

## One Founder, Many Schools

Every other role in this system (school_admin, accountant, staff,
parent, teacher) belongs to exactly one school via `users.school_id`.
A founder is the first role that can legitimately own *several*
schools, so it needed a different shape: `schoolId` stays `null` on a
founder's `users` row (same as super_admin), and which schools it can
see instead lives in a new join table, `founder_schools`
(`founder_id`, `school_id`), the same "plain join table with a unique
pair constraint" shape `parent_students` already uses for parent ↔
student.

A founder account is created the same way every other role is — `POST
/auth/register` with `role: 'founder'` and no `schoolId` — then a
super_admin attaches it to the school(s) it owns via `POST
/founder/link`, mirroring the two-step `POST /parent/link` flow a
school_admin already uses to attach a parent login to specific
students.

## Ownership Is Checked Per Request, Not Cached

Every `/founder/schools/:schoolId/*` route calls
`FounderService.assertOwnsSchool(founderId, schoolId)` before doing
anything else — the same 404-not-403 shape tenant isolation already
uses everywhere else in this codebase (see
`tenant-isolation.e2e-spec.ts`): a founder guessing another owner's
school UUID learns nothing about whether that school even exists,
exactly like a school_admin guessing another school's student/plan/
installment id today.

## What a Founder Can See

| Endpoint                                    | Source |
|-----------------------------------------------|--------|
| `GET /founder/schools`                        | schools linked via `founder_schools` |
| `GET /founder/overview`                       | one row per owned school + grand totals |
| `GET /founder/schools/:id/dashboard`          | `AnalyticsService.getDashboard()`, reused wholesale |
| `GET /founder/schools/:id/students`           | `StudentsService.findWithFilters()`, reused wholesale |
| `GET /founder/schools/:id/teachers`           | `User` (role=`teacher`) + `TeacherAssignment` |
| `GET /founder/schools/:id/staff`              | `User` (role in school_admin/accountant/staff) |
| `GET /founder/schools/:id/tuition`            | plan/installment totals + `ReportsService.overdueSummary()`/`debtorStudents()` |

`GET /founder/overview` is the only endpoint that computes something
genuinely new (a per-school breakdown plus cross-school sums); every
other endpoint either delegates to an existing service wholesale
(`AnalyticsService`, `StudentsService`) or runs a narrow, read-only
query in the same shape `AnalyticsService`/`SearchModule` already use
for reads no existing service exposes.

## Design Choices

- **Reuse existing services wherever one already computes the number
  needed.** `getSchoolDashboard()` and `getStudents()` are one-line
  delegations to `AnalyticsService`/`StudentsService` after the
  ownership check — no dashboard or student-listing logic is
  duplicated. `getTuitionOverview()` reuses
  `ReportsService.overdueSummary()`/`debtorStudents()` for the same
  reason.
- **Own narrow repos for reads no existing service exposes**, the same
  "own repos instead of a cross-module import" shape `AnalyticsModule`/
  `SearchModule` already use: a school directory, a teacher/staff
  directory, and a cross-school finance total are all things no
  existing service returns today, so `FounderModule` declares its own
  `School`/`User`/`Student`/`TeacherAssignment`/`TuitionPlan`/
  `Installment` repos for exactly those reads.
- **super_admin has no school; founder has no *single* school.** Login,
  `JwtStrategy.validate()`, and `RegisterDto` already special-cased
  super_admin's `schoolId === null`; founder needed the identical
  exception (checked in `founder_schools` instead), so those three
  spots gained one extra `&& role !== Role.FOUNDER` clause each rather
  than a parallel code path.
- **Read-only, no `@RequirePermission` surface.** A founder never
  writes anything through `/founder/*` other than the link/unlink pair
  (which is super_admin-only, not founder-facing) — `permissions.ts`
  lists `[Role.FOUNDER]: []` explicitly for the same "considered, not
  missed" reason `PARENT`/`TEACHER` already do.

## Files Added

- `src/common/authorization/roles.enum.ts` — `Role.FOUNDER` (existing file, new enum member)
- `src/database/migrations/1737600000000-FounderSchools.ts`
- `src/modules/founder/entities/founder-school.entity.ts`
- `src/modules/founder/dto/link-founder-school.dto.ts`
- `src/modules/founder/dto/founder-staff-view.dto.ts`
- `src/modules/founder/dto/founder-teacher-view.dto.ts`
- `src/modules/founder/dto/founder-overview-view.dto.ts`
- `src/modules/founder/dto/founder-tuition-view.dto.ts`
- `src/modules/founder/founder.service.ts`
- `src/modules/founder/founder.controller.ts`
- `src/modules/founder/founder.module.ts`
- `test/founder.e2e-spec.ts`

## Files Changed

- `src/app.module.ts` — one new import + one new entry in the `imports` array (`FounderModule`).
- `src/common/authorization/roles.enum.ts` — added `FOUNDER = 'founder'`.
- `src/common/authorization/permissions.ts` — added `[Role.FOUNDER]: []`.
- `src/modules/users/entities/user.entity.ts` — updated the `schoolId` comment (null for super_admin *and* founder).
- `src/modules/auth/auth.service.ts` — `register()`/`login()` treat founder like super_admin for the "must own a school" / "must belong to an active school" checks.
- `src/modules/auth/strategies/jwt.strategy.ts` — same founder exception in token validation.
- `src/modules/auth/dto/register.dto.ts` — `schoolId` no longer required for `role: 'founder'`.
- `src/modules/analytics/analytics.module.ts` — now exports `AnalyticsService` so `FounderModule` can reuse `getDashboard()`.
- `test/setup/test-app.ts` — added `founder_schools` to the explicit `truncateAll()` table list.
- `test/setup/factories.ts` — added `linkFounderSchool()`, mirroring `linkParentStudent()`.
