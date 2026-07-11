# Documentation Coverage Report

This project's history is tracked through 17 migrations plus one
freestanding architecture delivery. Coverage below is organized by
migration/feature in chronological order, with the evidence used to
classify each one (migration doc-comment, source-code comment, or
absence of either).

## Fully Documented

| Migration / Feature | Document |
|---|---|
| `LedgerStateMachineIdempotency` — append-only ledger, installment state machine, domain events, fine-grained authorization | `docs/architecture/ARCHITECTURE_CHANGES.md` |
| `ParentPortal` (Phase 5A) + `ParentNotifications` (Phase 5C) | `docs/development-history/PHASE_5A_5C_PARENT_FOUNDATIONS.md` *(written this pass — see below)* |
| Phase 5B — Parent tuition & payment access | `docs/development-history/PHASE_5B.md` |
| Phase 5D — Student profile aggregation endpoint | `docs/development-history/PHASE_5D.md` |
| `Attendance` (Phase 5E) | `docs/development-history/PHASE_5E.md` |
| `StudentAssessments` (Phase 5F) | `docs/development-history/PHASE_5F.md` |
| `TeacherAssignments` (Phase 5G) — teacher portal | `docs/development-history/PHASE_5G.md` |
| `Announcements` (Phase 5H) | `docs/development-history/PHASE_5H.md` |
| `StudentDocuments` (Phase 5I) | `docs/development-history/PHASE_5I.md` *(written this pass)* |
| Analytics dashboard (Phase 5J) | `docs/development-history/PHASE_5J.md` *(written this pass)* |
| `Timetable` (Phase 5K) | `docs/development-history/PHASE_5K.md` |
| `Homework` (Phase 5L) | `docs/development-history/PHASE_5L.md` *(written this pass)* |
| `SchoolSettings` (Phase 5M) | `docs/development-history/PHASE_5M.md` |
| Global search (Phase 5N) | `docs/development-history/PHASE_5N.md` |
| Deployment hardening (observability, health checks, env validation, Docker — "Phase 4B" in source comments) | `docs/deployment/DEPLOYMENT.md` |
| Authorization gaps and their current status | `docs/security/security-roadmap.md` |
| Test suite layout and per-file guarantees | `docs/testing/TESTING.md` |

## Newly Documented This Pass

Four documents were written during this cleanup, each backed only by
verified source (migration header comments, module/controller/entity
comments referencing their own phase number) — nothing was invented:

- **`PHASE_5A_5C_PARENT_FOUNDATIONS.md`** — merges Phase 5A (`parent`
  role + `parent_students` table) and Phase 5C (`notifications.type` /
  `read_at` + upcoming-due cron). Merged rather than split because each
  is too small alone (one table, or two columns) to justify its own
  document, per the "merge small/related phases" instruction.
- **`PHASE_5I.md`** — Student Document Management. Own module, own
  entity, four routes, parent-portal integration: large enough to stand
  alone (380 lines across the module).
- **`PHASE_5J.md`** — Analytics Dashboard Foundation. A genuine reporting
  feature (699 lines, composes six other modules into one dashboard
  endpoint) — qualifies under the "reporting" exception for a dedicated
  document even though it was previously undocumented.
- **`PHASE_5L.md`** — Homework & Assignments. Same reasoning as 5I — a
  full module with its own entity and CRUD surface (648 lines).

## Intentionally Undocumented

These migrations/changes have no dedicated document and none was
created for them, because each is a small, self-contained hardening fix
or reliability improvement — exactly the "bug fixes or very small
refactors" category this audit was told to leave alone:

| Migration | What it does | Why left undocumented |
|---|---|---|
| `InitSchema` | The original base schema | Pre-dates the "Phase" numbering entirely; there is nothing to document beyond what every entity file already describes. |
| `AuditLogs` | Append-only audit log, populated via existing domain events | Already referenced as a closed item in `docs/security/security-roadmap.md`'s "Other known gaps" section — a second document would duplicate that note. |
| `PaymentReceipts` | Per-school, per-Jalali-year sequential receipt numbering | Single migration, single row-locking change inside `PaymentsService.create()`; data-format detail, not an architectural or feature milestone. |
| `TuitionPlanUniqueStudentYear` | Unique constraint backstopping an existing app-level duplicate-plan check | A one-line integrity fix closing a race condition; no new behavior from a caller's perspective. |
| `Phase4APerformanceIndexes` | Database indexes for performance | Named "Phase 4A" only in the migration filename itself; no accompanying feature or behavior change to document. |

## Confirmed Not To Exist

No trace of a "Phase 5C" separate from Parent Notifications, nor a
"Phase 5J" separate from the Analytics Dashboard, nor any phase between
5I and 5K other than 5J, was found anywhere in migrations or source
comments — the full phase sequence 5A through 5N is now accounted for
(either by an existing document, a document written this pass, or an
explicit entry in the table above).

## Missing High-Value Documentation

None identified. Every migration and every `modules/*` directory maps to
either an existing document, a document written this pass, or a
justified "intentionally undocumented" entry above.
