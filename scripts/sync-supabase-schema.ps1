#Requires -Version 5.1

# Sync latest schema from Supabase project to local migrations
# This pulls the latest database schema from the live Supabase project

param(
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

function Show-Help {
    Write-Host @"
Usage: .\sync-supabase-schema.ps1 [-ProjectId <id>] [-Help]

Parameters:
    -ProjectId     Supabase project ID (default: bmyaefeddtcbnmpzvxmf)
    -Help          Show this help message

This script:
1. Checks if Supabase CLI is installed
2. Links to the Supabase project (if not already linked)
3. Pulls the latest database schema from the live project
4. Updates local migrations with the latest schema

Prerequisites:
    - Supabase CLI installed: https://supabase.com/docs/guides/cli
    - Logged in to Supabase CLI: supabase login
"@
}

if ($Help) {
    Show-Help
    exit 0
}

Write-Host "Syncing schema from Supabase project..." -ForegroundColor Cyan
Write-Host "Project ID: $ProjectId" -ForegroundColor Gray

# Check if Supabase CLI is installed
Write-Host "`nChecking Supabase CLI..." -ForegroundColor Yellow
try {
    $supabaseVersion = supabase --version 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error: Supabase CLI is not installed or not in PATH" -ForegroundColor Red
        Write-Host "Install from: https://supabase.com/docs/guides/cli" -ForegroundColor Yellow
        Write-Host "Or install via: npm install -g supabase" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "Supabase CLI found: $supabaseVersion" -ForegroundColor Green
} catch {
    Write-Host "Error: Supabase CLI is not installed" -ForegroundColor Red
    Write-Host "Install from: https://supabase.com/docs/guides/cli" -ForegroundColor Yellow
    Write-Host "Or install via: npm install -g supabase" -ForegroundColor Yellow
    exit 1
}

# Check if logged in
Write-Host "`nChecking Supabase CLI authentication..." -ForegroundColor Yellow
try {
    supabase projects list > $null 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error: Not logged in to Supabase CLI" -ForegroundColor Red
        Write-Host "Please login first: supabase login" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "Authenticated with Supabase CLI" -ForegroundColor Green
} catch {
    Write-Host "Error: Could not verify Supabase CLI authentication" -ForegroundColor Red
    Write-Host "Please login first: supabase login" -ForegroundColor Yellow
    exit 1
}

# Change to repo root
Set-Location $RepoRoot

# Check if project is already linked
Write-Host "`nChecking project link..." -ForegroundColor Yellow
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
    try {
        supabase link --project-ref $ProjectId 2>&1 | Out-Host
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Project linked successfully" -ForegroundColor Green
        } else {
            Write-Host "Warning: Project link may have failed. Continuing anyway..." -ForegroundColor Yellow
        }
    } catch {
        Write-Host "Warning: Could not link project. Continuing..." -ForegroundColor Yellow
        Write-Host "You may need to link manually: supabase link --project-ref $ProjectId" -ForegroundColor Gray
    }
}

# Pull latest schema
Write-Host "`nPulling latest database schema from Supabase..." -ForegroundColor Cyan
Write-Host "This will create a new migration file with all schema changes." -ForegroundColor Gray

try {
    # Create backup of existing migrations directory
    $migrationsDir = Join-Path $SupabaseDir "migrations"
    if (Test-Path $migrationsDir) {
        $backupDir = Join-Path $SupabaseDir "migrations_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
        Write-Host "Creating backup of existing migrations..." -ForegroundColor Gray
        Copy-Item -Path $migrationsDir -Destination $backupDir -Recurse -ErrorAction SilentlyContinue
    }
    
    # Pull schema
    supabase db pull --schema public 2>&1 | Out-Host
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`nSchema pulled successfully!" -ForegroundColor Green
        Write-Host "New migration file created in: $migrationsDir" -ForegroundColor Gray
        
        # List new migration files
        if (Test-Path $migrationsDir) {
            $newMigrations = Get-ChildItem -Path $migrationsDir -Filter "*.sql" | Sort-Object LastWriteTime -Descending | Select-Object -First 5
            if ($newMigrations.Count -gt 0) {
                Write-Host "`nLatest migration files:" -ForegroundColor Cyan
                foreach ($migration in $newMigrations) {
                    Write-Host "  - $($migration.Name)" -ForegroundColor Gray
                }
            }
        }
    } else {
        Write-Host "`nWarning: Schema pull may have had issues. Check output above." -ForegroundColor Yellow
        Write-Host "You may need to run manually: supabase db pull --schema public" -ForegroundColor Gray
    }
} catch {
    Write-Host "`nError: Failed to pull schema" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

Write-Host "`nSchema sync complete!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "  1. Review the new migration file(s) in $migrationsDir" -ForegroundColor Gray
Write-Host "  2. Run database initialization: .\scripts\init-database.ps1" -ForegroundColor Gray
Write-Host "  3. Or deploy with auto-init: .\scripts\deploy-local-docker.ps1 -Target supabase" -ForegroundColor Gray

