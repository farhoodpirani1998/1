# Security / Authorization TODO

Living list of known gaps in the current auth setup. Not urgent enough to
block Phase 1/2/3 work, but real, and easy to forget six months from now.
Update this file whenever a new gap is spotted or an item below gets fixed.

## Authorization TODO

- **JWT role staleness (highest priority of this list).** `role` is signed
  into the JWT at login (`AuthService.login`, `JwtStrategy.validate`) and
  never re-checked against the DB until the token expires
  (`signOptions: { expiresIn: '7d' }` in `auth.module.ts`). If an admin
  demotes or deactivates a user, that user's *existing* token keeps working
  — with the *old* role/active-status — for up to 7 days. This matters most
  for `Permission.PAYMENT_VOID`: someone stripped of `school_admin` could
  still void a payment for up to a week.
  Options, roughly cheapest → most work:
  1. Shorten `expiresIn` (e.g. 1h) + add a refresh token flow.
  2. Add a `tokenVersion` column on `users`; bump it on role change /
     deactivation; `JwtStrategy.validate` checks the DB's current
     `tokenVersion` against the token's and rejects if mismatched. Doesn't
     need full refresh-token infra, but does add one DB read per request.
  3. Full refresh-token + short-lived access-token pair (standard, more
     moving parts: revocation list, rotation, storage).
  Decide once actual deactivation/demotion frequency is known — for ~10
  schools this may not be worth solving before it's observed as a real
  problem.

- **Dynamic (DB-driven) permissions — only if a real need shows up.**
  Deliberately not built (see `common/authorization/permissions.ts`
  header). Current static role→permission map is fine at this scale
  (~10 schools, 3000 students). Revisit only if a school needs a custom
  role that doesn't fit `super_admin / school_admin / accountant / staff`.

- **`RolesGuard` open-by-default.** Any endpoint without `@Roles(...)`
  is reachable by *any* authenticated role, not just an intended subset
  (e.g. today `GET /payments`, `GET /reports/student/:id/statement` have
  no `@Roles()`). Worth an audit pass: go through every controller once
  and confirm each route's absence of `@Roles()` is intentional, not an
  oversight.

- **Controllers still pass role strings, not `Role` enum values, to
  `@Roles(...)`.** (e.g. `@Roles('school_admin', 'accountant')`.)
  Functionally identical to `@Roles(Role.SCHOOL_ADMIN, Role.ACCOUNTANT)`
  today since the enum's values are the same strings — this is a
  type-safety cleanup, not a behavior change. Low risk, mechanical,
  touches every controller; do it in one pass when there's a slow day,
  not urgent.

- **`Permission` enum only covers 3 actions today** (`PAYMENT_VOID`,
  `DISCOUNT_UNLIMITED`, `INSTALLMENT_STATUS_OVERRIDE`). Add a new
  `Permission` only when a real case appears where two users with the
  *same* role need different capabilities — not for every verb×entity
  combination (see the authorization architecture discussion this was
  decided in).

## Other known gaps (non-authorization, noted along the way)

- **Manual tuition-plan/installment edits and audit.** `TuitionPlansService
  .update()` / `InstallmentsService.update()` now emit domain events that
  are picked up by `AuditEventsListener` — this was closed, listed here
  only so it's not accidentally "rediscovered" as a gap later.
- **Payment history as its own report.** `ReportsService` covers overdue
  summary, student statement, monthly income, debtor students. "Payment
  history" from the original roadmap isn't a separate report endpoint —
  `GET /payments?studentId=...` serves the same data today. Add a
  dedicated `/reports/payment-history` only if the plain payments list
  stops being sufficient (e.g. needs date-range filtering, export, etc).
