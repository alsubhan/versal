# Database Initialization Workflow

This document explains how the `init-database.ps1` script works step-by-step.

## Overview

The script initializes your local Supabase database by:
1. Pulling the latest schema from your live Supabase project
2. Running all migration files to create tables and functions
3. Seeding master data and settings

## Step-by-Step Flow

### Phase 1: Schema Synchronization (Optional)

```
┌─────────────────────────────────────────┐
│  Check Supabase CLI Installation        │
│  - Verify 'supabase' command exists     │
│  - Check if user is logged in           │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  Link to Supabase Project                │
│  - Check if project is already linked   │
│  - Run: supabase link --project-ref ID  │
│  - Updates supabase/config.toml         │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  Pull Latest Schema                      │
│  - Run: supabase db pull --schema public │
│  - Creates new migration file in        │
│    supabase/migrations/                  │
│  - Contains CREATE/ALTER statements      │
└─────────────────┬───────────────────────┘
```

**What happens:**
- Compares your local schema with live Supabase project
- Generates a new migration file with differences
- This ensures your local DB matches production structure

### Phase 2: Database Readiness Check

```
┌─────────────────────────────────────────┐
│  Check Docker is Running                │
│  - Verify Docker daemon is accessible   │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  Check Supabase Container                │
│  - Verify 'supabase-db' container exists │
│  - Must be running                      │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  Wait for Database to be Ready          │
│  - Poll: pg_isready -U postgres         │
│  - Retry up to 30 times (60 seconds)    │
│  - Ensures DB is accepting connections  │
└─────────────────┬───────────────────────┘
```

**What happens:**
- Verifies Docker Desktop is running
- Checks if Supabase database container exists
- Waits for PostgreSQL to be ready (can take 10-30 seconds)

### Phase 3: Migration Tracking Setup

```
┌─────────────────────────────────────────┐
│  Check for schema_migrations Table      │
│  - Query: information_schema.tables     │
│  - This table tracks which migrations   │
│    have been executed                    │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  Create Migration Tracking Table        │
│  (if doesn't exist)                     │
│  CREATE TABLE schema_migrations (       │
│    version VARCHAR(255) PRIMARY KEY,    │
│    executed_at TIMESTAMPTZ              │
│  )                                      │
└─────────────────┬───────────────────────┘
```

**What happens:**
- Creates a tracking table to prevent duplicate migrations
- Stores filename and execution timestamp
- Enables idempotent runs (safe to run multiple times)

### Phase 4: Migration Execution

```
┌─────────────────────────────────────────┐
│  Scan Migration Files                   │
│  - Read: supabase/migrations/*.sql      │
│  - Sort alphabetically (chronological)  │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  For Each Migration File:               │
│                                          │
│  1. Check if already executed           │
│     - Query schema_migrations table     │
│     - Skip if found (unless -Force)     │
│                                          │
│  2. Execute SQL File                    │
│     - Read file content                 │
│     - Pipe to: psql -U postgres         │
│     - Run inside Docker container       │
│                                          │
│  3. Record Execution                    │
│     - INSERT INTO schema_migrations     │
│     - Mark as executed                  │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  Migration Summary                      │
│  - Success count                        │
│  - Skipped count                        │
│  - Failed count (if any)                │
└─────────────────────────────────────────┘
```

**What happens:**
- Reads all `.sql` files from `supabase/migrations/`
- Executes them in alphabetical order (ensures dependencies)
- Tracks which ones have run to avoid duplicates
- Continues even if one migration fails (logs error)

**Example execution:**
```sql
-- File: 20250129_create_inventory_tables.sql
CREATE TABLE locations (...);
CREATE TABLE inventory_movements (...);
INSERT INTO locations VALUES (...);

-- Executed via:
docker exec -i supabase-db psql -U postgres -d postgres < file.sql
```

### Phase 5: Master Data Initialization

```
┌─────────────────────────────────────────┐
│  Initialize Master Data in Order:       │
│                                          │
│  1. System Settings (Main)              │
│  2. System Settings (Additional)         │
│  3. System Settings (Invoice)            │
│  4. System Settings (Signup)             │
│  5. Roles                                │
│  6. Taxes                                │
│  7. Locations                            │
│  8. Categories, Units, Products          │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  For Each Master Data File:             │
│                                          │
│  1. Check if data exists                │
│     - COUNT(*) FROM table               │
│     - Skip if data present (unless -Force)│
│                                          │
│  2. Execute INSERT statements           │
│     - Run SQL file                      │
│     - Use ON CONFLICT to avoid dupes    │
│                                          │
│  3. Verify insertion                    │
│     - Check row count                   │
│     - Report success/failure            │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  Master Data Summary                    │
│  - Count entries for each table:        │
│    * system_settings: 52 entries        │
│    * roles: 3 entries                   │
│    * taxes: 3 entries                   │
│    * categories: 3 entries              │
│    * units: 3 entries                   │
│    * locations: 3 entries              │
│    * suppliers: 5 entries              │
│    * customers: 5 entries              │
│    * products: 3 entries                │
│    * profiles: 0 entries (auto-created) │
│    * user_settings: 0 (auto-created)    │
└─────────────────────────────────────────┘
```

**What happens:**
- Checks each master table for existing data
- Runs INSERT statements from migration files
- Uses `ON CONFLICT DO NOTHING` to prevent duplicates
- Shows summary of all master data counts

## Key Components

### 1. Migration Tracking
- **Purpose**: Prevents running same migration twice
- **Table**: `schema_migrations`
- **Fields**: `version` (filename), `executed_at` (timestamp)

### 2. Idempotency
- Script can be run multiple times safely
- Already-executed migrations are skipped
- Existing master data is preserved (unless `-Force`)

### 3. Docker Integration
- Executes SQL via: `docker exec -i supabase-db psql ...`
- No need for direct PostgreSQL connection
- Works entirely through Docker containers

### 4. Error Handling
- Continues on warnings (e.g., schema pull fails)
- Logs errors but doesn't stop execution
- Shows summary of what succeeded/failed

## Database Connection Flow

```
PowerShell Script
       │
       │ Executes SQL
       ▼
docker exec -i supabase-db
       │
       │ Runs PostgreSQL command
       ▼
psql -U postgres -d postgres
       │
       │ Connects to database
       ▼
PostgreSQL Database (inside container)
       │
       │ Executes SQL
       ▼
Tables, Data, Functions Created
```

## Example: Running a Migration

**Migration File:** `20250129_insert_system_settings.sql`
```sql
INSERT INTO public.system_settings (setting_key, setting_value, ...)
VALUES ('company_name', '"Versal WMS"', ...);
```

**Execution:**
1. Script reads file content
2. Pipes to: `docker exec -i supabase-db psql -U postgres -d postgres`
3. PostgreSQL executes INSERT
4. Script records: `INSERT INTO schema_migrations VALUES ('20250129_insert_system_settings.sql')`
5. Reports success

## Command Flow Diagram

```
User runs: .\scripts\init-database.ps1
    │
    ├─► Check Supabase CLI → Pull Schema (if enabled)
    │
    ├─► Check Docker → Verify Container Running
    │
    ├─► Wait for Database Ready → pg_isready
    │
    ├─► Create schema_migrations table (if needed)
    │
    ├─► For each migration file:
    │   ├─► Check if executed
    │   ├─► Execute SQL (if not executed)
    │   └─► Record in schema_migrations
    │
    ├─► For each master data file:
    │   ├─► Check if data exists
    │   ├─► Execute INSERT (if empty)
    │   └─► Verify insertion
    │
    └─► Show summary → Complete!
```

## Important Notes

1. **Schema Pull vs Migrations**
   - Schema pull: Gets latest structure from Supabase
   - Migrations: Apply that structure + INSERT data

2. **Master Data Order Matters**
   - System settings must be first
   - Roles before profiles
   - Categories/Units before Products

3. **Auto-Created Tables**
   - `profiles`: Created by trigger when users sign up
   - `user_settings`: Created by trigger when profiles created
   - No seed data needed for these

4. **Safety Features**
   - Migration tracking prevents duplicates
   - ON CONFLICT clauses prevent data duplicates
   - Force flag allows re-initialization

## Troubleshooting

**Database not ready?**
- Container may still be starting
- Check: `docker logs supabase-db`

**Migration fails?**
- Check SQL syntax in migration file
- Verify table dependencies exist
- Check logs: Script shows which migration failed

**No data inserted?**
- Check if data already exists (will skip)
- Use `-Force` flag to re-insert
- Verify migration file has INSERT statements

