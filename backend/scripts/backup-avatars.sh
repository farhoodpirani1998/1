#!/usr/bin/env bash
#
# Backup the application's avatar upload directory (whatever
# AVATAR_UPLOAD_DIR / resolveAvatarUploadDir() in
# src/common/storage/avatar-storage.service.ts points at) to a
# timestamped, gzip-compressed tar archive.
#
# This is a *files* backup, deliberately separate from backup.sh (which
# only handles the Postgres database). Run both to get a full backup.
#
# Usage:
#   ./scripts/backup-avatars.sh
#
# Config (env vars, all optional):
#   AVATAR_UPLOAD_DIR       Directory to back up. Default: uploads/avatars
#                            (relative to this script's parent directory,
#                            i.e. backend/uploads/avatars) — same default
#                            resolveAvatarUploadDir() uses when the app
#                            runs outside docker-compose.yml (where it's
#                            instead set to /data/avatars).
#   BACKUP_DIR               Where the archive is written. Default: reuse
#                            backup.sh's DB backup dir (./backups, i.e.
#                            backend/backups) so DB and avatar backups
#                            live side by side unless BACKUP_DIR already
#                            points somewhere else.
#   BACKUP_RETENTION_DAYS   Default: 14. Set to 0 to disable cleanup.
#                            Same variable/semantics as backup.sh.
#   BACKUP_NAME_PREFIX       Default: tuitionschool-avatars
#
# Exit codes:
#   0  success
#   1  failed — nothing usable was produced (e.g. avatar dir missing)
#
# What this backs up: files under AVATAR_UPLOAD_DIR only, with permissions
# preserved. What it does NOT do: touch the database (see backup.sh), or
# upload anywhere — this is local-only, on purpose. See
# docs/deployment/BACKUP_RESTORE.md for the full scope and recovery
# procedure, including restore order (database first, then avatars).

set -euo pipefail

SCRIPT_NAME="backup-avatars"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./backup-common.sh
source "$SCRIPT_DIR/backup-common.sh"

: "${AVATAR_UPLOAD_DIR:=$SCRIPT_DIR/../uploads/avatars}"
# Reuse backup.sh's default so both backups land side by side unless the
# caller has already pointed BACKUP_DIR somewhere else.
: "${BACKUP_DIR:=$SCRIPT_DIR/../backups}"
: "${BACKUP_RETENTION_DAYS:=14}"
: "${BACKUP_NAME_PREFIX:=tuitionschool-avatars}"

# Sanity guard for the retention cleanup step below — never operate on an
# empty/root path no matter how BACKUP_DIR ends up misconfigured.
if [ -z "$BACKUP_DIR" ] || [ "$BACKUP_DIR" = "/" ]; then
  fail "Refusing to use BACKUP_DIR='$BACKUP_DIR' — looks unsafe."
fi

if [ ! -d "$AVATAR_UPLOAD_DIR" ]; then
  fail "Avatar directory not found: $AVATAR_UPLOAD_DIR (checked AVATAR_UPLOAD_DIR env, else the default). Nothing to back up."
fi

mkdir -p "$BACKUP_DIR"

log "Starting avatar backup (source: $AVATAR_UPLOAD_DIR)"

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILENAME="${BACKUP_NAME_PREFIX}_${TIMESTAMP}.tar.gz"
TMP_PATH="$BACKUP_DIR/.${FILENAME}.tmp"
FINAL_PATH="$BACKUP_DIR/${FILENAME}"

cleanup_tmp() {
  rm -f "$TMP_PATH" 2>/dev/null || true
}
trap cleanup_tmp EXIT

# -p preserves permissions/ownership/timestamps. Archive the directory's
# *contents* with a stable relative path (avatars/...) rather than baking
# in the absolute source path, so the archive is portable/restorable
# regardless of where AVATAR_UPLOAD_DIR happens to be on a given host.
PARENT_DIR="$(dirname "$AVATAR_UPLOAD_DIR")"
BASE_NAME="$(basename "$AVATAR_UPLOAD_DIR")"

if ! tar -czpf "$TMP_PATH" -C "$PARENT_DIR" "$BASE_NAME"; then
  fail "tar failed. No avatar backup file was produced."
fi

# --- verify before trusting the file --------------------------------------
if [ ! -s "$TMP_PATH" ]; then
  fail "Avatar backup file is empty after archiving — refusing to keep it."
fi

if ! gzip -t "$TMP_PATH" 2>/dev/null; then
  fail "Avatar backup file failed gzip integrity check — refusing to keep it."
fi

mv "$TMP_PATH" "$FINAL_PATH"
# Avatars are user-uploaded photos of students/staff -- keep the archive
# non-world-readable regardless of the host's default umask, same policy
# as backup.sh applies to database dumps.
chmod 600 "$FINAL_PATH"

SIZE_HUMAN="$(du -h "$FINAL_PATH" | cut -f1)"
FILE_COUNT="$(find "$AVATAR_UPLOAD_DIR" -type f | wc -l | tr -d ' ')"
log "Avatar backup OK: $FINAL_PATH ($SIZE_HUMAN, $FILE_COUNT file(s))"

# --- retention cleanup -----------------------------------------------------
if [ "$BACKUP_RETENTION_DAYS" -gt 0 ] 2>/dev/null; then
  log "Pruning local avatar backups older than $BACKUP_RETENTION_DAYS day(s)..."
  # Scoped to this exact prefix/suffix and maxdepth 1 — never a broad rm.
  find "$BACKUP_DIR" -maxdepth 1 -type f \
    -name "${BACKUP_NAME_PREFIX}_*.tar.gz" \
    -mtime "+${BACKUP_RETENTION_DAYS}" \
    -print -delete | while read -r removed; do
      log "Removed old avatar backup: $removed"
    done
else
  log "BACKUP_RETENTION_DAYS=$BACKUP_RETENTION_DAYS — retention cleanup disabled."
fi

log "Avatar backup complete."
