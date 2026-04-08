#!/bin/bash
# ---------------------------------------------------------------------------
# migrate.sh — Idempotent SQL migration runner
#
# Runs every *.sql file in /migrations (alphabetically) exactly once.
# Applied files are recorded in the _schema_migrations table so they are
# never executed again, even across container restarts.
# ---------------------------------------------------------------------------

set -euo pipefail

DB_HOST="${DB_HOST:-supabase-db}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_PASS="${DB_PASS:-postgres}"
DB_NAME="${DB_NAME:-postgres}"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-/migrations}"

export PGPASSWORD="$DB_PASS"

PSQL="psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -v ON_ERROR_STOP=1"

# ---------------------------------------------------------------------------
# 1. Wait for Postgres to be ready
# ---------------------------------------------------------------------------
echo "[migrate] Waiting for database at $DB_HOST:$DB_PORT..."
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -q; do
  sleep 2
done
echo "[migrate] Database is ready."

# ---------------------------------------------------------------------------
# 2. Ensure the migrations tracking table exists
# ---------------------------------------------------------------------------
$PSQL <<'SQL'
CREATE TABLE IF NOT EXISTS _schema_migrations (
  filename   TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
SQL

echo "[migrate] Migration tracking table ready."

# ---------------------------------------------------------------------------
# 3. Apply each *.sql file in sorted order if not already applied
# ---------------------------------------------------------------------------
shopt -s nullglob
SQL_FILES=( "$MIGRATIONS_DIR"/*.sql )

if [ ${#SQL_FILES[@]} -eq 0 ]; then
  echo "[migrate] No migration files found in $MIGRATIONS_DIR. Nothing to do."
  exit 0
fi

for filepath in "${SQL_FILES[@]}"; do
  filename="$(basename "$filepath")"

  # Check if already applied
  applied=$($PSQL -tAc "SELECT COUNT(*) FROM _schema_migrations WHERE filename = '$filename'")

  if [ "$applied" -gt "0" ]; then
    echo "[migrate] SKIP  $filename (already applied)"
    continue
  fi

  echo "[migrate] APPLY $filename ..."
  $PSQL -f "$filepath"

  # Record as applied
  $PSQL -c "INSERT INTO _schema_migrations (filename) VALUES ('$filename') ON CONFLICT DO NOTHING"
  echo "[migrate] DONE  $filename"
done

echo "[migrate] All migrations complete."
