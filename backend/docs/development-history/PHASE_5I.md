# Phase 5I: Student Document Management

## Overview

Phase 5I adds a `student_documents` table and a small
create/list/delete API for attaching document *references* (identity
papers, registration forms, contracts, medical records, etc.) to a
student. No existing module was rewritten — auth, roles, tenant
isolation, tuition, payments, attendance, assessments, teacher portal,
and announcements all work exactly as they did in Phase 5H; this phase
only adds one new table, one new `modules/student-documents`, and one
read-only route on the existing `ParentController`.

## What It Deliberately Does Not Do

`StudentDocument.fileUrl` is stored exactly as given by the caller —
this phase does not implement file storage or upload. It stores a
*reference* to an already-hosted file location, the same "store the
reference, not the bytes" shape `Payment.referenceNumber` already uses. A
future storage phase can start writing real object-storage URLs into
this same column without any schema change.

## Data Model

`StudentDocumentType` is a small closed enum (`identity`,
`registration`, `contract`, `medical`, `other`) rather than free text —
same convention as `AttendanceStatus` / `AssessmentTerm` /
`AnnouncementTargetType` — because the student profile and admin UI
filter by a known, fixed set of categories.

A document is one-shot: create or delete, never corrected in place (no
upsert key, unlike `Attendance`/`Assessment`), the same reasoning
`Announcement` uses.

## API Surface

| Method & Path | Roles | Notes |
|---|---|---|
| `POST /students/:id/documents` | `school_admin`, `staff` | Same role pair as `POST /assessments`; `accountant` is not granted a write here. |
| `GET /students/:id/documents` | `school_admin`, `accountant`, `staff` | Same role set as `GET /assessments/student/:id`. |
| `DELETE /documents/:id` | `school_admin`, `staff` | Lives on its own flat `documents` resource (id alone, no student id in the path) — same shape as `DELETE /announcements/:id`, since the row's own id is already globally unique and its tenant is re-checked from the token. |
| `GET /parent/students/:id/documents` | `parent` | Linked-child-only, 404 (never 403) for an unlinked or cross-school id — the same rule every other `/parent/students/:id/*` route follows. |

## Module Wiring

`StudentDocumentsModule` deliberately does not import `StudentsModule` or
`ParentModule`: both need `StudentDocumentsService` (`ParentModule`
directly, for the parent-facing route above; `StudentsModule` indirectly,
via `StudentProfileService`'s documents summary on the Phase 5D profile
endpoint), so importing either back would create a cycle. It declares its
own narrow TypeORM repositories for the `Student`/`ParentStudent` reads it
needs directly instead — the same shape `StudentAssessmentsModule` and
`AttendanceModule` already use for the same reason.

## Tenant Safety

Every read/write is scoped by `schoolId` (staff-side) or by the
`parent_students` link (parent-side), both checked with a plain
`findOne({ where: { id, schoolId } })`-style lookup so a wrong-tenant or
unlinked id 404s exactly like a nonexistent one — a caller can never learn
"that id exists, just not for you" from the response.
