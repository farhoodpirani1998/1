# Backup & Restore

Protects against accidental deletion, database corruption, server failure,
and deployment mistakes by taking regular, verified, compressed backups of
the application's PostgreSQL database — the same database `DATABASE_URL`
points at.

Scripts: `scripts/backup.sh` / `scripts/restore.sh` (database) and
`scripts/backup-avatars.sh` (avatar files), all plain bash. No new runtime
dependency is required for the mandatory (local) path; the optional
S3-compatible path in `backup.sh` shells out to the `aws` CLI if you choose
to configure it (no SDK, no extra package).

## What is covered — and what is not

**Covered:**
- The PostgreSQL database (schema + data) at `DATABASE_URL`, via
  `pg_dump` (`backup.sh`). This includes every table this project's
  TypeORM migrations manage — tuition, students, attendance, homework,
  etc.
- Avatar files under `AVATAR_UPLOAD_DIR` (`backup-avatars.sh`), as a
  permission-preserving `tar.gz` archive.

**Not covered** by these scripts:
- `.env` files or any other secrets — never included in a backup or
  uploaded anywhere by these scripts.
- Redis data (job queue / cache) — treated as disposable by design; nothing
  durable is expected to live only in Redis.
- Anything outside Postgres and the avatar directory (other services, the
  app image itself, infrastructure config).

There is currently no restore script for avatars (the reverse of
`backup-avatars.sh`) — restoring is a manual `tar -xzpf` step, documented
below. This is deliberate: an automated avatar-restore script would need
to make the same kind of destructive-overwrite decisions `restore.sh`
already makes carefully for the database, and duplicating that judgment
call for a lower-stakes asset (photos, not student data) hasn't been
justified yet.

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

`backup-avatars.sh` has its own, separate set of variables:

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `AVATAR_UPLOAD_DIR` | no | `backend/uploads/avatars` | Directory to archive. In `docker-compose.yml` this is set to `/data/avatars` (the mounted volume) — use the same value here when backing up that deployment |
| `BACKUP_DIR` | no | `backend/backups` (same default as `backup.sh`) | Where the avatar archive is written. Deliberately reuses `backup.sh`'s default so DB and avatar backups land side by side unless you've already pointed `BACKUP_DIR` elsewhere |
| `BACKUP_RETENTION_DAYS` | no | `14` | Same semantics as `backup.sh`, applied to `*.tar.gz` files instead of `*.sql.gz` |
| `BACKUP_NAME_PREFIX` | no | `tuitionschool-avatars` | Filename prefix |

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

## Running an avatar backup manually

```bash
cd backend
AVATAR_UPLOAD_DIR=/data/avatars ./scripts/backup-avatars.sh
```

(Omit `AVATAR_UPLOAD_DIR` if running outside Docker with the default
`uploads/avatars` path — see the table above.)

Archives are named `<prefix>_<UTC timestamp>.tar.gz`, e.g.
`tuitionschool-avatars_20260722T030500Z.tar.gz`, written with `chmod 600`
and permissions/ownership preserved inside the archive (`tar -czp`), same
non-world-readable policy as database backups — these are photos of real
students and staff.

The script fails loudly (exit `1`) if `AVATAR_UPLOAD_DIR` doesn't exist,
rather than silently producing an empty or misleading archive.

### Example cron entry (avatars)

Run nightly, just after the database backup, logging to its own file:

```cron
5 3 * * * cd /opt/tuitionschool/backend && set -a && . /etc/tuitionschool-backup.env && set +a && ./scripts/backup-avatars.sh >> /var/log/tuitionschool-avatar-backup.log 2>&1
```

Staggering it 5 minutes after the `backup.sh` cron entry (see above) keeps
the two jobs from contending over disk I/O on the same nightly window;
they're otherwise fully independent and can run in either order or in
parallel without conflict.

## Restoring

**This is destructive** for the database restore. The backup is taken with `pg_dump --clean
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

### Restoring avatars

There's no script for this — it's a plain `tar` extraction. Run it
**after** the database restore (see "Restore order" below), since the
database is the source of truth for which avatar filenames/URLs
(`users.avatar_url`) are actually expected to exist.

```bash
cd backend
# Stop the app first if it's running, so nothing writes new avatars
# mid-restore.
mv /data/avatars /data/avatars.bak-before-restore   # optional safety copy
mkdir -p /data/avatars
tar -xzpf backups/tuitionschool-avatars_20260722T030500Z.tar.gz \
  -C /data --strip-components=1
```

Adjust the archive path/name and `/data/avatars` to match your
`AVATAR_UPLOAD_DIR`. `-p` restores original permissions; `--strip-components=1`
accounts for the archive storing the `avatars/` directory itself (see
`backup-avatars.sh`'s tar invocation) rather than its contents directly.

### Restore order

When recovering from a combined failure (both DB and avatars lost or
corrupted), restore in this order:

1. **Restore the database first** (`./scripts/restore.sh --file <...>`).
   The database defines which users/students exist and what their
   `avatar_url` values point to — restoring it first gives you the
   authoritative list to reconcile avatar files against.
2. **Restore avatar files second** (the `tar -xzpf` step above). If some
   filenames referenced by the just-restored database aren't present in
   the avatar archive (e.g. an avatar uploaded after that archive's
   timestamp), those users simply fall back to the app's default
   avatar/initials — no error, no broken deploy, just a slightly stale
   photo until the user re-uploads.

Restoring avatars *before* the database risks the opposite mismatch: files
for users that don't exist yet, or missing files for users the old
database still expects — harmless either way, but restoring DB-first
keeps the reconciliation direction simple and one-way.

## Recovery procedure

1. Confirm the incident: what's actually wrong (accidental deletion,
   corruption, hardware failure, bad deployment)? Check
   `GET /api/v1/health` first — a red readiness check with the app
   otherwise up often means Postgres/Redis connectivity, not necessarily
   data loss.
2. Pick the right backups. `ls -la backups/` (or your `BACKUP_DIR`) to see
   what's available — both `tuitionschool_*.sql.gz` (database) and
   `tuitionschool-avatars_*.tar.gz` (avatars) — and how recent each is
   relative to the incident. They don't need to share a timestamp, but
   note the gap between them if they don't.
3. If the app is still serving traffic, take it out of rotation (or at
   least stop write traffic) before restoring — a restore mid-traffic can
   race with new writes.
4. Restore the database: `./scripts/restore.sh --file <chosen backup>`,
   follow its prompts. Then restore avatars (see "Restoring avatars"
   above) if that's also part of the incident. See "Restore order" for
   why the database goes first.
5. Verify using the checklist below before resuming traffic.
6. Resume traffic and monitor. Note the timestamp(s) of the restored
   backup(s) somewhere visible — anything written between that timestamp
   and the incident is gone unless it can be reconstructed from other
   sources.

### Verification checklist

Run through this before resuming traffic, regardless of which parts were
restored:

- [ ] `GET /api/v1/health` returns healthy (Postgres + Redis connectivity).
- [ ] Spot-check a few real records (e.g. a known student/tuition record)
      exist and look correct in the database.
- [ ] Log in as a test/known user and confirm authentication works
      (catches a bad/partial DB restore early).
- [ ] Spot-check a few user profiles with avatars — confirm images load,
      not broken links. A missing avatar (falling back to initials) is
      expected and fine if the avatar archive predates the incident;
      a *broken image* (file referenced but 404) is not and points to a
      skipped or failed avatar restore step.
- [ ] Confirm the restored database's row counts for a couple of key
      tables (students, users) are in the expected ballpark, not
      suspiciously low (a sign of restoring a too-old or wrong backup).
- [ ] Note the restored backup's timestamp(s) somewhere the team can see,
      so anyone investigating later knows the recovery point.

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
- The same applies to avatar backups: `backup-avatars.sh` has no built-in
  offsite upload (unlike `backup.sh`'s optional S3 path), so if avatars
  matter for your recovery target, ship `BACKUP_DIR` off-host yourself
  (e.g. the same volume snapshot or sync job you might already use for
  `BACKUP_DIR` generally) — see "Optional automation" below for one way
  to do that without hand-rolling anything bespoke.

## Suggested schedule and retention

These are starting points, not enforced by the scripts — adjust to your
actual write volume and storage budget:

- **Schedule:** nightly for both database and avatars, staggered a few
  minutes apart (see the cron examples above). Increase database
  frequency (e.g. hourly) if your RPO tolerance is tighter than 24h;
  avatars change far less often than the database, so nightly is
  usually generous there even if you tighten the DB schedule.
- **Retention:** the scripts' own `BACKUP_RETENTION_DAYS` default (14
  days, local) is a reasonable floor for both. If you also configure
  offsite storage (S3 for the database, or a synced/snapshotted
  `BACKUP_DIR` for avatars — see above), let the offsite retention run
  longer (e.g. 30-90 days) than the local copy, since offsite storage is
  cheap relative to the cost of discovering a slow-to-notice data problem
  after local retention already expired.

## Optional automation (example only — not enabled by default)

Everything above assumes host cron, which is already the recommended
approach for this project's current single-VM `docker-compose.yml`
deployment (see the reasoning under "Running a backup manually"). The
following is one additional option if you'd rather manage both jobs as a
single systemd unit instead of two crontab lines — entirely optional, and
not wired into any file the app or its Docker Compose files load by
default.

```ini
# /etc/systemd/system/tuitionschool-backup.service (example — not installed
# by default; copy and enable manually if you want this instead of cron)
[Unit]
Description=TuitionSchool database + avatar backup
After=docker.service

[Service]
Type=oneshot
WorkingDirectory=/opt/tuitionschool/backend
EnvironmentFile=/etc/tuitionschool-backup.env
ExecStart=/opt/tuitionschool/backend/scripts/backup.sh
ExecStart=/opt/tuitionschool/backend/scripts/backup-avatars.sh
```

```ini
# /etc/systemd/system/tuitionschool-backup.timer (example — pair with the
# .service unit above)
[Unit]
Description=Run TuitionSchool backup nightly

[Timer]
OnCalendar=*-*-* 03:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

Enable with `systemctl enable --now tuitionschool-backup.timer` if you
choose this path — nothing here runs unless you take that step yourself.
This is presented as an alternative to cron, not an addition to it; running
both would just back up twice.
