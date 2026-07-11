# Phase 5J: Analytics Dashboard Foundation

## Overview

Phase 5J adds a single `GET /analytics/dashboard` endpoint that composes
a `school_admin`-facing dashboard entirely from data other modules
already own: student counts, a school-wide financial summary, today's
attendance, assessment averages, recent activity feeds, and four chart
series. No existing module was rewritten — this phase is read-only
aggregation on top of students, attendance, assessments, tuition, and
announcements exactly as they worked in Phase 5I.

## Why `school_admin` Only

Unlike `/reports/*` (`school_admin` + `accountant`), this endpoint
surfaces attendance and assessment data alongside financials, which
`accountant` has no standing reason to see — so its role list is
intentionally narrower than `ReportsController`'s.

## Two Reuse Shapes

- **Calling into an existing service** wherever one already computes the
  needed number, so that module's business rule is never re-derived:
  `ReportsService.overdueSummary()` / `monthlyIncome()`,
  `AttendanceService.findByDate()`, `AnnouncementsService.findAllForSchool()`,
  and `buildReportCard()` (the same score-averaging helper the Phase 5F
  report-card endpoint and Phase 5D profile summary already use).
- **Narrow, read-only repository queries** (`Student`, `Attendance`,
  `Assessment`, `Payment`, `Installment`, `TuitionPlan`) for school-wide
  totals no existing method returns — the same "this module declares its
  own repos for the reads it needs" convention `StudentDocumentsModule`
  and `StudentProfileService` already use, chosen over modifying
  attendance/tuition/assessments to keep those modules untouched.

## Response Shape

`GET /analytics/dashboard?recentLimit=&trendDays=&monthsBack=` returns:

| Section | Contents |
|---|---|
| `students` | Total and active student counts. |
| `finance` | `totalTuition`, `totalPaid`, `totalUnpaid` (school-wide sums, same additive definition `ReportsService.studentStatement()` uses per student), and `overdueAmount` (reused outright from `ReportsService.overdueSummary()`). |
| `attendance` | Today's present/absent/late counts plus an all-time attendance rate. |
| `assessments` | Average score, top 5 and lowest 5 students by average (via `buildReportCard()`), or nulls/empty arrays if no assessments exist yet. |
| `recentActivity` | The `recentLimit` (default 5, max 20) most recent payments, attendance records, assessments, and announcements. |
| `charts` | `monthlyPayments` and `monthlyRegistrations` (`monthsBack`, default 6, max 24, trailing calendar months), `attendanceTrend` (`trendDays`, default 7, max 90, trailing days), and `paymentStatusDistribution` (one row per installment status, with count and outstanding amount). |

All three query parameters are optional, bounded (`@Min`/`@Max`), and
validated via `class-validator` — an out-of-range value 400s before
reaching any query, the same pattern `QueryParentNotificationsDto`
already uses for pagination.

## Cost Note

`monthlyPayments` and `attendanceTrend` each make one call per trailing
period (one `ReportsService.monthlyIncome()` call per month, one
`AttendanceService.findByDate()` call per day) rather than a single
grouped query — acceptable at the bounded defaults (6 months / 7 days,
capped at 24 / 90), but worth knowing before raising those caps further
or calling this endpoint on a tight polling interval.
