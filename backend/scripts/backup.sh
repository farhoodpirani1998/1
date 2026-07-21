#!/usr/bin/env bash
#
# Backup the application's PostgreSQL database (the same one DATABASE_URL
# points at) to a timestamped, gzip-compressed, plain-SQL dump.
#
# Usage:
#   ./scripts/backup.sh
#
# Config (env vars, all except DATABASE_URL are optional):
#   DATABASE_URL           Required. Same value the app uses.
#   BACKUP_DIR              Default: ./backups (relative to this script's
#                            parent directory, i.e. backend/backups)
#   BACKUP_RETENTION_DAYS   Default: 14. Set to 0 to disable cleanup.
#   BACKUP_NAME_PREFIX       Default: tuitionschool
#   BACKUP_MODE              auto (default) | docker | direct — see
#                            backup-common.sh for what each means.
#   S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY
#                            Optional. If S3_BUCKET is set, the backup is
#                            also uploaded via the `aws` CLI. Unset (default)
#                            = local-only backup, no S3 dependency at all.
#
# Exit codes:
#   0  success (local backup ok; S3 upload ok or not configured)
#   1  local backup failed — nothing usable was produced
#   2  local backup succeeded, but the configured S3 upload failed
#
# What this backs up: the DATABASE_URL database only (schema + data via
# pg_dump). What it does NOT back up: .env files, uploaded avatar files,
# Redis data, or anything outside Postgres. See
# docs/deployment/BACKUP_RESTORE.md for the full scope and recovery
# procedure.

set -euo pipefail

SCRIPT_NAME="backup"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./backup-common.sh
source "$SCRIPT_DIR/backup-common.sh"

: "${BACKUP_DIR:=$SCRIPT_DIR/../backups}"
: "${BACKUP_RETENTION_DAYS:=14}"
: "${BACKUP_NAME_PREFIX:=tuitionschool}"

require_database_url

# Sanity guard for the retention cleanup step below — never operate on an
# empty/root path no matter how BACKUP_DIR ends up misconfigured.
if [ -z "$BACKUP_DIR" ] || [ "$BACKUP_DIR" = "/" ]; then
  fail "Refusing to use BACKUP_DIR='$BACKUP_DIR' — looks unsafe."
fi

mkdir -p "$BACKUP_DIR"

MODE="$(resolve_mode)"
log "Starting backup (mode: $MODE, target: $(redact_url "$DATABASE_URL"))"

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILENAME="${BACKUP_NAME_PREFIX}_${TIMESTAMP}.sql.gz"
TMP_PATH="$BACKUP_DIR/.${FILENAME}.tmp"
FINAL_PATH="$BACKUP_DIR/${FILENAME}"

cleanup_tmp() {
  rm -f "$TMP_PATH" 2>/dev/null || true
}
trap cleanup_tmp EXIT

# --clean --if-exists: dump includes DROP-then-CREATE statements, so
# restoring onto an existing database resets it cleanly without a manual
# pre-step. See restore.sh, which requires explicit confirmation because of
# exactly this.
if ! run_pg_dump --format=plain --clean --if-exists | gzip -9 > "$TMP_PATH"; then
  fail "pg_dump failed. No backup file was produced."
fi

# --- verify before trusting the file --------------------------------------
if [ ! -s "$TMP_PATH" ]; then
  fail "Backup file is empty after dump — refusing to keep it."
fi

if ! gzip -t "$TMP_PATH" 2>/dev/null; then
  fail "Backup file failed gzip integrity check — refusing to keep it."
fi

mv "$TMP_PATH" "$FINAL_PATH"
# Backups can contain sensitive school/student data — keep them
# non-world-readable regardless of the host's default umask.
chmod 600 "$FINAL_PATH"

SIZE_HUMAN="$(du -h "$FINAL_PATH" | cut -f1)"
log "Backup OK: $FINAL_PATH ($SIZE_HUMAN)"

# --- retention cleanup -----------------------------------------------------
if [ "$BACKUP_RETENTION_DAYS" -gt 0 ] 2>/dev/null; then
  log "Pruning local backups older than $BACKUP_RETENTION_DAYS day(s)..."
  # Scoped to this exact prefix/suffix and maxdepth 1 — never a broad rm.
  find "$BACKUP_DIR" -maxdepth 1 -type f \
    -name "${BACKUP_NAME_PREFIX}_*.sql.gz" \
    -mtime "+${BACKUP_RETENTION_DAYS}" \
    -print -delete | while read -r removed; do
      log "Removed old backup: $removed"
    done
else
  log "BACKUP_RETENTION_DAYS=$BACKUP_RETENTION_DAYS — retention cleanup disabled."
fi

# --- optional S3-compatible upload -----------------------------------------
# Deliberately no AWS SDK / extra npm or pip package: this shells out to the
# `aws` CLI (works against any S3-compatible endpoint via --endpoint-url) if
# and only if S3_BUCKET is configured. Nothing here runs, or is required,
# when S3_* is unset.
if [ -n "${S3_BUCKET:-}" ]; then
  log "S3_BUCKET is set — uploading to S3-compatible storage..."
  if ! command -v aws >/dev/null 2>&1; then
    log "ERROR: S3_BUCKET is configured but the 'aws' CLI is not installed. Local backup is safe at $FINAL_PATH; offsite copy was skipped."
    exit 2
  fi

  S3_ARGS=(s3 cp "$FINAL_PATH" "s3://${S3_BUCKET}/${FILENAME}")
  [ -n "${S3_ENDPOINT:-}" ] && S3_ARGS+=(--endpoint-url "$S3_ENDPOINT")

  # Credentials are exported only into this one subprocess's environment,
  # never echoed, and never passed as CLI arguments (which would leak into
  # `ps` output).
  if AWS_ACCESS_KEY_ID="${S3_ACCESS_KEY:-}" AWS_SECRET_ACCESS_KEY="${S3_SECRET_KEY:-}" \
      aws "${S3_ARGS[@]}" >/dev/null 2>&1; then
    log "S3 upload OK: s3://${S3_BUCKET}/${FILENAME}"
  else
    log "ERROR: S3 upload failed. Local backup is safe at $FINAL_PATH; offsite copy did not complete."
    exit 2
  fi
else
  log "S3_BUCKET not set — local-only backup (this is fully supported)."
fi

log "Backup complete."
