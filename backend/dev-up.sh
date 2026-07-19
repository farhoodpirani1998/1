#!/usr/bin/env bash
# One-command dev startup.
# Usage: ./dev-up.sh
#
# Does, in order:
#   1. docker compose up -d (postgres + redis)
#   2. waits until postgres reports healthy
#   3. runs pending migrations
#   4. seeds the first super_admin (safe to re-run, no-op if it exists)
#   5. starts the app in watch mode (npm run start:dev)
set -euo pipefail

# Always run relative to this script's own folder, no matter where it's called from.
cd "$(dirname "${BASH_SOURCE[0]}")"

if [ ! -f .env ]; then
  echo "❌ .env not found. Copy .env.example to .env and fill in real values first:"
  echo "   cp .env.example .env"
  exit 1
fi

echo "▶ Starting postgres + redis..."
docker compose -f docker-compose.dev.yml up -d

echo "▶ Waiting for postgres to be healthy..."
for i in $(seq 1 30); do
  status="$(docker compose -f docker-compose.dev.yml ps -q postgres | xargs docker inspect -f '{{.State.Health.Status}}' 2>/dev/null || echo starting)"
  if [ "$status" = "healthy" ]; then
    echo "  postgres is healthy."
    break
  fi
  if [ "$i" = "30" ]; then
    echo "❌ postgres never became healthy after 30 tries. Check: docker compose -f docker-compose.dev.yml logs postgres"
    exit 1
  fi
  sleep 1
done

echo "▶ Running migrations..."
npm run migration:run

echo "▶ Seeding first super_admin (no-op if one already exists)..."
npm run seed

echo "▶ Starting the app (watch mode)..."
npm run start:dev
