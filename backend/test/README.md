# Phase 3 — Testing & Reliability

## Layout

```
src/**/*.spec.ts          Unit tests — pure logic, no DB, no network.
                           Run by `npm test`.

test/setup/env.ts          Sets test env vars (DATABASE_URL, JWT_SECRET,
                            REDIS_HOST/PORT) before AppModule is imported.
test/setup/test-app.ts     Boots the real AppModule against a real
                            Postgres, runs migrations once, truncates
                            tables between tests.
test/setup/factories.ts    Creates schools/users/students/tuition
                            plans/installments directly via the
                            DataSource, and signs JWTs matching
                            JwtStrategy's payload shape.

test/*.e2e-spec.ts         Full-stack tests: real HTTP requests via
                            supertest → real guards → real services →
                            real Postgres. Run by `npm run test:e2e`.
```

## Why unit tests *and* e2e tests

- **Unit tests** (`src/**/*.spec.ts`) cover pure, deterministic logic —
  the installment state machine, the role/permission map, the
  Gregorian→Jalali year conversion. No DB needed, run in under a second,
  safe to run on every save.
- **E2E tests** (`test/*.e2e-spec.ts`) cover everything this phase was
  actually asked to prove: tenant isolation, payment concurrency,
  authorization, and auth security. These properties only mean something
  against a real database — a mocked repository can't demonstrate that a
  row-level lock actually blocks a second transaction, and a hand-rolled
  fake guard can't prove the real `JwtAuthGuard → RolesGuard →
  PermissionsGuard` chain behaves correctly together.

## Running the tests

### Unit tests (no setup required)

```bash
npm install
npm test              # or: npm run test:coverage
```

### E2E tests (needs Postgres + Redis)

A disposable Postgres + Redis pair is provided via Docker Compose:

```bash
docker compose -f docker-compose.test.yml up -d
npm install
npm run test:e2e
docker compose -f docker-compose.test.yml down
```

Redis is required because `NotificationsModule` registers a BullMQ queue
at app-bootstrap time — the e2e tests never process a job, but the
module still needs somewhere to connect. If you already have Postgres/
Redis running elsewhere, point the suite at them instead of the compose
file:

```bash
TEST_DATABASE_URL=postgres://user:pass@host:5432/db \
REDIS_HOST=host REDIS_PORT=6379 \
npm run test:e2e
```

Migrations run automatically (once per test process) against whatever
`TEST_DATABASE_URL` resolves to — never point this at a database you
care about; every test file truncates all tables in `beforeEach`.

## What each e2e file proves

| File | Proves |
|---|---|
| `tenant-isolation.e2e-spec.ts` | School A can never read/write School B's tuition plans, installments, students, payments, or reports — whether the resource is directly tenant-scoped (Student) or only transitively so (Payment → Installment → TuitionPlan → Student). |
| `payment-concurrency.e2e-spec.ts` | Two genuinely concurrent payment requests (via `Promise.all`, against real Postgres) can never together exceed an installment's amount; the same idempotency key never produces two payment rows. |
| `tuition-workflow.e2e-spec.ts` | Plan creation, duplicate-plan prevention, installment generation (including the remainder-on-last-installment split), the amount-sum-equals-finalAmount invariant, and state-machine transition enforcement. |
| `authorization-matrix.e2e-spec.ts` | `super_admin` has global access and bypasses per-route `@Roles()`; `school_admin` is confined to its own school; `accountant` can do financial operations but not void payments; `staff` is blocked from every financial read. |
| `auth-security.e2e-spec.ts` | A password change invalidates every JWT issued before it (`tokenVersion` bump); a deactivated user's existing token stops working immediately, without needing to expire; a deactivated school's users are locked out the same way; login itself refuses both cases. |
| `validation.e2e-spec.ts` | Invalid field values, missing required fields, malformed UUIDs, and unknown fields (`forbidNonWhitelisted`) are all rejected with 400, and a well-formed-but-nonexistent UUID is a clean 404, not a 500. |

## A note on one intentionally "loose" assertion

`payment-concurrency.e2e-spec.ts` → *"never creates two payment rows when
the same idempotencyKey is sent concurrently"* doesn't assert both
concurrent requests return `201`. The app's idempotency check is a
`SELECT`-then-`INSERT` under Postgres's default read-committed isolation,
so under true concurrency the *loser* of the race can surface as a `500`
from the `uq_payments_idempotency_key` unique-index violation rather than
gracefully returning the winner's payment. The test asserts the one
invariant that must hold regardless — exactly one payment row ever
exists for that key — rather than a status code the current
implementation doesn't actually guarantee under true concurrency. See
the "Known reliability gap" note in the top-level summary.
