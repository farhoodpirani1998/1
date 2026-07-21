#!/usr/bin/env bash
#
# Restore the application's PostgreSQL database from a backup produced by
# backup.sh. THIS IS DESTRUCTIVE: the dump was taken with --clean --if-exists,
# so restoring it drops and recreates the database's objects before
# reloading data.
#
# Usage:
#   ./scripts/restore.sh --file backups/tuitionschool_20260722T120000Z.sql.gz
#   ./scripts/restore.sh --file <path> --force            # skip confirmation
#   ./scripts/restore.sh --file <path> --no-pre-backup     # skip safety backup
#   ./scripts/restore.sh                                    # lists available backups
#
# Config (env vars):
#   DATABASE_URL   Required. Same value the app uses. THIS is the database
#                  that will be overwritten.
#   BACKUP_DIR     Default: ./backups — used only to list backups when
#                  --file is omitted.
#   BACKUP_MODE    auto (default) | docker | direct — see backup-common.sh.
#
# Exit codes:
#   0  restore completed
#   1  aborted, validation failed, or restore itself failed

set -euo pipefail

SCRIPT_NAME="restore"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./backup-common.sh
source "$SCRIPT_DIR/backup-common.sh"

: "${BACKUP_DIR:=$SCRIPT_DIR/../backups}"

FILE=""
FORCE=0
PRE_BACKUP=1

usage() {
  cat <<'EOF'
Usage: restore.sh --file <path-to-backup.sql.gz> [--force] [--no-pre-backup]

  --file <path>     Backup file to restore (required).
  --force           Skip the typed confirmation prompt. Use only in
                     scripted/documented disaster-recovery runbooks.
  --no-pre-backup   Skip taking an automatic safety backup of the current
                     database before restoring. Default is to take one.
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --file) FILE="${2:-}"; shift 2 ;;
    --force) FORCE=1; shift ;;
    --no-pre-backup) PRE_BACKUP=0; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage; exit 1 ;;
  esac
done

require_database_url

if [ -z "$FILE" ]; then
  echo "No --file given. Available backups in $BACKUP_DIR:" >&2
  if [ -d "$BACKUP_DIR" ]; then
    find "$BACKUP_DIR" -maxdepth 1 -type f -name '*.sql.gz' -printf '%T@ %p\n' 2>/dev/null \
      | sort -n | cut -d' ' -f2- \
      || ls -1 "$BACKUP_DIR"/*.sql.gz 2>/dev/null
  fi
  echo >&2
  usage
  exit 1
fi

# --- validate the backup file before doing anything destructive -----------
if [ ! -f "$FILE" ]; then
  fail "Backup file not found: $FILE"
fi
if [ ! -s "$FILE" ]; then
  fail "Backup file is empty: $FILE"
fi
if ! gzip -t "$FILE" 2>/dev/null; then
  fail "Backup file failed gzip integrity check: $FILE"
fi
if ! zcat "$FILE" 2>/dev/null | head -n 20 | grep -q "PostgreSQL database dump"; then
  fail "File doesn't look like a pg_dump plain-SQL dump (missing expected header): $FILE"
fi
log "Backup file validated: $FILE"

MODE="$(resolve_mode)"
TARGET_DESC="$(redact_url "$DATABASE_URL")"

echo
echo "=========================================================="
echo " DESTRUCTIVE OPERATION"
echo "=========================================================="
echo " This will DROP and RECREATE objects in the target database,"
echo " then reload all data from:"
echo "   $FILE"
echo " Target database: $TARGET_DESC"
echo " Mode: $MODE"
echo " Any data currently in the target database that isn't in this"
echo " backup WILL BE LOST."
echo "=========================================================="
echo

if [ "$FORCE" -ne 1 ]; then
  read -r -p "Type RESTORE (all caps) to continue, anything else aborts: " CONFIRM
  if [ "$CONFIRM" != "RESTORE" ]; then
    log "Aborted — confirmation not given."
    exit 1
  fi
else
  log "--force given, skipping interactive confirmation."
fi

if [ "$PRE_BACKUP" -eq 1 ]; then
  log "Taking a safety backup of the current database before restoring..."
  if ! BACKUP_NAME_PREFIX="pre-restore-safety" "$SCRIPT_DIR/backup.sh"; then
    fail "Pre-restore safety backup failed. Aborting restore without touching the database. Re-run with --no-pre-backup only if you understand the risk."
  fi
else
  log "Skipping pre-restore safety backup (--no-pre-backup given)."
fi

log "Restoring from $FILE ..."
if gunzip -c "$FILE" | run_psql; then
  log "Restore completed successfully."
else
  fail "Restore failed partway through. The target database may be in a partial state — restore the pre-restore safety backup if one was taken, and investigate before retrying."
fi

log "Done. Verify application health (e.g. GET /api/v1/health) before resuming traffic."
