#!/bin/bash
# Extract Complete Database Schema via Supabase CLI
# Generated at: 2025-08-07T22:37:06.604865

echo 'Extracting complete database schema via Supabase CLI...'

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo 'Error: Supabase CLI is not installed'
    echo 'Install from: https://supabase.com/docs/guides/cli'
    exit 1
fi

# Check if logged in
if ! supabase projects list &> /dev/null; then
    echo 'Please login to Supabase CLI first: supabase login'
    exit 1
fi

# Extract complete schema
echo 'Pulling complete database schema...'
supabase db pull --schema public

# Generate TypeScript types
echo 'Generating TypeScript types...'
supabase gen types typescript --local > types.ts

# Create complete dump
echo 'Creating complete schema dump...'
pg_dump $DATABASE_URL --schema=public --no-owner --no-privileges > complete_schema_dump.sql

echo 'Complete extraction finished!'
echo 'Files generated:'
echo '  - supabase/migrations/ (latest migration with all objects)'
echo '  - types.ts (TypeScript types)'
echo '  - complete_schema_dump.sql (complete PostgreSQL dump)'
