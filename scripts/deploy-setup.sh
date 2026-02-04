#!/bin/sh

# Fail on error
set -e

echo "[DEPLOY] Starting Deployment Setup..."

# 1. Install dependencies (if needed, usually handled by Docker build)
# npm install --production

# 2. Check if we need to migrate from SQLite (Data Transfer)
# Logic: If DATABASE_URL is sqlite and we want to move to Postgres (DATABASE_URL_PG is set)
# AND if the 'users' table in Postgres is empty (meaning fresh DB).

if [ -n "$DATABASE_URL_PG" ]; then
    echo "[DEPLOY] Postgres detected. Checking migration status..."
    
    # Run Prisma Push to ensure tables exist in Postgres
    echo "[DEPLOY] Pushing schema to Postgres..."
    npx prisma db push --schema prisma/schema.postgres.prisma

    # Run Data Migration Script
    # This script should handle "idempotency" (i.e., not duplicate data if already run)
    echo "[DEPLOY] Running Data Migration (SQLite -> PG)..."
    node scripts/migrate_sqlite_to_pg.js
else
    echo "[DEPLOY] No Postgres URL found. Skipping migration."
fi

echo "[DEPLOY] Setup Complete. Starting App..."
# exec "$@" # Run the CMD passed to docker
