# Phase 5A & 5C: Parent Portal Foundations

## Overview

Phases 5A and 5C are grouped into one document because neither is a
standalone feature on its own — both are small, additive building blocks
that later phases (5B: Parent Tuition & Payments Access, 5D: Student
Profile) sit on top of. Each phase added one migration and touched a
handful of files; neither rewrote or altered any existing module.

## Phase 5A: Parent Portal Foundation

Introduces the `parent` role and the `parent_students` join table
(migration `1736600000000-ParentPortal`) — the many-to-many link between
a parent-role user and the student(s) they're allowed to view.

- **No `users` table migration needed.** `users.role` has always been a
  free-text `VARCHAR(30)` with no `CHECK` constraint (see `InitSchema`),
  so adding `Role.PARENT = 'parent'` to
  `common/authorization/roles.enum.ts` was enough for `RegisterDto`'s
  `@IsIn(Object.values(Role))` to accept it — the same pattern Phase 5G
  later reused to add `teacher`.
- **`parent_students`** is a plain join table (`id`, `parent_id`,
  `student_id`, `created_at`) with a unique constraint on
  `(parent_id, student_id)`, making `POST /parent/link` idempotent —
  linking the same pair twice is a no-op, not a duplicate row.
- **Admin-managed linking.** A `school_admin` creates a parent's login via
  the existing `POST /auth/register` (with `role: 'parent'`), then links
  it to one or more students via `POST /parent/link` /
  `DELETE /parent/link/:id`. Parents never self-link.
- **Read scope.** `GET /parent/students` and `GET /parent/students/:id`
  return only the students a given parent is explicitly linked to
  (`ParentService.findMyStudents` / `findMyStudent`) — never a
  school-wide list.

## Phase 5C: Parent Notifications

Extends the `notifications` table — which already existed from
`InitSchema` as an internal SMS delivery log — with the two columns a
parent-facing notification list needs (migration
`1736700000000-ParentNotifications`):

- **`type`** persists what was previously only an ephemeral BullMQ job
  field (`payment_received`, `overdue_installment`, `upcoming_due`), so
  notifications can be filtered/displayed without re-deriving why they
  exist.
- **`read_at`** is a nullable timestamp (`NULL` = unread), following the
  same "timestamp instead of boolean" convention as the table's existing
  `sent_at` column.
- Both columns are backward compatible: existing rows default to
  `type = 'overdue_installment'` (the only kind that existed before this
  phase) and `read_at = NULL`.
- **`NotificationsService.queueUpcomingDueReminder()`** is called by a new
  `UpcomingDueInstallmentsCron` (`modules/scheduler`) — a nightly job that
  queues an "installment due soon" reminder, alongside the pre-existing
  overdue-installment reminder cron.
- **Parent-facing API:** `GET /parent/notifications` (paginated, filterable
  by `isRead`) and `PATCH /parent/notifications/:id/read`.

## Why These Weren't Given Full Phase Documents

Both changes are additive infrastructure with no new architectural
decisions of their own — 5A is a join table plus a role string, 5C is two
columns plus a query endpoint. The interesting design decisions they
enabled (tenant-safe parent-scoped reads, service reuse across the parent
portal) are the actual subject of Phase 5B and Phase 5D, which reference
this foundation rather than repeating it.
