# Backup & Restore

Protects against accidental deletion, database corruption, server failure,
and deployment mistakes by taking regular, verified, compressed backups of
the application's PostgreSQL database — the same database `DATABASE_URL`
points at.

Scripts: `scripts/backup.sh`, `scripts/restore.sh`, both plain bash. No new
runtime dependency is required for the mandatory (local) path; the optional
S3-compatible path shells out to the `aws` CLI if you choose to configure it
(no SDK, no extra package).

## What is covered — and what is not

**Covered:** the PostgreSQL database (schema + data) at `DATABASE_URL`, via
`pg_dump`. This includes every table this project's TypeORM
migrations manage — tuition, students, attendance, homework, etc.

**Not covered** by these scripts:
- `.env` files or any other secrets — never included in a backup or
  uploaded anywhere by these scripts.
- Uploaded files (e.g. avatar images under `AVATAR_UPLOAD_DIR` /
  the `avatar-uploads` volume) — back these up separately if needed
  (e.g. a volume snapshot or a simple `tar` of that directory).
- Redis data (job queue / cache) — treated as disposable by design; nothing
  durable is expected to live only in Redis.
- Anything outside this one Postgres database (other services, the app
  image itself, infrastructure config).

## How the scripts reach Postgres

The reference `docker-compose.yml` deployment doesn't expose Postgres's
port to the host, and the app's own image intentionally doesn't bundle
`pg_dump`/`psql` (avoiding version drift and image bloat). So both scripts
support two modes, auto-detected by `BACKUP_MODE=auto` (the default):

- **`docker`** — runs `pg_dump`/`psql` *inside* the already-running
  `postgres` compose service via `docker compose exec`, guaranteed to match
  the server's own version exactly. Used automatically when that service is
  running.
- **`direct`** — runs a local `pg_dump`/`psql` binary directly against
  `DATABASE_URL`. Used automatically when the `postgres` compose service
  isn't running (bare-metal Node, or a managed database like RDS/Cloud
  SQL) and a local client is available.

You can force either with `BACKUP_MODE=docker` or `BACKUP_MODE=direct`.

## Configuring backups

All configuration is via environment variables. Only `DATABASE_URL`
(already required by the app) is mandatory.

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | yes | — | Same value the app uses |
| `BACKUP_DIR` | no | `backend/backups` | Where local backups are written |
| `BACKUP_RETENTION_DAYS` | no | `14` | Local backups older than this are deleted. `0` disables cleanup |
| `BACKUP_NAME_PREFIX` | no | `tuitionschool` | Filename prefix |
| `BACKUP_MODE` | no | `auto` | `auto` \| `docker` \| `direct` |
| `S3_ENDPOINT` | no | — | S3-compatible endpoint URL (omit for AWS S3 itself) |
| `S3_BUCKET` | no | — | Setting this enables the optional offsite upload |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | no | — | Credentials for the upload, used only in that one subprocess call, never logged |

Backups run and succeed fully with **none** of the `S3_*` variables set —
S3 is strictly opt-in. If you do set `S3_BUCKET`, the `aws` CLI must be
installed wherever the script runs; the script fails loudly (exit `2`) if
it's missing, rather than silently skipping a backup you asked for.

## Running a backup manually

```bash
cd backend
./scripts/backup.sh
```

Backups are named `<prefix>_<UTC timestamp>.sql.gz`, e.g.
`tuitionschool_20260722T030000Z.sql.gz`, written with `chmod 600` (owner-only
readable — these can contain student/school data).

### Example cron entry

Run nightly at 03:00 server time, logging to a dedicated file:

```cron
0 3 * * * cd /opt/tuitionschool/backend && DATABASE_URL='postgres://...' BACKUP_DIR=/var/backups/tuitionschool ./scripts/backup.sh >> /var/log/tuitionschool-backup.log 2>&1
```

In practice, put `DATABASE_URL` (and any `S3_*` vars) in a root-only
readable env file and `source` it instead of inlining the connection
string in the crontab, so it doesn't show up in `crontab -l` output or
process listings:

```cron
0 3 * * * cd /opt/tuitionschool/backend && set -a && . /etc/tuitionschool-backup.env && set +a && ./scripts/backup.sh >> /var/log/tuitionschool-backup.log 2>&1
```

We recommend **host cron** over a dedicated cron sidecar container for this
project's current single-VM docker-compose deployment: a sidecar would need
`/var/run/docker.sock` mounted into it to reach the `postgres` service via
`docker compose exec`, which is a meaningfully larger privilege-escalation
surface than a one-line crontab entry on a host that already runs Docker to
serve the app. If this project later moves to Kubernetes or a managed
platform, a `CronJob` / the platform's native scheduled-task feature is the
better fit at that point — not before.

### S3-compatible offsite copy (optional)

If `S3_BUCKET` is set, `backup.sh` also uploads the compressed dump via
`aws s3 cp` (using `--endpoint-url "$S3_ENDPOINT"` for non-AWS providers
like MinIO, Backblaze B2, DigitalOcean Spaces, etc.). For retention of
*remote* copies, prefer your provider's native bucket lifecycle rules over
re-implementing remote pruning in bash — nearly every S3-compatible
provider supports this natively, and it removes an entire class of "did the
cleanup script actually delete the right remote objects" risk.

## Restoring

**This is destructive.** The backup is taken with `pg_dump --clean
--if-exists`, so restoring it drops and recreates the database's objects
before reloading data — anything in the target database that isn't in the
backup is lost.

```bash
cd backend
./scripts/restore.sh --file backups/tuitionschool_20260722T030000Z.sql.gz
```

- Lists available backups if `--file` is omitted.
- Validates the file (exists, non-empty, passes `gzip -t`, and looks like a
  real `pg_dump` output) *before* touching the database.
- Prints a clear warning and requires you to type `RESTORE` (all caps) to
  proceed — skip this with `--force` only inside a documented,
  already-reviewed disaster-recovery runbook.
- By default, takes an automatic safety backup of the *current* database
  before restoring (skip with `--no-pre-backup` if you understand the
  risk — e.g. the current database is already known to be corrupt).
- Uses `psql -v ON_ERROR_STOP=1`, so any SQL error aborts the restore
  immediately with a non-zero exit and visible error, instead of silently
  continuing partway through.

If a restore fails partway through, the pre-restore safety backup (unless
skipped) lets you get back to the exact state you started from.

## Recovery procedure

1. Confirm the incident: what's actually wrong (accidental deletion,
   corruption, hardware failure, bad deployment)? Check
   `GET /api/v1/health` first — a red readiness check with the app
   otherwise up often means Postgres/Redis connectivity, not necessarily
   data loss.
2. Pick the right backup. `ls -la backups/` (or your `BACKUP_DIR`) to see
   what's available and how recent it is relative to the incident.
3. If the app is still serving traffic, take it out of rotation (or at
   least stop write traffic) before restoring — a restore mid-traffic can
   race with new writes.
4. Run `./scripts/restore.sh --file <chosen backup>` and follow its
   prompts.
5. Verify: `GET /api/v1/health`, then spot-check a few real records
   (e.g. a known student/tuition record) before resuming traffic.
6. Resume traffic and monitor. Note the timestamp of the restored backup
   somewhere visible — anything written between that timestamp and the
   incident is gone unless it can be reconstructed from other sources.

## RPO / RTO expectations

These are properties of *how you schedule and store* backups, not
something the scripts enforce — stated here so they're explicit rather
than assumed.

- **RPO (Recovery Point Objective)** — with the nightly cron example above,
  RPO is **up to 24 hours**: worst case, you lose everything written since
  the last successful nightly backup. Run `backup.sh` more often (e.g.
  hourly) to shrink this window; the tradeoff is more storage and more
  `pg_dump` load on Postgres per run.
- **RTO (Recovery Time Objective)** — dominated by how long the restore
  itself takes, which scales with database size, plus the time to notice
  the incident and choose the right backup. For a database this size, a
  full `restore.sh` run itself is typically well under a few minutes; total
  RTO in practice is usually operator response time, not script runtime.
- Backups stored **only** in `BACKUP_DIR` on the same host as Postgres
  protect against accidental deletion and corruption, but **not** against
  that host's total failure. If server failure is a concern, configure the
  optional S3-compatible upload (or otherwise ship `BACKUP_DIR` off-host)
  so an offsite copy exists.
