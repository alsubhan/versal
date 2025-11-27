#!/usr/bin/env bash
set -euo pipefail

# Alternative extraction script using direct PostgreSQL connection
# This can be used if Supabase CLI is not available
# You need to provide the database connection string from Supabase dashboard

# Resolve repo root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SUPABASE_DIR="${REPO_ROOT}/supabase"
INIT_SQL_FILE="${SUPABASE_DIR}/init.sql"

# Project ID
PROJECT_ID="bmyaefeddtcbnmpzvxmf"

echo "=========================================="
echo "Extracting Schema & Master Data (Direct Connection)"
echo "=========================================="
echo "Project ID: ${PROJECT_ID}"
echo ""

# Check for pg_dump
if ! command -v pg_dump &> /dev/null; then
  echo "Error: pg_dump is not installed" >&2
  echo "Install PostgreSQL client tools:" >&2
  echo "  macOS: brew install postgresql" >&2
  echo "  Or download from: https://www.postgresql.org/download/" >&2
  exit 1
fi

echo "✓ pg_dump is available"

# Get database connection string
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo ""
  echo "Please provide your Supabase database connection string."
  echo "You can find it in your Supabase dashboard:"
  echo "  Settings → Database → Connection string (URI mode)"
  echo ""
  echo "Format: postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"
  echo ""
  read -p "Enter database connection string: " DATABASE_URL
  
  if [[ -z "${DATABASE_URL}" ]]; then
    echo "Error: Database connection string is required" >&2
    exit 1
  fi
fi

echo ""
echo "Testing database connection..."
if pg_dump "${DATABASE_URL}" --schema=public --schema-only >/dev/null 2>&1; then
  echo "✓ Database connection successful"
else
  echo "Error: Could not connect to database" >&2
  echo "Please check your connection string and try again" >&2
  exit 1
fi

# Create supabase directory if it doesn't exist
mkdir -p "${SUPABASE_DIR}"

# Backup existing init.sql if it exists
if [[ -f "${INIT_SQL_FILE}" ]]; then
  BACKUP_FILE="${INIT_SQL_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
  echo ""
  echo "Backing up existing init.sql to ${BACKUP_FILE}"
  cp "${INIT_SQL_FILE}" "${BACKUP_FILE}"
fi

# Create temporary directory
TEMP_DIR=$(mktemp -d)
trap "rm -rf ${TEMP_DIR}" EXIT

SCHEMA_SQL="${TEMP_DIR}/schema.sql"
MASTER_DATA_SQL="${TEMP_DIR}/master_data.sql"

echo ""
echo "=========================================="
echo "Step 1: Extracting Database Schema"
echo "=========================================="

echo "Extracting complete schema (schema only, no data)..."
if pg_dump "${DATABASE_URL}" \
  --schema=public \
  --no-owner \
  --no-privileges \
  --no-tablespaces \
  --schema-only \
  > "${SCHEMA_SQL}" 2>/dev/null; then
  echo "✓ Schema extracted successfully"
  SCHEMA_LINES=$(wc -l < "${SCHEMA_SQL}" | tr -d ' ')
  echo "  Schema file: ${SCHEMA_LINES} lines"
else
  echo "Error: Failed to extract schema" >&2
  exit 1
fi

echo ""
echo "=========================================="
echo "Step 2: Extracting Master Data"
echo "=========================================="

# Master tables to extract data from
MASTER_TABLES=(
  "system_settings"
  "roles"
  "taxes"
  "categories"
  "units"
  "locations"
  "suppliers"
  "customers"
  "products"
)

echo "-- Master Data from Supabase" > "${MASTER_DATA_SQL}"
echo "-- Extracted on: $(date)" >> "${MASTER_DATA_SQL}"
echo "-- Project ID: ${PROJECT_ID}" >> "${MASTER_DATA_SQL}"
echo "" >> "${MASTER_DATA_SQL}"

echo "Extracting master data from tables..."

for table in "${MASTER_TABLES[@]}"; do
  echo "  Extracting: ${table}..."
  
  # Extract data with INSERT statements
  if pg_dump "${DATABASE_URL}" \
    --table="public.${table}" \
    --data-only \
    --column-inserts \
    --no-owner \
    --no-privileges \
    2>/dev/null | grep -i "^INSERT" > "${TEMP_DIR}/${table}_data.sql" 2>/dev/null; then
    
    if [[ -s "${TEMP_DIR}/${table}_data.sql" ]]; then
      cat "${TEMP_DIR}/${table}_data.sql" >> "${MASTER_DATA_SQL}"
      ROW_COUNT=$(grep -c "^INSERT" "${TEMP_DIR}/${table}_data.sql" 2>/dev/null || echo "0")
      echo "    ✓ ${table} (${ROW_COUNT} rows)"
    else
      echo "    ⊘ ${table} (no data)"
      echo "-- Table ${table} has no data" >> "${MASTER_DATA_SQL}"
    fi
  else
    echo "    ⊘ ${table} (table may not exist or no data)"
    echo "-- Table ${table} extraction skipped (table may not exist or has no data)" >> "${MASTER_DATA_SQL}"
  fi
done

echo ""
echo "=========================================="
echo "Step 3: Creating Combined Initialization File"
echo "=========================================="

# Create the combined init.sql file
echo "-- ==========================================" > "${INIT_SQL_FILE}"
echo "-- Versal Database Initialization Script" >> "${INIT_SQL_FILE}"
echo "-- Generated from Supabase project: ${PROJECT_ID}" >> "${INIT_SQL_FILE}"
echo "-- Extracted on: $(date)" >> "${INIT_SQL_FILE}"
echo "-- ==========================================" >> "${INIT_SQL_FILE}"
echo "" >> "${INIT_SQL_FILE}"

# Add schema
echo "-- ==========================================" >> "${INIT_SQL_FILE}"
echo "-- Database Schema" >> "${INIT_SQL_FILE}"
echo "-- ==========================================" >> "${INIT_SQL_FILE}"
echo "" >> "${INIT_SQL_FILE}"
cat "${SCHEMA_SQL}" >> "${INIT_SQL_FILE}"
echo "" >> "${INIT_SQL_FILE}"
echo "" >> "${INIT_SQL_FILE}"

# Add master data
echo "-- ==========================================" >> "${INIT_SQL_FILE}"
echo "-- Master Data" >> "${INIT_SQL_FILE}"
echo "-- ==========================================" >> "${INIT_SQL_FILE}"
echo "" >> "${INIT_SQL_FILE}"
cat "${MASTER_DATA_SQL}" >> "${INIT_SQL_FILE}"

echo "✓ Created initialization file: ${INIT_SQL_FILE}"

# Get file size
FILE_SIZE=$(wc -l < "${INIT_SQL_FILE}" | tr -d ' ')
FILE_SIZE_KB=$(du -h "${INIT_SQL_FILE}" | cut -f1)
echo "  File size: ${FILE_SIZE} lines (${FILE_SIZE_KB})"

echo ""
echo "=========================================="
echo "Extraction Complete!"
echo "=========================================="
echo ""
echo "Initialization file created:"
echo "  ${INIT_SQL_FILE}"
echo ""
echo "This file contains:"
echo "  - Complete database schema (tables, functions, triggers, etc.)"
echo "  - Master data from reference tables"
echo ""
echo "Next steps:"
echo "  1. Review the init.sql file"
echo "  2. Run: ./scripts/deploy-local.sh --target supabase"
echo "     (The deployment script will automatically run this file on first deployment)"

