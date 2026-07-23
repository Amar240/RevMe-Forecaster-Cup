#!/bin/sh
set -e

# Use POSTGRES_* if set; otherwise parse DATABASE_URL (e.g. for AWS RDS)
if [ -n "$POSTGRES_HOST" ]; then
  DB_HOST="$POSTGRES_HOST"
  DB_PORT="${POSTGRES_PORT:-5432}"
  DB_USER="${POSTGRES_USER:-postgres}"
else
  if [ -n "$DATABASE_URL" ]; then
    # Parse postgresql://user:pass@host:port/db - extract host (after @), port (before /), user (after //)
    DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:/]*\).*|\1|p')
    DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*@[^:]*:\([0-9]*\)/.*|\1|p')
    DB_USER=$(echo "$DATABASE_URL" | sed -n 's|.*://\([^:]*\):.*|\1|p')
    [ -z "$DB_HOST" ] && DB_HOST="db"
    [ -z "$DB_PORT" ] && DB_PORT="5432"
    [ -z "$DB_USER" ] && DB_USER="postgres"
  else
    DB_HOST="db"
    DB_PORT="${POSTGRES_PORT:-5432}"
    DB_USER="${POSTGRES_USER:-postgres}"
  fi
fi

echo "Waiting for Postgres at ${DB_HOST}:${DB_PORT}..."

retries=30
while [ $retries -gt 0 ]; do
  if pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" >/dev/null 2>&1; then
    echo "Postgres is ready."
    exit 0
  fi
  retries=$((retries - 1))
  sleep 2
done

echo "Postgres did not become ready in time."
exit 1
