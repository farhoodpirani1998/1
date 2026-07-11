# Phase 5L: Homework & Assignments

## Overview

Phase 5L adds a `homework` table and a teacher-managed
assignments/homework feature: teachers post homework for one
`(grade, subject)` pair within an academic year, with a title,
description, due date, and an optional attachment reference.
`school_admin` gets a school-wide read view, and parents get a read-only
view for their linked children. No existing module was rewritten — this
phase only adds one new table, one new `modules/homework`, and new routes
on the existing `TeacherController` / `ParentController`, the same
"additive, minimal-change" shape every recent phase has followed.

## What It Deliberately Does Not Do

Same as Phase 5I's `StudentDocument.fileUrl`, `Homework.attachmentUrl` is
stored exactly as given — this phase does not implement file storage or
upload, only "store the reference, not the bytes." The column is
nullable: an attachment is optional.

## Correctable, Unlike Announcement

Unlike `Announcement` (one-shot, never corrected in place), homework
*can* be corrected via `PUT /teacher/homework/:id` — the entity carries
both `createdAt` and `updatedAt`, the same reasoning `TimetableEntry`
already uses.

## API Surface

| Method & Path | Roles | Notes |
|---|---|---|
| `POST /teacher/homework` | `teacher` | Restricted to one of the teacher's own assigned `(grade, subject)` pairs — `HomeworkService.create()` checks this against `TeacherAssignment`, same enforcement `AttendanceService`/`AssessmentsService` already apply for teacher-submitted records. |
| `GET /teacher/homework` | `teacher` | The calling teacher's own posted homework only. |
| `PUT /teacher/homework/:id` | `teacher` | Same assignment check as create; a teacher cannot edit another teacher's homework. |
| `DELETE /teacher/homework/:id` | `teacher` | Same assignment check as create. |
| `GET /homework` | `school_admin` | School-wide read. This controller manages nothing else — write access stays on `/teacher/homework`, the same "one controller manages nothing here, dedicated portal controllers write/read" shape `TimetableController`/`AnnouncementsController` use. |
| `GET /parent/students/:id/homework` | `parent` | Linked-child-only, 404 (never 403) for an unlinked or cross-school id, same rule as every other `/parent/students/:id/*` route. |

## Module Wiring

`HomeworkModule` deliberately does not import `TeacherModule` or
`ParentModule`: both need `HomeworkService` directly (`TeacherModule` for
the `/teacher/homework` CRUD surface, `ParentModule` for the read route
above), so importing either back would create a cycle. It declares its
own narrow TypeORM repositories for `AcademicYear`, `Grade`, `Subject`,
`Student`, `ParentStudent`, and `TeacherAssignment` instead — the same
shape `TimetableModule` and `StudentDocumentsModule` already use for the
same reason.
