#!/usr/bin/env bash
set -euo pipefail

# Extract schema + master data from the live Supabase project

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SUPABASE_DIR="${REPO_ROOT}/supabase"
INIT_SQL_FILE="${SUPABASE_DIR}/init.sql"
PROJECT_ID="bmyaefeddtcbnmpzvxmf"

echo "=========================================="
echo "Extracting Schema & Master Data from Supabase"
echo "=========================================="
echo "Project ID: ${PROJECT_ID}"
echo ""

# Guard rails - check for Supabase CLI in common locations
SUPABASE_CMD=""
if command -v supabase >/dev/null 2>&1; then
  SUPABASE_CMD="supabase"
elif [[ -f "${HOME}/.local/bin/supabase" ]]; then
  SUPABASE_CMD="${HOME}/.local/bin/supabase"
  export PATH="${HOME}/.local/bin:${PATH}"
elif [[ -f "/usr/local/bin/supabase" ]]; then
  SUPABASE_CMD="/usr/local/bin/supabase"
fi

if [[ -z "${SUPABASE_CMD}" ]]; then
  echo "Error: Supabase CLI is not installed. Run ./scripts/install-supabase-cli.sh" >&2
  exit 1
fi

# Test if logged in
if ! "${SUPABASE_CMD}" projects list >/dev/null 2>&1; then
  echo "Error: Not logged in. Run: supabase login" >&2
  exit 1
fi

cd "${REPO_ROOT}"
mkdir -p "${SUPABASE_DIR}"

# Helper
run_supabase() {
  (cd "${REPO_ROOT}" && "${SUPABASE_CMD}" "$@")
}

# Check if password needs to be provided for dump commands
# The link command stores the password, but dump might need it again
check_dump_connection() {
  if ! "${SUPABASE_CMD}" db dump --schema public --dry-run >/dev/null 2>&1; then
    echo "Warning: Dump connection test failed. You may need to re-link with password:" >&2
    echo "  supabase link --project-ref ${PROJECT_ID} -p YOUR_PASSWORD" >&2
    return 1
  fi
  return 0
}

# Ensure config exists + link project
CONFIG_FILE="${SUPABASE_DIR}/config.toml"
if [[ ! -f "${CONFIG_FILE}" ]]; then
  printf 'project_id = "%s"\n' "${PROJECT_ID}" > "${CONFIG_FILE}"
fi

echo "Linking to Supabase project..."
echo "Note: You may be prompted for your database password."
echo "If linking fails, you can manually link by running: supabase link --project-ref ${PROJECT_ID}"
echo ""

# Check if already linked
if run_supabase projects list 2>/dev/null | grep -q "${PROJECT_ID}"; then
  echo "Project appears to be linked. Testing connection..."
  # Try a simple command to test if password is stored
  if check_dump_connection; then
    echo "✓ Project is linked and connection works"
  else
    echo "Project is linked but dump connection test failed."
    echo "You may need to re-link with the password:" >&2
    echo "  supabase link --project-ref ${PROJECT_ID} -p YOUR_PASSWORD" >&2
    echo "Continuing anyway - the dump command will show the actual error if it fails..." >&2
  fi
else
  echo "Linking project (you will be prompted for database password)..."
  echo "Note: Using connection pooler (required for remote Supabase)"
  if run_supabase link --project-ref "${PROJECT_ID}" 2>&1; then
    echo "✓ Project linked successfully"
  else
    echo "Error: Failed to link project. Please run manually:" >&2
    echo "  supabase link --project-ref ${PROJECT_ID} -p YOUR_PASSWORD" >&2
    echo "Then run this script again." >&2
    exit 1
  fi
fi

# Ensure we're using pooler connection (not direct IPv4)
# The link command should use pooler by default, but verify
echo "Verifying connection uses pooler..."
if run_supabase db dump --schema public --dry-run 2>&1 | grep -qi "pooler\|Wrong password"; then
  if run_supabase db dump --schema public --dry-run 2>&1 | grep -qi "Wrong password"; then
    echo "Warning: Password issue detected. Make sure you linked with the correct password." >&2
  fi
fi

# Scratch space
TEMP_DIR=$(mktemp -d)
cleanup() {
  rm -rf "${TEMP_DIR}"
}
trap cleanup EXIT

SCHEMA_SQL="${TEMP_DIR}/schema.sql"
AUTH_SCHEMA_SQL="${TEMP_DIR}/auth_schema.sql"
DATA_DUMP_SQL="${TEMP_DIR}/data_dump.sql"
AUTH_USERS_SQL="${TEMP_DIR}/auth_users.sql"
MASTER_DATA_SQL="${TEMP_DIR}/master_data.sql"
export DATA_DUMP_SQL MASTER_DATA_SQL AUTH_USERS_SQL

# Backup existing init.sql
if [[ -f "${INIT_SQL_FILE}" ]]; then
  BACKUP_FILE="${INIT_SQL_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
  echo "Backing up existing init.sql to ${BACKUP_FILE}"
  cp "${INIT_SQL_FILE}" "${BACKUP_FILE}"
fi

echo ""
echo "=========================================="
echo "Step 1: Exporting Schema"
echo "=========================================="

echo "Running schema dump..."
echo "This may take 1-2 minutes depending on schema size..."

# Try with password flag if available (some CLI versions support it)
# If password is provided via environment variable, use it
if [[ -n "${SUPABASE_DB_PASSWORD:-}" ]]; then
  SCHEMA_OUTPUT=$(run_supabase db dump --schema public --file "${SCHEMA_SQL}" -p "${SUPABASE_DB_PASSWORD}" 2>&1)
  SCHEMA_EXIT=$?
else
  SCHEMA_OUTPUT=$(run_supabase db dump --schema public --file "${SCHEMA_SQL}" 2>&1)
  SCHEMA_EXIT=$?
fi

if [[ $SCHEMA_EXIT -eq 0 ]] && [[ -f "${SCHEMA_SQL}" ]] && [[ -s "${SCHEMA_SQL}" ]]; then
  SCHEMA_LINES=$(wc -l < "${SCHEMA_SQL}" | tr -d ' ')
  SCHEMA_SIZE=$(du -h "${SCHEMA_SQL}" | cut -f1)
  echo "✓ Schema exported (${SCHEMA_LINES} lines, ${SCHEMA_SIZE})"
else
  echo "Error: Failed to export schema via Supabase CLI" >&2
  if [[ -n "${SCHEMA_OUTPUT}" ]]; then
    echo "Output: ${SCHEMA_OUTPUT}" >&2
  fi
  if [[ -f "${SCHEMA_SQL}" ]] && [[ ! -s "${SCHEMA_SQL}" ]]; then
    echo "Schema file was created but is empty" >&2
  elif [[ ! -f "${SCHEMA_SQL}" ]]; then
    echo "Schema file was not created" >&2
  fi
  exit 1
fi

echo ""
echo "=========================================="
echo "Step 1.5: Exporting Auth Schema (if needed)"
echo "=========================================="

echo "Checking if auth schema exists..."
# Extract auth schema separately (it's usually created by migrations, but we check)
if [[ -n "${SUPABASE_DB_PASSWORD:-}" ]]; then
  run_supabase db dump --schema auth --file "${AUTH_SCHEMA_SQL}" -p "${SUPABASE_DB_PASSWORD}" >/dev/null 2>&1 || true
else
  run_supabase db dump --schema auth --file "${AUTH_SCHEMA_SQL}" >/dev/null 2>&1 || true
fi

if [[ -f "${AUTH_SCHEMA_SQL}" ]] && [[ -s "${AUTH_SCHEMA_SQL}" ]]; then
  AUTH_SCHEMA_LINES=$(wc -l < "${AUTH_SCHEMA_SQL}" | tr -d ' ')
  echo "✓ Auth schema exported (${AUTH_SCHEMA_LINES} lines)"
else
  echo "Note: Auth schema will be created by Supabase Auth migrations (this is normal)"
  echo "-- Auth schema will be created by migrations" > "${AUTH_SCHEMA_SQL}"
fi

echo ""
echo "=========================================="
echo "Step 2: Exporting Auth Users Data"
echo "=========================================="

echo "Extracting auth.users table data..."
echo "This may take a moment..."

# Dump all auth schema data, then filter for users table
AUTH_DATA_DUMP="${TEMP_DIR}/auth_data_dump.sql"
set +e  # Don't exit on error
if [[ -n "${SUPABASE_DB_PASSWORD:-}" ]]; then
  run_supabase db dump --data-only --schema auth --file "${AUTH_DATA_DUMP}" -p "${SUPABASE_DB_PASSWORD}" >/tmp/auth_dump_output.log 2>&1
else
  run_supabase db dump --data-only --schema auth --file "${AUTH_DATA_DUMP}" >/tmp/auth_dump_output.log 2>&1
fi
AUTH_DUMP_EXIT=$?
AUTH_DUMP_OUTPUT=$(cat /tmp/auth_dump_output.log 2>/dev/null || echo "")
set -e

  # Filter for users table data
if [[ $AUTH_DUMP_EXIT -eq 0 ]] && [[ -f "${AUTH_DATA_DUMP}" ]] && [[ -s "${AUTH_DATA_DUMP}" ]]; then
  # Extract users table data (handles both INSERT and COPY formats)
  if grep -qE "(INSERT INTO|COPY).*auth.*users|auth\.users" "${AUTH_DATA_DUMP}"; then
    # Extract users table section
    export AUTH_DATA_DUMP AUTH_USERS_SQL
    python3 <<PY > "${AUTH_USERS_SQL}"
import sys
import re
import os
from pathlib import Path

auth_dump = Path(os.environ["AUTH_DATA_DUMP"])
auth_users = Path(os.environ["AUTH_USERS_SQL"])

with auth_dump.open("r", encoding="utf-8") as src, auth_users.open("w", encoding="utf-8") as dst:
    dst.write("-- Auth Users Data\n")
    dst.write("-- Extracted from auth schema dump\n\n")
    
    printing = False
    in_users_insert = False
    
    for line in src:
        stripped = line.strip()
        
        # Handle COPY format
        if re.match(r'COPY\s+auth\.users', line, re.IGNORECASE):
            printing = True
            dst.write(line)
            continue
        
        # Handle INSERT format
        if re.match(r'INSERT INTO\s+auth\.users', line, re.IGNORECASE):
            in_users_insert = True
            dst.write(line)
            continue
        
        # Continue writing if in users INSERT
        if in_users_insert:
            dst.write(line)
            if ";" in line:
                in_users_insert = False
            continue
        
        # Continue writing if in COPY block
        if printing:
            dst.write(line)
            if stripped == r"\." or stripped == "\\.":
                printing = False
            continue

PY
    
    if [[ -s "${AUTH_USERS_SQL}" ]] && ! grep -q "^-- Auth Users Data$" "${AUTH_USERS_SQL}" || grep -qE "(INSERT|COPY)" "${AUTH_USERS_SQL}"; then
      AUTH_USERS_LINES=$(wc -l < "${AUTH_USERS_SQL}" | tr -d ' ')
      echo "✓ Auth users data exported (${AUTH_USERS_LINES} lines)"
      # Show sample
      echo "Sample of auth users dump (first 5 lines):"
      head -5 "${AUTH_USERS_SQL}" | sed 's/^/  /'
    else
      echo "Note: No auth.users data found in dump (table may be empty)"
      echo "-- No auth.users data to import" > "${AUTH_USERS_SQL}"
    fi
  else
    echo "Note: No auth.users data found in dump (table may be empty)"
    echo "-- No auth.users data to import" > "${AUTH_USERS_SQL}"
  fi
else
  echo "Note: Could not dump auth schema data"
  echo "-- No auth.users data to import" > "${AUTH_USERS_SQL}"
  if [[ -n "${AUTH_DUMP_OUTPUT}" ]]; then
    echo "Dump output: ${AUTH_DUMP_OUTPUT}" | head -3
  fi
fi

echo ""
echo "=========================================="
echo "Step 3: Exporting Master Data"
echo "=========================================="

MASTER_TABLES=(system_settings roles taxes categories units locations suppliers customers products product_serials profiles user_roles user_settings)
MASTER_TABLES_JOINED=$(IFS=,; echo "${MASTER_TABLES[*]}")

echo "Running data dump..."
echo "This may take 2-5 minutes depending on data size..."
echo "Note: Circular foreign-key constraints may cause warnings (this is normal)"
# Try dumping data - capture both stdout and stderr
# Use password flag if available (some CLI versions support it)
set +e  # Don't exit on error, we'll check the exit code
if [[ -n "${SUPABASE_DB_PASSWORD:-}" ]]; then
  run_supabase db dump --data-only --file "${DATA_DUMP_SQL}" -p "${SUPABASE_DB_PASSWORD}" >/tmp/dump_output.log 2>&1
else
  run_supabase db dump --data-only --file "${DATA_DUMP_SQL}" >/tmp/dump_output.log 2>&1
fi
DUMP_EXIT=$?
DUMP_OUTPUT=$(cat /tmp/dump_output.log 2>/dev/null || echo "")
set -e  # Re-enable exit on error

# Filter out the circular foreign-key constraint warnings (they're expected)
if echo "${DUMP_OUTPUT}" | grep -qi "circular foreign-key"; then
  echo "Note: Circular foreign-key constraints detected (this is expected for categories table)"
fi

if [[ -n "${DUMP_OUTPUT}" ]]; then
  echo "${DUMP_OUTPUT}"
fi

if [[ $DUMP_EXIT -ne 0 ]]; then
  echo "Warning: Data dump command had issues (exit code: ${DUMP_EXIT})" >&2
  echo "Trying alternative dump method..." >&2
  # Try without --file flag and redirect manually
  run_supabase db dump --data-only > "${DATA_DUMP_SQL}" 2>&1 || true
fi

# Check if dump file exists and has content
if [[ ! -f "${DATA_DUMP_SQL}" ]]; then
  echo "Error: Data dump file was not created" >&2
  echo "-- Master data extraction skipped (dump file not created)" > "${MASTER_DATA_SQL}"
elif [[ ! -s "${DATA_DUMP_SQL}" ]]; then
  echo "Warning: Data dump file is empty" >&2
  echo "This might mean the database has no data, or the dump format is different." >&2
  echo "-- Master data extraction skipped (dump file is empty)" > "${MASTER_DATA_SQL}"
else
  DUMP_SIZE=$(wc -l < "${DATA_DUMP_SQL}" | tr -d ' ')
  echo "✓ Data dump created (${DUMP_SIZE} lines)"
  
  # Show a sample of the dump to help debug
  echo "Sample of dump file (first 10 lines):"
  head -10 "${DATA_DUMP_SQL}" | sed 's/^/  /'
    
    # Filter master data using Python
    echo "Filtering master data from dump..."
    MASTER_TABLES_CSV="${MASTER_TABLES_JOINED}" python3 <<'PY'
import os
import re
from pathlib import Path

tables = set(os.environ["MASTER_TABLES_CSV"].split(","))
data_path = Path(os.environ["DATA_DUMP_SQL"])
master_path = Path(os.environ["MASTER_DATA_SQL"])

printing = False
rows_captured = 0
tables_found = set()
current_insert_table = None

with data_path.open("r", encoding="utf-8") as src, master_path.open("w", encoding="utf-8") as dst:
    dst.write("-- Master Data from Supabase\n")
    dst.write(f"-- Extracted on: {os.popen('date').read().strip()}\n\n")
    
    for line in src:
        stripped = line.strip()
        
        # Handle COPY format: COPY public.table_name (columns) FROM stdin;
        if line.startswith("COPY public."):
            # Extract table name from: COPY public.table_name (col1, col2) FROM stdin;
            match = re.match(r'COPY public\.(\w+)', line)
            if match:
                table_name = match.group(1)
                if table_name in tables:
                    printing = True
                    tables_found.add(table_name)
                    dst.write(line)
                    rows_captured += 1
                else:
                    printing = False
            continue
        
        # Handle INSERT format: INSERT INTO "public"."table_name" or INSERT INTO public.table_name
        # Match both quoted and unquoted formats
        insert_match = re.match(r'INSERT INTO\s+(?:"?public"?\.)?"?(\w+)"?', line, re.IGNORECASE)
        if insert_match:
            table_name = insert_match.group(1)
            if table_name in tables:
                current_insert_table = table_name
                tables_found.add(table_name)
                dst.write(line)
                rows_captured += 1
            else:
                current_insert_table = None
            continue
        
        # If we're in the middle of an INSERT for a master table, continue writing
        if current_insert_table:
            dst.write(line)
            # Check if this line completes the INSERT (ends with semicolon)
            if ";" in line:
                current_insert_table = None
            continue
        
        # If we're in a COPY block, continue writing until we see the terminator
        if printing:
            dst.write(line)
            if stripped == r"\." or stripped == "\\.":
                dst.write("\n")
                printing = False
            continue
    
    # Write summary (inside the with block, after processing all lines)
    if rows_captured > 0:
        dst.write(f"\n-- Summary: Found data for {len(tables_found)} table(s): {', '.join(sorted(tables_found))}\n")
    else:
        dst.write("\n-- Warning: No data rows found for master tables\n")
        dst.write(f"-- Tables searched: {', '.join(sorted(tables))}\n")
        dst.write(f"-- Tables found in dump: {', '.join(sorted(tables_found)) if tables_found else 'none'}\n")

PY
    
    if [[ ! -s "${MASTER_DATA_SQL}" ]] || grep -q "No data rows found" "${MASTER_DATA_SQL}"; then
      echo "Warning: No master data rows were captured." >&2
      echo "Checking dump file for master tables..."
      for table in "${MASTER_TABLES[@]}"; do
        if grep -q "COPY public.${table}\|INSERT INTO public.${table}" "${DATA_DUMP_SQL}"; then
          echo "  Found references to ${table} in dump"
        fi
      done
    else
      TABLES_FOUND=$(grep -oE "Found data for [0-9]+ table" "${MASTER_DATA_SQL}" | head -1 || echo "")
      echo "✓ Filtered master data for key tables ${TABLES_FOUND}"
    fi
fi

echo ""
echo "=========================================="
echo "Step 4: Building init.sql"
echo "=========================================="

{
  echo "-- =========================================="
  echo "-- Versal Database Initialization Script"
  echo "-- Generated from Supabase project: ${PROJECT_ID}"
  echo "-- Extracted on: $(date)"
  echo "-- =========================================="
  echo ""
  echo "-- =========================================="
  echo "-- Database Schema (public)"
  echo "-- =========================================="
  echo ""
  cat "${SCHEMA_SQL}"
  echo ""
  echo "-- =========================================="
  echo "-- Auth Schema (if needed)"
  echo "-- =========================================="
  echo "-- Note: Auth schema is usually created by Supabase Auth migrations"
  echo "-- This section is included for reference only"
  echo ""
  # Only include auth schema if it has actual content (not just the placeholder)
  if grep -qv "will be created by migrations" "${AUTH_SCHEMA_SQL}" 2>/dev/null; then
    cat "${AUTH_SCHEMA_SQL}"
  else
    echo "-- Auth schema will be created by Supabase Auth service migrations"
  fi
  echo ""
  echo "-- =========================================="
  echo "-- Auth Users Data"
  echo "-- =========================================="
  echo "-- Note: Auth users should be inserted AFTER auth schema is created"
  echo "-- The Supabase Auth service will create the schema via migrations"
  echo "-- This data will be inserted after migrations complete"
  echo ""
  # Only include auth users if there's actual data
  if grep -qv "No auth.users data" "${AUTH_USERS_SQL}" 2>/dev/null && [[ -s "${AUTH_USERS_SQL}" ]]; then
    cat "${AUTH_USERS_SQL}"
  else
    echo "-- No auth.users data to import"
  fi
  echo ""
  echo "-- =========================================="
  echo "-- Master Data (public schema)"
  echo "-- =========================================="
  echo ""
  cat "${MASTER_DATA_SQL}"
} > "${INIT_SQL_FILE}"

echo "✓ init.sql written to ${INIT_SQL_FILE}"
wc -l "${INIT_SQL_FILE}" | awk '{print "  Total lines: "$1}'

echo ""
echo "=========================================="
echo "Extraction complete!"
echo "=========================================="
echo "Next steps:"
echo "  1. Review ${INIT_SQL_FILE}"
echo "  2. Run: ./scripts/deploy-local.sh --target supabase"

