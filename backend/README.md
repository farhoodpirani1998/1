# School Tuition System — Backend

A multi-tenant NestJS API for schools to manage students, tuition
plans/installments/payments, attendance, assessments, a teacher and
parent portal, announcements, timetables, homework, and school settings.
Each school is a tenant; every query is scoped to the caller's own
school.

## Stack

- **Framework:** NestJS 10 (Express)
- **Database:** PostgreSQL via TypeORM (migration-based, no
  auto-sync in any environment)
- **Queue / cache:** Redis via BullMQ (SMS notification delivery) and
  `@nestjs/schedule` (cron jobs)
- **Auth:** JWT (`@nestjs/passport` + `passport-jwt`), bcrypt password
  hashing, role-based + fine-grained permission-based authorization
- **Logging:** structured JSON via `pino`, with per-request correlation
  IDs
- **Testing:** Jest (unit) + Jest/Supertest against a real Postgres +
  Redis (e2e)

## Getting Started

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL, JWT_SECRET, etc. -- see comments in the file
npm run migration:run
npm run seed            # creates the first super_admin (needs SEED_ADMIN_PHONE / SEED_ADMIN_PASSWORD)
npm run start:dev
```

The API is served under the `/api/v1` prefix (e.g.
`http://localhost:3000/api/v1/health`).

### Running tests

```bash
npm test               # unit tests, no external services needed
docker compose -f docker-compose.test.yml up -d
npm run test:e2e       # full-stack tests against real Postgres + Redis
docker compose -f docker-compose.test.yml down
```

See [`docs/testing/TESTING.md`](docs/testing/TESTING.md) for the full
test layout and what each e2e suite proves.

### Running with Docker

```bash
cp .env.example .env
docker compose up -d --build
docker compose exec app npm run migration:run
```

See [`docs/deployment/DEPLOYMENT.md`](docs/deployment/DEPLOYMENT.md) for
environment variables, health checks, logging, and production defaults.

## Roles

Six roles exist today (`src/common/authorization/roles.enum.ts`):
`super_admin`, `school_admin`, `accountant`, `staff` (all staff-facing),
plus `parent` and `teacher`, which are each confined to their own
`/parent/*` / `/teacher/*` route surface and never granted access to any
staff-facing endpoint.

## Project Layout

```
src/
  modules/     One directory per domain module (students, tuition,
               attendance, ledger, parent, teacher, analytics, ...)
  common/      Guards, decorators, filters, logging, authorization
               (Role/Permission), and shared events
  database/    TypeORM migrations, data source config, seed script
  config/      Environment variable validation
test/          E2E test suite (see docs/testing/TESTING.md)
docs/          Project documentation (see below)
```

## Documentation

Documentation lives under `docs/`, grouped by kind:

- [`docs/architecture/`](docs/architecture) — financial/domain
  architecture decisions and the analytics dashboard.
- [`docs/development-history/`](docs/development-history) — the
  incremental "Phase 5" feature history (parent portal, attendance,
  assessments, teacher portal, announcements, and onward).
- [`docs/security/`](docs/security) — known authorization gaps and their
  current status.
- [`docs/deployment/`](docs/deployment) — environment variables, health
  checks, logging, and Docker.
- [`docs/testing/`](docs/testing) — how to run and what each test suite
  proves.
- [`docs/reports/`](docs/reports) — documentation audit, structure, and
  coverage reports for this repository.

Not every increment of this project has a dedicated document — small
bug fixes and refactors are intentionally left undocumented, or folded
into the nearest related document, rather than given a file of their
own. See
[`docs/reports/DOCUMENTATION_COVERAGE_REPORT.md`](docs/reports/DOCUMENTATION_COVERAGE_REPORT.md)
for what is and isn't documented, and why.
