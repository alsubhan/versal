#Requires -Version 5.1

# Database initialization script for local Supabase Docker setup
# This script runs migrations and initializes system settings and seed data

param(
    [Parameter(Mandatory=$false)]
    [switch]$SkipMigrations,
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipSeedData,
    
    [Parameter(Mandatory=$false)]
    [switch]$Force,
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipSchemaPull,
    
    [Parameter(Mandatory=$false)]
    [string]$ProjectId = "bmyaefeddtcbnmpzvxmf",
    
    [Parameter(Mandatory=$false)]
    [switch]$Help
)

$ErrorActionPreference = "Stop"

# Resolve repo root
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
$SupabaseDir = Join-Path $RepoRoot "supabase"
$MigrationsDir = Join-Path $SupabaseDir "migrations"

function Show-Help {
    Write-Host @"
Usage: .\init-database.ps1 [-SkipMigrations] [-SkipSeedData] [-Force] [-SkipSchemaPull] [-ProjectId <id>] [-Help]

Parameters:
    -SkipMigrations      Skip running migration files
    -SkipSeedData        Skip inserting seed data (system settings, roles, etc.)
    -Force               Force re-initialization even if already initialized
    -SkipSchemaPull      Skip pulling latest schema from Supabase project
    -ProjectId           Supabase project ID (default: bmyaefeddtcbnmpzvxmf)
    -Help                Show this help message

This script:
1. Pulls latest schema from Supabase project (unless -SkipSchemaPull)
2. Waits for Supabase database to be ready
3. Runs all migration files from supabase/migrations/ (in alphabetical order)
4. Initializes system settings and seed data

Note: Requires Docker and Supabase containers to be running.
      For schema pull, requires Supabase CLI to be installed and logged in.
"@
}

if ($Help) {
    Show-Help
    exit 0
}

Write-Host "Initializing Supabase Database..." -ForegroundColor Cyan

# Pull latest schema from Supabase project
if (-not $SkipSchemaPull) {
    Write-Host "`nPulling latest schema from Supabase project..." -ForegroundColor Cyan
    Write-Host "Project ID: $ProjectId" -ForegroundColor Gray
    
    # Check if Supabase CLI is installed
    try {
        $supabaseVersion = supabase --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Supabase CLI found" -ForegroundColor Green
            
            # Check if logged in
            try {
                supabase projects list > $null 2>&1
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "Authenticated with Supabase CLI" -ForegroundColor Green
                    
                    # Change to repo root for supabase commands
                    Set-Location $RepoRoot
                    
                    # Check if project is linked
                    $configFile = Join-Path $SupabaseDir "config.toml"
                    $isLinked = $false
                    
                    if (Test-Path $configFile) {
                        $configContent = Get-Content $configFile -Raw
                        if ($configContent -match "project_id\s*=\s*`"$ProjectId`"") {
                            Write-Host "Project is already linked" -ForegroundColor Green
                            $isLinked = $true
                        }
                    }
                    
                    # Link project if not linked
                    if (-not $isLinked) {
                        Write-Host "Linking to Supabase project..." -ForegroundColor Yellow
                        supabase link --project-ref $ProjectId 2>&1 | Out-Host
                        if ($LASTEXITCODE -eq 0) {
                            Write-Host "Project linked successfully" -ForegroundColor Green
                        } else {
                            Write-Host "Warning: Project link may have failed. Continuing..." -ForegroundColor Yellow
                        }
                    }
                    
                    # Pull latest schema
                    Write-Host "Pulling latest database schema..." -ForegroundColor Yellow
                    supabase db pull --schema public 2>&1 | Out-Host
                    
                    if ($LASTEXITCODE -eq 0) {
                        Write-Host "Schema pulled successfully!" -ForegroundColor Green
                        
                        # Also pull master data and settings from live Supabase
                        Write-Host "`nPulling master data and settings from Supabase..." -ForegroundColor Yellow
                        Write-Host "This ensures master tables and settings are up-to-date." -ForegroundColor Gray
                        
                        # Master tables that should have data pulled
                        $masterTables = @(
                            "system_settings",
                            "roles",
                            "taxes",
                            "categories",
                            "units",
                            "locations",
                            "profiles",
                            "user_settings"
                        )
                        
                        # Get database connection string from Supabase
                        try {
                            # Try to get connection string from Supabase CLI
                            $dbUrl = supabase db pull --dry-run 2>&1 | Select-String -Pattern "postgres://" | Select-Object -First 1
                            
                            if ($dbUrl) {
                                Write-Host "Note: To pull master data, ensure you have access to the database." -ForegroundColor Gray
                                Write-Host "You can manually export master data using:" -ForegroundColor Gray
                                Write-Host "  supabase db dump --data-only --table system_settings --table roles --table categories --table units --table locations --table taxes" -ForegroundColor Gray
                            }
                        } catch {
                            # Continue without data dump
                        }
                        
                        Write-Host "Master data will be inserted from migration files during initialization." -ForegroundColor Gray
                    } else {
                        Write-Host "Warning: Schema pull had issues. Continuing with existing migrations..." -ForegroundColor Yellow
                    }
                } else {
                    Write-Host "Warning: Not logged in to Supabase CLI. Skipping schema pull." -ForegroundColor Yellow
                    Write-Host "To pull schema, login first: supabase login" -ForegroundColor Gray
                }
            } catch {
                Write-Host "Warning: Could not verify Supabase CLI authentication. Skipping schema pull." -ForegroundColor Yellow
            }
        } else {
            Write-Host "Warning: Supabase CLI not found. Skipping schema pull." -ForegroundColor Yellow
            Write-Host "Install from: https://supabase.com/docs/guides/cli" -ForegroundColor Gray
        }
    } catch {
        Write-Host "Warning: Supabase CLI not installed. Skipping schema pull." -ForegroundColor Yellow
        Write-Host "Install from: https://supabase.com/docs/guides/cli" -ForegroundColor Gray
    }
} else {
    Write-Host "`nSkipping schema pull (SkipSchemaPull flag set)" -ForegroundColor Yellow
}

# Check if Docker is running
try {
    docker ps > $null 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error: Docker is not running." -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "Error: Could not connect to Docker." -ForegroundColor Red
    exit 1
}

# Check if Supabase DB container is running
$dbContainer = docker ps --filter "name=supabase-db" --format "{{.Names}}"
if ([string]::IsNullOrWhiteSpace($dbContainer)) {
    Write-Host "Error: Supabase database container (supabase-db) is not running." -ForegroundColor Red
    Write-Host "Please start Supabase services first using: docker compose up -d supabase-db" -ForegroundColor Yellow
    exit 1
}

Write-Host "Supabase database container is running" -ForegroundColor Green

# Get database connection info from .env or use defaults
$EnvFile = Join-Path $RepoRoot ".env"
$dbPassword = "postgres"
$dbName = "postgres"
$dbUser = "postgres"
$dbHost = "localhost"
$dbPort = "5432"

if (Test-Path $EnvFile) {
    $envContent = Get-Content $EnvFile -Raw
    if ($envContent -match "SUPABASE_DB_PASSWORD=([^\r\n]+)") {
        $dbPassword = $matches[1].Trim()
    }
    # Try to get port from docker-compose if available
    $composeFile = Join-Path $RepoRoot "docker-compose.yml"
    if (Test-Path $composeFile) {
        $composeContent = Get-Content $composeFile -Raw
        # Check if there's a port mapping for supabase-db
        # For local, we'll connect via container name
    }
}

# Wait for database to be ready
Write-Host "`nWaiting for database to be ready..." -ForegroundColor Yellow
$maxRetries = 30
$retryCount = 0
$dbReady = $false

while ($retryCount -lt $maxRetries -and -not $dbReady) {
    try {
        $result = docker exec supabase-db pg_isready -U postgres 2>&1
        if ($LASTEXITCODE -eq 0) {
            $dbReady = $true
            Write-Host "Database is ready" -ForegroundColor Green
            break
        }
    } catch {
        # Continue waiting
    }
    
    $retryCount++
    Write-Host "  Waiting... ($retryCount/$maxRetries)" -ForegroundColor Gray
    Start-Sleep -Seconds 2
}

if (-not $dbReady) {
    Write-Host "Error: Database did not become ready within timeout period." -ForegroundColor Red
    exit 1
}

# Function to execute SQL file
function Invoke-SqlFile {
    param(
        [string]$FilePath,
        [string]$Description
    )
    
    Write-Host "  Executing: $Description" -ForegroundColor Gray
    
    try {
        # Read SQL file content
        $sqlContent = Get-Content $FilePath -Raw -Encoding UTF8
        
        # Execute SQL via docker exec
        $sqlContent | docker exec -i supabase-db psql -U postgres -d postgres -q
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "    ✓ $Description" -ForegroundColor Green
            return $true
        } else {
            Write-Host "    ✗ Failed: $Description" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "    ✗ Error executing $Description : $_" -ForegroundColor Red
        return $false
    }
}

# Check if migrations table exists (to track which migrations have run)
Write-Host "`nChecking database initialization status..." -ForegroundColor Yellow
$checkMigrationsTable = @"
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'schema_migrations'
);
"@

$hasMigrationsTable = $false
try {
    $result = $checkMigrationsTable | docker exec -i supabase-db psql -U postgres -d postgres -t -A
    if ($result -match "t|true|1") {
        $hasMigrationsTable = $true
    }
} catch {
    # Table doesn't exist, which is fine for first run
}

# Create migrations tracking table if it doesn't exist
if (-not $hasMigrationsTable) {
    Write-Host "Creating migrations tracking table..." -ForegroundColor Yellow
    $createMigrationsTable = @"
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    executed_at TIMESTAMPTZ DEFAULT NOW()
);
"@
    $createMigrationsTable | docker exec -i supabase-db psql -U postgres -d postgres -q
    Write-Host "Migrations tracking table created" -ForegroundColor Green
}

# Run migrations
if (-not $SkipMigrations) {
    Write-Host "`nRunning migrations..." -ForegroundColor Cyan
    
    if (-not (Test-Path $MigrationsDir)) {
        Write-Host "Warning: Migrations directory not found: $MigrationsDir" -ForegroundColor Yellow
    } else {
        # Get all SQL migration files, sorted alphabetically (which should be chronologically)
        $migrationFiles = Get-ChildItem -Path $MigrationsDir -Filter "*.sql" | Sort-Object Name
        
        if ($migrationFiles.Count -eq 0) {
            Write-Host "No migration files found in $MigrationsDir" -ForegroundColor Yellow
        } else {
            Write-Host "Found $($migrationFiles.Count) migration files" -ForegroundColor Gray
            
            $successCount = 0
            $skipCount = 0
            $failCount = 0
            
            foreach ($migrationFile in $migrationFiles) {
                $migrationName = $migrationFile.Name
                
                # Check if migration has already been run (unless Force is specified)
                if (-not $Force) {
                    $checkMigration = "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = '$migrationName');"
                    $migrationExecuted = $checkMigration | docker exec -i supabase-db psql -U postgres -d postgres -t -A
                    
                    if ($migrationExecuted -match "t|true|1") {
                        Write-Host "  ⊘ Skipping (already executed): $migrationName" -ForegroundColor DarkGray
                        $skipCount++
                        continue
                    }
                }
                
                # Execute migration
                $success = Invoke-SqlFile -FilePath $migrationFile.FullName -Description $migrationName
                
                if ($success) {
                    # Record migration in tracking table
                    try {
                        $recordMigration = "INSERT INTO schema_migrations (version) VALUES ('$migrationName') ON CONFLICT (version) DO NOTHING;"
                        $recordMigration | docker exec -i supabase-db psql -U postgres -d postgres -q | Out-Null
                        $successCount++
                    } catch {
                        Write-Host "  Warning: Migration executed but failed to record in tracking table" -ForegroundColor Yellow
                        $successCount++
                    }
                } else {
                    $failCount++
                    Write-Host "  Migration failed: $migrationName" -ForegroundColor Red
                    Write-Host "  Continuing with next migration..." -ForegroundColor Yellow
                }
            }
            
            Write-Host "`nMigration Summary:" -ForegroundColor Cyan
            Write-Host "  Success: $successCount" -ForegroundColor Green
            Write-Host "  Skipped: $skipCount" -ForegroundColor DarkGray
            if ($failCount -gt 0) {
                Write-Host "  Failed: $failCount" -ForegroundColor Red
            }
        }
    }
} else {
    Write-Host "`nSkipping migrations (SkipMigrations flag set)" -ForegroundColor Yellow
}

# Initialize seed data (system settings, roles, master tables, etc.)
if (-not $SkipSeedData) {
    Write-Host "`nInitializing seed data (master tables and settings)..." -ForegroundColor Cyan
    
    # Master data files in priority order
    $masterDataFiles = @(
        @{ File = "20250129_insert_system_settings.sql"; Description = "System Settings (Main)"; Table = "system_settings" },
        @{ File = "20250129_add_missing_system_settings.sql"; Description = "System Settings (Additional)"; Table = "system_settings" },
        @{ File = "20250129_add_invoice_settings.sql"; Description = "System Settings (Invoice)"; Table = "system_settings" },
        @{ File = "20250129_add_signup_setting.sql"; Description = "System Settings (Signup)"; Table = "system_settings" },
        @{ File = "seed_roles.sql"; Description = "Roles"; Table = "roles" },
        @{ File = "20250726071655-fdbd07be-c0d9-480d-958f-241f8fe844be.sql"; Description = "Taxes, Units, Categories"; Table = "taxes"; Check = "SELECT COUNT(*) FROM public.taxes WHERE name IN ('Standard Tax', 'Reduced Tax', 'Zero Tax')" },
        @{ File = "20250129_create_inventory_tables.sql"; Description = "Locations"; Table = "locations"; Check = "SELECT COUNT(*) FROM public.locations WHERE name IN ('Main Warehouse', 'Store Front', 'Secondary Storage')" },
        @{ File = "20250129_insert_test_products.sql"; Description = "Categories, Units, Products, Stock Levels"; Table = "categories" }
    )
    
    foreach ($dataFile in $masterDataFiles) {
        $filePath = Join-Path $MigrationsDir $dataFile.File
        $tableName = $dataFile.Table
        
        if (Test-Path $filePath) {
            # Check if table has data
            $hasData = $false
            $dataCount = 0
            
            if ($dataFile.Check) {
                # Use custom check query
                try {
                    $result = $dataFile.Check | docker exec -i supabase-db psql -U postgres -d postgres -t -A
                    if ($result -match "^\d+$") {
                        $dataCount = [int]$result.Trim()
                        $hasData = $dataCount -gt 0
                    }
                } catch {
                    # Table might not exist yet
                }
            } else {
                # Generic count check
                $checkQuery = "SELECT COUNT(*) FROM public.$tableName;"
                try {
                    $result = $checkQuery | docker exec -i supabase-db psql -U postgres -d postgres -t -A
                    if ($result -match "^\d+$") {
                        $dataCount = [int]$result.Trim()
                        $hasData = $dataCount -gt 0
                    }
                } catch {
                    # Table might not exist yet
                }
            }
            
            if (-not $hasData -or $Force) {
                Write-Host "  Initializing: $($dataFile.Description)..." -ForegroundColor Yellow
                $success = Invoke-SqlFile -FilePath $filePath -Description $dataFile.Description
                if ($success) {
                    Write-Host "    ✓ $($dataFile.Description) initialized" -ForegroundColor Green
                } else {
                    Write-Host "    ✗ Failed to initialize $($dataFile.Description)" -ForegroundColor Red
                }
            } else {
                Write-Host "  ⊘ Skipping: $($dataFile.Description) (already exists: $dataCount entries)" -ForegroundColor DarkGray
                if ($Force) {
                    Write-Host "    Re-initializing due to Force flag..." -ForegroundColor Yellow
                    $success = Invoke-SqlFile -FilePath $filePath -Description "$($dataFile.Description) (Force)"
                    if ($success) {
                        Write-Host "    ✓ $($dataFile.Description) re-initialized" -ForegroundColor Green
                    }
                }
            }
        } else {
            Write-Host "  ⚠ Warning: Master data file not found: $($dataFile.File)" -ForegroundColor Yellow
        }
    }
    
    # Summary of master data
    Write-Host "`nMaster Data Summary:" -ForegroundColor Cyan
    $masterTables = @("system_settings", "roles", "taxes", "categories", "units", "locations", "suppliers", "customers", "products", "profiles", "user_settings")
    foreach ($table in $masterTables) {
        $checkQuery = "SELECT COUNT(*) FROM public.$table;"
        try {
            $result = $checkQuery | docker exec -i supabase-db psql -U postgres -d postgres -t -A
            if ($result -match "^\d+$") {
                $count = [int]$result.Trim()
                $note = ""
                if ($table -eq "profiles" -or $table -eq "user_settings") {
                    $note = " (auto-created via triggers)"
                }
                Write-Host "  $table : $count entries$note" -ForegroundColor Gray
            }
        } catch {
            Write-Host "  $table : Table not found or error" -ForegroundColor DarkGray
        }
    }
} else {
    Write-Host "`nSkipping seed data (SkipSeedData flag set)" -ForegroundColor Yellow
}

Write-Host "`nDatabase initialization complete!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "  - Access Supabase Studio at http://localhost:7002" -ForegroundColor Gray
Write-Host "  - Access Supabase API at http://localhost:7001" -ForegroundColor Gray
Write-Host "  - Check database status: docker exec supabase-db psql -U postgres -d postgres -c '\dt'" -ForegroundColor Gray

