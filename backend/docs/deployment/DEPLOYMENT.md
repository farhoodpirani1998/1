# Deployment / Production Readiness

Covers what Phase 4B added: observability, health checks, environment
validation, and Docker packaging. For prior hardening (auth, tenant
isolation, reliability, performance), see
[`../architecture/ARCHITECTURE_CHANGES.md`](../architecture/ARCHITECTURE_CHANGES.md)
and [`../security/security-roadmap.md`](../security/security-roadmap.md).

## Environment variables

See `.env.example` for the full list with inline comments. Validated at
boot by `src/config/env.validation.ts` (wired via `ConfigModule.forRoot`'s
`validate` option in `app.module.ts`) — an invalid or missing required
variable throws before any module (DB pool, Redis, HTTP server) starts
initializing.

Required in **every** environment:
- `DATABASE_URL`
- `JWT_SECRET`

Required only when `NODE_ENV=production` (the app fails fast at boot if
missing — this does not affect `npm run start:dev`):
- `CORS_ORIGINS` — comma-separated allow-list (already enforced separately
  in `main.ts` too; the env validator just catches it earlier).
- `REDIS_HOST` — no silent fallback to `localhost` in production.
- `REDIS_PASSWORD` — Redis has no auth by default; this is required so
  BullMQ and the readiness probe's Redis check always connect
  authenticated, and so `docker-compose.yml`'s `redis` service always
  boots with `--requirepass` rather than being open to anyone who can
  reach the port.
- `JWT_SECRET` must additionally be **at least 32 characters**.

Optional, with sane defaults: `REDIS_PORT` (6379), `PORT` (3000),
`LOG_LEVEL` (`info` in production, `debug` otherwise). `REDIS_PASSWORD` is
optional outside production (local dev Redis can run unauthenticated).
`ENABLE_SWAGGER` defaults to disabled everywhere — see
[API documentation (Swagger)](#api-documentation-swagger) below.
`SENTRY_DSN` / `SENTRY_ENVIRONMENT` default to unset (Sentry reporting
off) everywhere — see [Error reporting (Sentry)](#error-reporting-sentry)
below.

## Structured logging & request correlation

- All logs are structured JSON (via `pino`), emitted through
  `src/common/logging/app-logger.service.ts`, which is registered as
  Nest's app-wide logger in `main.ts`. Every existing `new Logger(name)`
  call site is unchanged — Nest transparently routes them through this
  logger once it's registered.
- Every inbound HTTP request gets a `requestId` (reused from an incoming
  `X-Request-Id` header if present and well-formed, otherwise generated).
  It's returned on the response as `X-Request-Id` and included in:
  - every log line emitted while handling that request (via
    `AsyncLocalStorage`, see `src/common/logging/request-context.ts`),
  - the JSON body of any error response (`AllExceptionsFilter`).
- Once a request is authenticated, `userId`, `schoolId`, and `role` are
  added to the same context (`UserContextInterceptor`) and appear in
  subsequent log lines for that request — no per-service code changes
  required.
- One access-log line per completed request (method, path, status,
  duration) is emitted by `HttpLoggerMiddleware`.
- In development, logs are pretty-printed via `pino-pretty` (a
  devDependency — never present in the production image). In production
  they're plain JSON, suitable for ingestion by any log aggregator
  (CloudWatch, Datadog, Loki, ELK, etc.) that expects one JSON object per
  line.

## Error reporting (Sentry)

Unexpected server errors (5xx / programming errors — not validation
failures or deliberate `HttpException`s like `NotFoundException`) are
additionally reported to Sentry, alongside the existing `pino` logs —
Sentry does not replace or reduce anything already logged.

**Required environment variables** (both optional — see `.env.example`):

| Variable | Purpose |
|---|---|
| `SENTRY_DSN` | Your Sentry project's DSN. Unset = Sentry reporting is entirely off. |
| `SENTRY_ENVIRONMENT` | Tag applied to reported errors (e.g. `production`, `staging`). Falls back to `NODE_ENV`, then `development`, if unset. |

**Local behavior:** with `SENTRY_DSN` unset (the default in
`.env.example`), `Sentry.init()` is never called and the app runs exactly
as it did before this feature — no network calls to Sentry, no
performance overhead, no crash risk from a missing/invalid DSN.

**Production behavior:** set `SENTRY_DSN` (and `SENTRY_ENVIRONMENT=production`)
to start reporting unexpected errors. Each reported error is tagged with
the same `requestId`, `userId`, `schoolId`, and `role` already attached to
that request's logs (see above), so a Sentry issue can be cross-referenced
with the corresponding log lines.

Out of scope for this integration (deferred to future infrastructure
work): performance monitoring, tracing, profiling, session replay,
release tracking, and source map upload. `tracesSampleRate` is explicitly
set to `0`.

## Health checks

Provided by `src/modules/health` (`@nestjs/terminus`), all public (no auth
required — the same way any other infra health endpoint works) and
exempt from the global rate limiter (`@SkipThrottle()`):

| Endpoint | Checks | Use for |
|---|---|---|
| `GET /api/v1/health/live` | process responsiveness only | Kubernetes liveness probe |
| `GET /api/v1/health/ready` | PostgreSQL + Redis reachability | Kubernetes readiness probe / LB health check |
| `GET /api/v1/health` | PostgreSQL + Redis reachability | general-purpose uptime monitor |

`/live` intentionally checks nothing external, so a transient DB/Redis
blip doesn't cause an orchestrator to kill and restart an otherwise-healthy
instance — that's what `/ready` is for.

## API documentation (Swagger)

Interactive OpenAPI docs are generated by `@nestjs/swagger` from the same
controllers/DTOs that serve real traffic (`src/config/swagger.config.ts`),
so they can't drift from the actual request/response shapes the way a
hand-written doc can.

**Access:** once enabled (see below), the UI is at `GET /api/v1/docs`, and
the raw OpenAPI JSON at `GET /api/v1/docs-json` (e.g. to generate a typed
frontend client or import into Postman/Insomnia). Protected endpoints are
marked with a lock icon; click **Authorize** and paste the access token
from `POST /api/v1/auth/login` (no `Bearer ` prefix needed in the dialog).

**Enable/disable:** controlled by a single env var, `ENABLE_SWAGGER`.
Only the exact string `true` enables it — unset, `false`, or any typo all
mean disabled, in every environment (`NODE_ENV` is not consulted). This
is deliberate: there's no "on by default in dev" behavior to accidentally
carry into production via a copied `.env` file.

```bash
# .env
ENABLE_SWAGGER=true
```

When enabled, the app logs a `warn`-level line at boot naming the exact
path and environment, so an accidentally-enabled instance is visible in
logs/alerting rather than silent.

**Production recommendation:** leave `ENABLE_SWAGGER` unset (disabled) in
production. `/api/v1/docs` has no authentication of its own — anyone who
can reach it can read every route, DTO field, and validation rule in the
API, which is unnecessary attack-surface for an internal-tooling reference
that's more useful in development anyway. If interactive prod docs are
genuinely needed (e.g. for a partner integration), put the path behind
the reverse proxy's own auth (e.g. basic auth at the load balancer) rather
than exposing it directly, and treat enabling it as a deliberate,
reviewed decision — not a default.

## Docker

- `Dockerfile` — multi-stage build (`builder` → compiles TypeScript,
  `deps` → production-only `node_modules`, `runtime` → minimal Alpine
  image running as the non-root `node` user). Includes a `HEALTHCHECK`
  hitting `/api/v1/health/live`.
- `docker-compose.yml` — reference stack (app + Postgres + Redis) for
  self-hosted / single-VM deployments. If deploying to Kubernetes or a
  managed platform, use it as a reference for required env vars and
  healthcheck wiring rather than running it directly.
- `.dockerignore` — excludes `node_modules`, `dist`, tests, docs, and any
  `.env*` file (secrets are passed at run time, never baked into a layer).

```bash
cp .env.example .env   # fill in real values — see comments in the file
docker compose up -d --build
docker compose exec app npm run migration:run   # once, before serving traffic
```

Migrations are **never** run automatically on container start
(`migrationsRun: false` in `app.module.ts`, unchanged from Phase 1) — run
them explicitly as a one-off step before rolling out a new image, the same
way `npm run migration:run` works outside Docker.

## Backup & restore

Database backup and restore is covered separately in
[`BACKUP_RESTORE.md`](BACKUP_RESTORE.md) — covers `scripts/backup.sh` /
`scripts/restore.sh`, cron scheduling, the recovery procedure, and RPO/RTO
expectations.

## Production-safe defaults reviewed in this phase

- **`trust proxy`** is enabled in production (`main.ts`) so Express (and
  therefore `ThrottlerGuard`'s per-IP limiting, and `req.ip` in logs) sees
  the real client IP through a reverse proxy/load balancer instead of the
  proxy's own address.
- **Graceful shutdown**: `app.enableShutdownHooks()` lets Nest close the
  Postgres pool, Redis connections, and in-flight BullMQ work cleanly on
  `SIGTERM`/`SIGINT` (container stop, rolling deploy) instead of the
  process being killed mid-request.
- **CORS_ORIGINS fail-fast** (existing Phase-1/2 behavior in `main.ts`) is
  preserved unchanged; environment validation now also catches a missing
  value earlier, before the HTTP layer even starts.
