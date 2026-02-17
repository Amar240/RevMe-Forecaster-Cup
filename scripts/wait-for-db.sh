#!/bin/sh
set -e

DB_HOST="${POSTGRES_HOST:-db}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_USER="${POSTGRES_USER:-postgres}"

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
