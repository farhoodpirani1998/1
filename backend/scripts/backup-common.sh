#!/usr/bin/env bash
# Shared helpers for backup.sh and restore.sh. Sourced, not executed directly.
#
# Deliberately plain bash + coreutils + docker/psql client tools only — no
# new language runtime, no AWS SDK, no extra package manager dependency.
# S3 support (in backup.sh) shells out to the `aws` CLI if present; nothing
# here requires it.

# --- logging -----------------------------------------------------------
# All log lines go to stdout with a UTC timestamp. Redirect this from cron
# (see docs/deployment/BACKUP_RESTORE.md) if you want a persistent log file.
log() {
  printf '%s [%s] %s\n' "$(date -u +%FT%TZ)" "${SCRIPT_NAME:-backup}" "$*"
}

fail() {
  log "ERROR: $*"
  exit "${2:-1}"
}

# --- secret redaction ----------------------------------------------------
# Never print DATABASE_URL or S3 keys verbatim. This is only used for the
# rare log line that needs to reference the DB host/name for context.
redact_url() {
  # postgres://user:pass@host:port/db -> postgres://***:***@host:port/db
  printf '%s' "$1" | sed -E 's#(://)[^:@/]*:[^@/]*@#\1***:***@#'
}

# --- required config -----------------------------------------------------
require_database_url() {
  if [ -z "${DATABASE_URL:-}" ]; then
    fail "DATABASE_URL is not set. Backup/restore requires the same DATABASE_URL the app uses."
  fi
}

# --- execution mode: docker-compose exec vs. direct client ---------------
# Primary target: the project's reference docker-compose.yml, where Postgres
# is only reachable inside the compose network. We reuse the *running
# postgres container's own* pg_dump/psql (guaranteed version-matched) via
# `docker compose exec`, rather than installing postgres-client into the app
# image or exposing the DB port.
#
# Fallback: bare-metal / managed-DB deployments (DEPLOYMENT.md's other
# documented path) where a local pg_dump/psql can reach DATABASE_URL
# directly. Selected automatically when the postgres compose service isn't
# running, or explicitly via BACKUP_MODE=direct / BACKUP_MODE=docker.

: "${COMPOSE_FILE:=$SCRIPT_DIR/../docker-compose.yml}"
: "${BACKUP_MODE:=auto}"

compose_postgres_running() {
  command -v docker >/dev/null 2>&1 || return 1
  [ -f "$COMPOSE_FILE" ] || return 1
  docker compose -f "$COMPOSE_FILE" ps --status running --format '{{.Service}}' 2>/dev/null \
    | grep -qx postgres
}

resolve_mode() {
  case "$BACKUP_MODE" in
    docker) echo docker ;;
    direct) echo direct ;;
    auto)
      if compose_postgres_running; then
        echo docker
      elif command -v pg_dump >/dev/null 2>&1; then
        echo direct
      else
        fail "Cannot find a running 'postgres' compose service and no local pg_dump binary is available. Set BACKUP_MODE explicitly or install postgresql-client."
      fi
      ;;
    *) fail "Unknown BACKUP_MODE '$BACKUP_MODE' (expected auto, docker, or direct)." ;;
  esac
}

# run_pg_dump <extra pg_dump args...>  -- writes dump SQL to stdout
run_pg_dump() {
  case "$MODE" in
    docker)
      docker compose -f "$COMPOSE_FILE" exec -T postgres \
        pg_dump --no-password "$@" "$DATABASE_URL"
      ;;
    direct)
      pg_dump --no-password "$@" "$DATABASE_URL"
      ;;
  esac
}

# run_psql <extra psql args...>  -- reads SQL from stdin
run_psql() {
  case "$MODE" in
    docker)
      docker compose -f "$COMPOSE_FILE" exec -T postgres \
        psql --no-password -v ON_ERROR_STOP=1 "$@" "$DATABASE_URL"
      ;;
    direct)
      psql --no-password -v ON_ERROR_STOP=1 "$@" "$DATABASE_URL"
      ;;
  esac
}
