# Phase 5D: Student Profile

## Overview

Phase 5D adds a single aggregated "profile" read endpoint for a student —
one that composes student/school/grade/academic-year info, parent
contacts, and tuition & payment summaries into one response, plus a set
of empty future-ready sections (attendance, grades, documents,
announcements) so the frontend can build against a stable shape ahead of
those phases landing.

Two endpoints expose the same shape to two different audiences:

- `GET /students/:id/profile` — school_admin / accountant
- `GET /parent/students/:id/profile` — parent (own linked children only)

## Architecture & Design Principles

### 1. Service Reuse, No New Financial Logic

`StudentProfileService` (`src/modules/students/profile/`) does not
recompute tuition or payment totals. It calls the existing
`ReportsService.studentStatement()` — the same aggregation
`GET /reports/student/:id/statement` already uses — and reshapes the
result. Nothing in this phase touches tuition, payments, or ledger
calculation logic.

### 2. Shared Response Builder

Both controllers call into the same `StudentProfileService`, which in
turn calls a single pure function, `buildStudentProfileView()`
(`student-profile-view.dto.ts`). There is exactly one place that decides
the response shape, so the school_admin and parent endpoints can never
drift apart.

### 3. Authorization & Tenant Isolation

- `GET /students/:id/profile` is gated `@Roles('school_admin', 'accountant')`
  — the same role list as `GET /reports/student/:id/statement`, since the
  profile embeds the same class of financial summary. `staff` (who can
  see the plain student record) is not granted this route.
- `GET /parent/students/:id/profile` is gated `@Roles('parent')` and
  additionally requires a `parent_students` link between the caller and
  the student — the same "linked child only" rule as every other
  `/parent/students/:id/*` route. An unlinked or cross-school id returns
  404, never 403, so a parent probing an id can't tell "doesn't exist"
  from "exists but isn't yours".
- Both flows re-check `student.schoolId` against the caller's own
  `schoolId` from the JWT — the same tenant-isolation shape used
  throughout the app (`StudentsService.findOne`, `ParentService.findMyStudent`).

### 4. No New Module Cycles

`StudentProfileModule` is imported by both `StudentsModule` and
`ParentModule`, but does not import either of them back — it only
depends on `ReportsModule` (for `ReportsService`) and declares its own
narrow TypeORM repositories (`Student`, `ParentStudent`, `User`).
`ReportsModule` now exports `ReportsService` (previously provider-only)
so it can be reused this way; nothing about `ReportsService` itself
changed.

## API

### GET `/students/:id/profile`

**Access:** `school_admin`, `accountant`. Requires the student to belong
to the caller's own school (404 otherwise).

### GET `/parent/students/:id/profile`

**Access:** `parent`, and only for a student the caller is linked to via
`parent_students` (404 otherwise, same as the other parent-side
student-scoped endpoints).

### Response shape (both endpoints)

```json
{
  "student": {
    "id": "uuid",
    "fullName": "...",
    "nationalId": null,
    "status": "active",
    "enrollmentDate": null
  },
  "school": { "id": "uuid", "name": "..." },
  "grade": { "id": "uuid", "title": "..." },
  "academicYear": { "id": "uuid", "title": "...", "isCurrent": true },
  "parents": [
    { "id": "uuid", "fullName": "...", "phone": "...", "type": "guardian" },
    { "id": "uuid", "fullName": "...", "phone": "...", "type": "parent_account" }
  ],
  "tuitionSummary": {
    "totalDue": 90000000,
    "totalPaid": 45000000,
    "totalRemaining": 45000000,
    "plans": [
      {
        "id": "uuid",
        "academicYearId": "uuid",
        "baseAmount": 100000000,
        "discountAmount": 10000000,
        "finalAmount": 90000000,
        "installmentCount": 2
      }
    ]
  },
  "paymentSummary": {
    "totalPayments": 1,
    "totalAmountPaid": 45000000,
    "lastPaymentAt": "2026-09-15T10:00:00.000Z",
    "recentPayments": [
      { "id": "uuid", "amount": 45000000, "paymentMethod": "cash", "paidAt": "2026-09-15T10:00:00.000Z" }
    ]
  },
  "attendance": { "available": false, "records": [] },
  "grades": { "available": false, "records": [] },
  "documents": { "available": false, "records": [] },
  "announcements": { "available": false, "records": [] }
}
```

`parents[]` combines two distinct concepts:
- `type: "guardian"` — the single billing contact on the student record
  itself (`students.guardian_id`).
- `type: "parent_account"` — every parent-portal login linked to the
  student via `parent_students`. A student can have zero, one, or
  several of these, and they need not be the same person as the
  guardian.

## Tests

`test/student-profile.e2e-spec.ts` covers both endpoints: response shape,
tuition/payment summary correctness, the empty future-ready sections,
role gates (school_admin/accountant allowed, staff/parent rejected on the
admin route; parent allowed, everyone else rejected on the parent route),
"linked child only" enforcement, and tenant isolation across schools.
