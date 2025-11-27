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
DATA_DUMP_SQL="${TEMP_DIR}/data_dump.sql"
MASTER_DATA_SQL="${TEMP_DIR}/master_data.sql"
export DATA_DUMP_SQL MASTER_DATA_SQL

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
echo "Step 2: Exporting Master Data"
echo "=========================================="

MASTER_TABLES=(system_settings roles taxes categories units locations suppliers customers products)
MASTER_TABLES_JOINED=$(IFS=,; echo "${MASTER_TABLES[*]}")
echo "Master tables selected: ${MASTER_TABLES_JOINED}"

echo "Running data dump..."
echo "This may take 2-5 minutes depending on data size..."
echo "Tables being extracted: ${MASTER_TABLES_JOINED}"
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
  
  # Verify product count in raw dump before filtering
  echo ""
  echo "Verifying product data in dump..."
  PRODUCT_INSERT_COUNT=$(grep -c "INSERT INTO.*products\|COPY public.products" "${DATA_DUMP_SQL}" 2>/dev/null || echo "0")
  if [[ "${PRODUCT_INSERT_COUNT}" -gt 0 ]]; then
    # Try to count rows in products INSERT/COPY
    PRODUCT_ROWS=$(awk '/INSERT INTO.*products|COPY public.products/{flag=1; next} flag && /INSERT INTO|COPY public\./{flag=0} flag && /^[[:space:]]*\(/{count++} END {print count+0}' "${DATA_DUMP_SQL}" 2>/dev/null || echo "0")
    if [[ "${PRODUCT_ROWS}" -gt 0 ]]; then
      echo "  Found ${PRODUCT_ROWS} product row(s) in dump file"
    else
      echo "  Found products INSERT/COPY statement(s) but row count unavailable"
    fi
  else
    echo "  Warning: No products INSERT/COPY found in dump file"
  fi
  
  # Show a sample of the dump to help debug
  echo "Sample of dump file (first 10 lines):"
  head -10 "${DATA_DUMP_SQL}" | sed 's/^/  /'
    
    # Filter master data using Python
    echo "Filtering master data from dump..."
    echo "Note: Checking for multiple INSERT statements per table..."
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
with data_path.open("r", encoding="utf-8") as src, master_path.open("w", encoding="utf-8") as dst:
    # Use mutable containers so we can modify them from nested function
    insert_state = {"table": None, "lines": []}
    table_row_counts = {}  # Track row counts per table
    
    def flush_current_insert():
        """Write the buffered INSERT statement and reset"""
        if insert_state["table"] and insert_state["lines"]:
            # Write all buffered lines except the last one
            for i, buffered_line in enumerate(insert_state["lines"][:-1]):
                dst.write(buffered_line)
            # Handle the last line - ensure it ends with semicolon
            if insert_state["lines"]:
                last_line = insert_state["lines"][-1].rstrip()
                if last_line.endswith(';'):
                    dst.write(insert_state["lines"][-1])
                elif last_line.endswith(','):
                    # Remove trailing comma and add semicolon
                    dst.write(last_line.rstrip(',') + ';\n')
                else:
                    # Add semicolon
                    dst.write(insert_state["lines"][-1].rstrip() + ';\n')
            insert_state["lines"] = []
            insert_state["table"] = None
    dst.write("-- Master Data from Supabase\n")
    dst.write(f"-- Extracted on: {os.popen('date').read().strip()}\n\n")
    
    for line in src:
        stripped = line.strip()
        
        # Handle COPY format: COPY public.table_name (columns) FROM stdin;
        if line.startswith("COPY public."):
            # Flush any pending INSERT
            flush_current_insert()
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
        
        # Check if this line starts a new INSERT statement
        insert_match = re.match(r'INSERT INTO\s+(?:"?public"?\.)?"?(\w+)"?', line, re.IGNORECASE)
        
        # If we're in the middle of an INSERT and encounter a new INSERT for a different table,
        # flush the current INSERT first (it should be complete by now)
        if insert_state["table"] and insert_match:
            new_table_name = insert_match.group(1)
            if new_table_name != insert_state["table"]:
                # Different table - flush current INSERT (add semicolon if missing)
                flush_current_insert()
                # Now process the new INSERT below (fall through)
        
        # If we're in the middle of an INSERT for a master table, continue buffering
        if insert_state["table"]:
            # Check if this line is a new INSERT for a different table
            if insert_match and insert_match.group(1) != insert_state["table"]:
                # Different table - should have been flushed above, but handle it here too
                flush_current_insert()
                # Fall through to process the new INSERT
            elif insert_match and insert_match.group(1) == insert_state["table"]:
                # Same table - this is a new INSERT statement for the same table
                # Flush the previous INSERT first, then start the new one
                flush_current_insert()
                # Fall through to process the new INSERT below
            else:
                # This is a continuation line of the current INSERT - buffer it
                insert_state["lines"].append(line)
                # Count additional rows (lines starting with opening parenthesis are new rows)
                if re.match(r'^\s*\(', line):
                    table_row_counts[insert_state["table"]] += 1
                # Check if this line completes the INSERT (ends with semicolon)
                if ";" in line:
                    flush_current_insert()
                continue
        
        # Handle INSERT format: INSERT INTO "public"."table_name" or INSERT INTO public.table_name
        # Match both quoted and unquoted formats
        if insert_match:
            table_name = insert_match.group(1)
            if table_name in tables:
                # If we're already buffering an INSERT for this table, flush it first
                # (this handles multiple INSERT statements for the same table)
                if insert_state["table"] == table_name:
                    flush_current_insert()
                # Start buffering this new INSERT
                insert_state["table"] = table_name
                tables_found.add(table_name)
                if table_name not in table_row_counts:
                    table_row_counts[table_name] = 0
                # Count VALUES rows in this INSERT (look for opening parenthesis with values)
                if re.search(r'VALUES\s*\(', line, re.IGNORECASE):
                    table_row_counts[table_name] += 1
                insert_state["lines"] = [line]  # Start buffering
                rows_captured += 1
            else:
                insert_state["table"] = None
                insert_state["lines"] = []
            continue
        
        # If we're in a COPY block, continue writing until we see the terminator
        if printing:
            dst.write(line)
            if stripped in ("\\\\.", r"\."):
                dst.write("\n")
                printing = False
            continue
    
    # Flush any pending INSERT at end of file
    flush_current_insert()
    
    # Write summary (inside the with block, after processing all lines)
    if rows_captured > 0:
        summary_lines = [f"\n-- Summary: Found data for {len(tables_found)} table(s):"]
        for table in sorted(tables_found):
            row_count = table_row_counts.get(table, 0)
            if row_count > 0:
                summary_lines.append(f"--   {table}: {row_count} row(s)")
            else:
                summary_lines.append(f"--   {table}: data found (row count not available)")
        dst.write("\n".join(summary_lines) + "\n")
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
      echo "Row counts per table:"
      grep -E "^--   [a-z_]+: [0-9]+ row" "${MASTER_DATA_SQL}" | sed 's/^--   /  /' || echo "  (Row counts not available)"
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

