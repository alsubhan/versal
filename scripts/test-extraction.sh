#!/usr/bin/env bash
# Test script to demonstrate extraction without requiring Supabase CLI
# This shows what the extraction would do

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SUPABASE_DIR="${REPO_ROOT}/supabase"
INIT_SQL_FILE="${SUPABASE_DIR}/init.sql"

echo "=========================================="
echo "Testing Extraction Script"
echo "=========================================="
echo ""

# Check script syntax
echo "1. Checking script syntax..."
if bash -n "${SCRIPT_DIR}/extract-supabase-data.sh"; then
  echo "   ✓ Script syntax is valid"
else
  echo "   ✗ Script has syntax errors"
  exit 1
fi

echo ""
echo "2. Checking prerequisites..."

# Check for Supabase CLI
if command -v supabase &> /dev/null; then
  echo "   ✓ Supabase CLI is installed"
  SUPABASE_AVAILABLE=true
else
  echo "   ✗ Supabase CLI is not installed"
  SUPABASE_AVAILABLE=false
fi

# Check for pg_dump
if command -v pg_dump &> /dev/null; then
  echo "   ✓ pg_dump is available"
  PG_DUMP_AVAILABLE=true
else
  echo "   ✗ pg_dump is not available"
  PG_DUMP_AVAILABLE=false
fi

# Check for psql
if command -v psql &> /dev/null; then
  echo "   ✓ psql is available"
  PSQL_AVAILABLE=true
else
  echo "   ✗ psql is not available"
  PSQL_AVAILABLE=false
fi

echo ""
echo "3. Installation options:"
echo ""
echo "   Option A: Install Supabase CLI via npm (recommended)"
echo "   ----------------------------------------"
echo "   1. Install Node.js from https://nodejs.org/"
echo "   2. Run: npm install -g supabase"
echo "   3. Run: supabase login"
echo ""
echo "   Option B: Install Supabase CLI via Homebrew (macOS)"
echo "   ----------------------------------------"
echo "   1. Install Homebrew: /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
echo "   2. Run: brew install supabase/tap/supabase"
echo "   3. Run: supabase login"
echo ""
echo "   Option C: Use direct PostgreSQL connection"
echo "   ----------------------------------------"
echo "   If you have the database connection string, we can modify"
echo "   the script to use pg_dump directly without Supabase CLI"
echo ""

if [[ "${SUPABASE_AVAILABLE}" == "false" ]]; then
  echo "=========================================="
  echo "To proceed with extraction:"
  echo "=========================================="
  echo ""
  echo "Please install Supabase CLI first using one of the options above."
  echo ""
  echo "After installation, you can run:"
  echo "  ./scripts/extract-supabase-data.sh"
  echo ""
  exit 1
fi

echo ""
echo "4. Testing Supabase CLI connection..."
if supabase projects list >/dev/null 2>&1; then
  echo "   ✓ You are logged in to Supabase CLI"
  echo ""
  echo "5. Ready to extract!"
  echo "   Run: ./scripts/extract-supabase-data.sh"
else
  echo "   ✗ Not logged in. Please run: supabase login"
  echo ""
  echo "After logging in, run:"
  echo "  ./scripts/extract-supabase-data.sh"
fi

