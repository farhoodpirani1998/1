# Security / Authorization TODO

Living list of known gaps in the current auth setup. Not urgent enough to
block Phase 1/2/3 work, but real, and easy to forget six months from now.
Update this file whenever a new gap is spotted or an item below gets fixed.

## Authorization TODO

- **JWT staleness on deactivation — closed.** `users.token_version`
  (migration `1736400000000-UserTokenVersion`) is bumped by
  `UsersService.setActive()` on every activate/deactivate call and by
  `AuthService.changePassword()`; `JwtStrategy.validate` rejects any token
  whose embedded `tokenVersion` doesn't match the DB's current value
  (`src/modules/auth/strategies/jwt.strategy.ts`). A deactivated user's
  existing token — and any other still-logged-in session of that user's —
  stops working on the very next request instead of surviving up to the
  7-day `expiresIn`. This was option 2 from the original version of this
  note, implemented; kept here (not deleted) so it isn't rediscovered as an
  open gap. Covered by `auth-security.e2e-spec.ts`.

- **JWT role staleness — not yet applicable.** The fix above closes
  *deactivation* staleness, but there is still no endpoint that changes an
  existing user's `role` after creation (no `updateRole`/`changeRole` on
  `UsersService`, no matching route). A role is fixed at registration
  today, so "an admin demotes a user and their old-role token keeps
  working" isn't currently reachable — not because it was fixed, but
  because the feature it would require doesn't exist yet. If a role-change
  endpoint is ever added, it must also bump `tokenVersion` (the same call
  `setActive()` already makes) or this gap reopens immediately.

- **Dynamic (DB-driven) permissions — only if a real need shows up.**
  Deliberately not built (see `common/authorization/permissions.ts`
  header). Current static role→permission map is fine at this scale
  (~10 schools, 3000 students). Revisit only if a school needs a custom
  role that doesn't fit `super_admin / school_admin / accountant / staff`.

- **`RolesGuard` open-by-default — audit pass done, stays a design note.**
  `RolesGuard` still falls open to any authenticated role when a route
  carries no `@Roles(...)` (see `src/common/guards/roles.guard.ts`); that
  behavior itself is unchanged and intentional. The two examples
  previously listed here (`GET /payments`, `GET /reports/student/:id/statement`)
  have since been closed — both now carry `@Roles('school_admin', 'accountant')`
  (`payments.controller.ts`, `reports.controller.ts`). No further gaps are
  known, but re-run this audit whenever a new controller is added, since
  the guard's open-by-default behavior means a missing `@Roles()` fails
  silently rather than loudly.

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
