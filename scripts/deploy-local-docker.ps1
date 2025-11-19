#Requires -Version 5.1

# Local Docker deployment script for Windows
# Usage: .\deploy-local-docker.ps1 [-Target api|web|supabase|all] [-Services "svc1 svc2 ..."]

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("api", "web", "supabase", "all", "backend", "frontend")]
    [string]$Target = "",
    
    [Parameter(Mandatory=$false)]
    [string]$Services = "",
    
    [Parameter(Mandatory=$false)]
    [switch]$Help,
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipEnvCheck,
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipDbInit,
    
    [Parameter(Mandatory=$false)]
    [switch]$InitDbOnly,
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipSchemaPull,
    
    [Parameter(Mandatory=$false)]
    [string]$ProjectId = "bmyaefeddtcbnmpzvxmf"
)

$ErrorActionPreference = "Stop"

# Resolve repo root regardless of where this script is run from
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir

# Change to repo root
Set-Location $RepoRoot

function Show-Help {
    Write-Host @"
Usage: .\deploy-local-docker.ps1 [-Target api|web|supabase|all] [-Services "svc1 svc2 ..."] [-SkipEnvCheck] [-SkipDbInit] [-InitDbOnly]

Parameters:
    -Target        Target deployment group: api, web, supabase, or all
    -Services      Space-separated list of specific service names
    -SkipEnvCheck  Skip .env file validation and creation prompts (useful for automation)
    -SkipDbInit    Skip database initialization (migrations and seed data)
    -InitDbOnly    Only initialize database, don't start containers
    -Help          Show this help message

Environment Variables:
    The script will check for a .env file in the repository root. If not found, it will
    offer to create one from .env.example or env.example. Required variables:
    - SUPABASE_ANON_KEY (required)
    - SUPABASE_SERVICE_KEY (required)
    - SUPABASE_JWT_SECRET (required)
    
    Generate secrets using: openssl rand -base64 32

Database Initialization:
    After Supabase containers start, the script will automatically:
    - Pull latest schema from Supabase project (unless -SkipSchemaPull)
    - Run all migrations from supabase/migrations/
    - Initialize system settings
    - Seed roles and other initial data
    
    Use -SkipDbInit to skip this step, or run separately:
    .\scripts\init-database.ps1
    
    To skip schema pull:
    .\scripts\deploy-local-docker.ps1 -Target supabase -SkipSchemaPull

Examples:
    .\deploy-local-docker.ps1 -Target api
    .\deploy-local-docker.ps1 -Target supabase
    .\deploy-local-docker.ps1 -Services "api web"
    .\deploy-local-docker.ps1 -Target all
    .\deploy-local-docker.ps1 -Target all -SkipEnvCheck
    .\deploy-local-docker.ps1 -InitDbOnly
    .\deploy-local-docker.ps1 -Target supabase -SkipSchemaPull
"@
}

if ($Help) {
    Show-Help
    exit 0
}

# If InitDbOnly is specified, just run database initialization
if ($InitDbOnly) {
    $InitScript = Join-Path $ScriptDir "init-database.ps1"
    if (Test-Path $InitScript) {
        Write-Host "Running database initialization only..." -ForegroundColor Cyan
        & $InitScript
        exit $LASTEXITCODE
    } else {
        Write-Host "Error: Database initialization script not found: $InitScript" -ForegroundColor Red
        exit 1
    }
}

Write-Host "Deploying locally with Docker..." -ForegroundColor Cyan
Write-Host "Repository root: $RepoRoot" -ForegroundColor Gray

# Check if Docker is running
Write-Host "`nChecking Docker..." -ForegroundColor Yellow
try {
    $dockerVersion = docker version 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error: Docker is not running or not accessible." -ForegroundColor Red
        Write-Host "Please ensure Docker Desktop is running on Windows." -ForegroundColor Red
        exit 1
    }
    Write-Host "Docker is running" -ForegroundColor Green
} catch {
    Write-Host "Error: Could not connect to Docker. Please ensure Docker Desktop is running." -ForegroundColor Red
    exit 1
}

# Check for docker-compose.yml
$ComposeFile = Join-Path $RepoRoot "docker-compose.yml"
if (-not (Test-Path $ComposeFile)) {
    Write-Host "Error: docker-compose.yml not found at $ComposeFile" -ForegroundColor Red
    exit 1
}

# Determine compose command (docker compose preferred, fallback to docker-compose)
$ComposeCmd = $null
try {
    docker compose version > $null 2>&1
    if ($LASTEXITCODE -eq 0) {
        $ComposeCmd = "docker compose"
        Write-Host "Using 'docker compose' (new syntax)" -ForegroundColor Gray
    }
} catch {
    # Fall through to check docker-compose
}

if (-not $ComposeCmd) {
    try {
        docker-compose version > $null 2>&1
        if ($LASTEXITCODE -eq 0) {
            $ComposeCmd = "docker-compose"
            Write-Host "Using 'docker-compose' (legacy syntax)" -ForegroundColor Gray
        }
    } catch {
        # Fall through
    }
}

if (-not $ComposeCmd) {
    Write-Host "Error: Neither 'docker compose' nor 'docker-compose' is available." -ForegroundColor Red
    exit 1
}

# Check .env file
$EnvFile = Join-Path $RepoRoot ".env"
$EnvExampleFile = Join-Path $RepoRoot ".env.example"
# Also check for env.example (without the dot)
if (-not (Test-Path $EnvExampleFile)) {
    $EnvExampleFile = Join-Path $RepoRoot "env.example"
}

if (Test-Path $EnvFile) {
    Write-Host "`nFound .env file at $EnvFile" -ForegroundColor Green
    
    # Validate required environment variables
    $envContent = Get-Content $EnvFile -Raw
    $requiredVars = @(
        "SUPABASE_ANON_KEY",
        "SUPABASE_SERVICE_KEY",
        "SUPABASE_JWT_SECRET"
    )
    
    $missingVars = @()
    foreach ($var in $requiredVars) {
        if ($envContent -notmatch "$var\s*=" -or $envContent -match "$var\s*=\s*(your-|your_)") {
            $missingVars += $var
        }
    }
    
    if ($missingVars.Count -gt 0) {
        Write-Host "Warning: Some required environment variables are missing or have placeholder values:" -ForegroundColor Yellow
        foreach ($var in $missingVars) {
            Write-Host "  - $var" -ForegroundColor Yellow
        }
        Write-Host "`nPlease update your .env file with actual values." -ForegroundColor Yellow
        Write-Host "You can generate secrets using: openssl rand -base64 32" -ForegroundColor Gray
    } else {
        Write-Host "Required environment variables are configured" -ForegroundColor Green
    }
} else {
    Write-Host "`n.env file not found" -ForegroundColor Yellow
    
    if (Test-Path $EnvExampleFile) {
        if ($SkipEnvCheck) {
            Write-Host "Skipping .env creation (SkipEnvCheck flag set)" -ForegroundColor Gray
            Write-Host "Note: Some services may fail without required environment variables." -ForegroundColor Yellow
        } else {
            Write-Host "Found .env.example file. Would you like to create .env from it? (Y/n)" -ForegroundColor Cyan
            $response = Read-Host
            if ($response -eq "" -or $response -eq "Y" -or $response -eq "y") {
                Copy-Item $EnvExampleFile $EnvFile
                Write-Host "Created .env file from .env.example" -ForegroundColor Green
                Write-Host "Please update $EnvFile with your actual configuration values." -ForegroundColor Yellow
                Write-Host "Required variables to set:" -ForegroundColor Yellow
                Write-Host "  - SUPABASE_ANON_KEY" -ForegroundColor Gray
                Write-Host "  - SUPABASE_SERVICE_KEY" -ForegroundColor Gray
                Write-Host "  - SUPABASE_JWT_SECRET" -ForegroundColor Gray
                Write-Host "`nYou can generate secrets using: openssl rand -base64 32" -ForegroundColor Gray
                Write-Host "`nPress Enter to continue after updating .env, or Ctrl+C to cancel..." -ForegroundColor Cyan
                Read-Host
            } else {
                Write-Host "Skipping .env creation. Docker Compose will use defaults if any." -ForegroundColor Yellow
                Write-Host "Note: Some services may fail without required environment variables." -ForegroundColor Yellow
            }
        }
    } else {
        Write-Host "Warning: .env.example file not found." -ForegroundColor Yellow
        Write-Host "Docker Compose will use defaults if any, but some services may require:" -ForegroundColor Yellow
        Write-Host "  - SUPABASE_ANON_KEY" -ForegroundColor Gray
        Write-Host "  - SUPABASE_SERVICE_KEY" -ForegroundColor Gray
        Write-Host "  - SUPABASE_JWT_SECRET" -ForegroundColor Gray
    }
}

# Validate compose config
Write-Host "`nValidating docker-compose.yml..." -ForegroundColor Yellow
try {
    Invoke-Expression "$ComposeCmd config" | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error: docker-compose.yml validation failed." -ForegroundColor Red
        exit 1
    }
    Write-Host "Configuration is valid" -ForegroundColor Green
} catch {
    Write-Host "Error: Failed to validate docker-compose.yml" -ForegroundColor Red
    exit 1
}

########################################
# Service selection
########################################
# Allow selection via CLI parameters or env vars
$TargetOpts = if ($Target) { $Target } else { $env:TARGET }
$ServicesOpts = if ($Services) { $Services } else { $env:SERVICES }

# Map target to services if SERVICES not provided
$SupabaseGroup = "supabase-db supabase-auth supabase-rest supabase-realtime supabase-meta supabase-storage supabase-kong supabase-studio"

$ComposeServices = $ServicesOpts
if ([string]::IsNullOrWhiteSpace($ComposeServices) -and -not [string]::IsNullOrWhiteSpace($TargetOpts)) {
    switch ($TargetOpts.ToLower()) {
        { $_ -in "api", "backend" } {
            $ComposeServices = "api"
        }
        { $_ -in "web", "frontend" } {
            $ComposeServices = "web"
        }
        "supabase" {
            $ComposeServices = $SupabaseGroup
        }
        "all" {
            $ComposeServices = "" # empty means all services
        }
        default {
            Write-Host "Warning: Unknown target '$TargetOpts'. Deploying all services." -ForegroundColor Yellow
            $ComposeServices = ""
        }
    }
}

if (-not [string]::IsNullOrWhiteSpace($ComposeServices)) {
    Write-Host "`nDeploying services: $ComposeServices" -ForegroundColor Cyan
} else {
    Write-Host "`nDeploying ALL services in compose file" -ForegroundColor Cyan
}

# Pull images (optional, continue on failure)
Write-Host "`nPulling images..." -ForegroundColor Yellow
try {
    if (-not [string]::IsNullOrWhiteSpace($ComposeServices)) {
        Invoke-Expression "$ComposeCmd pull $ComposeServices" 2>&1 | Out-Null
    } else {
        Invoke-Expression "$ComposeCmd pull" 2>&1 | Out-Null
    }
    # Don't fail on pull errors - we'll build anyway
} catch {
    Write-Host "Note: Some images could not be pulled (will build from source if needed)" -ForegroundColor Gray
}

# Build and deploy selected services (or all if none specified)
Write-Host "`nBuilding and starting containers..." -ForegroundColor Yellow
try {
    if (-not [string]::IsNullOrWhiteSpace($ComposeServices)) {
        Invoke-Expression "$ComposeCmd up -d --build $ComposeServices"
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Error: Failed to start services" -ForegroundColor Red
            exit 1
        }
    } else {
        Invoke-Expression "$ComposeCmd up -d --build --remove-orphans"
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Error: Failed to start services" -ForegroundColor Red
            exit 1
        }
    }
    Write-Host "`nContainers started successfully" -ForegroundColor Green
} catch {
    Write-Host "Error: Failed to start containers" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

# Show container status
Write-Host "`nContainer status:" -ForegroundColor Cyan
Invoke-Expression "$ComposeCmd ps"

# Initialize database if Supabase services were deployed
if (-not $SkipDbInit) {
    $supabaseServices = @("supabase-db", "supabase-auth", "supabase-rest", "supabase-kong")
    $shouldInitDb = $false
    
    if ([string]::IsNullOrWhiteSpace($ComposeServices)) {
        # All services - check if Supabase is in the compose file
        $shouldInitDb = $true
    } elseif ($ComposeServices -match "supabase") {
        $shouldInitDb = $true
    } else {
        # Check if any Supabase service is in the services list
        foreach ($svc in $supabaseServices) {
            if ($ComposeServices -match $svc) {
                $shouldInitDb = $true
                break
            }
        }
    }
    
    if ($shouldInitDb) {
        Write-Host "`nInitializing database..." -ForegroundColor Cyan
        $InitScript = Join-Path $ScriptDir "init-database.ps1"
        if (Test-Path $InitScript) {
            # Wait a bit for Supabase to fully start
            Write-Host "Waiting for Supabase services to be ready..." -ForegroundColor Yellow
            Start-Sleep -Seconds 5
            
            # Build parameters for init script
            $initParams = @{}
            if ($SkipSchemaPull) {
                $initParams['SkipSchemaPull'] = $true
            }
            $initParams['ProjectId'] = $ProjectId
            
            & $InitScript @initParams
            if ($LASTEXITCODE -ne 0) {
                Write-Host "Warning: Database initialization had issues. You can run it manually:" -ForegroundColor Yellow
                Write-Host "  .\scripts\init-database.ps1" -ForegroundColor Gray
            }
        } else {
            Write-Host "Warning: Database initialization script not found: $InitScript" -ForegroundColor Yellow
            Write-Host "You can run database initialization manually:" -ForegroundColor Gray
            Write-Host "  .\scripts\init-database.ps1" -ForegroundColor Gray
        }
    }
}

Write-Host "`nDeployment complete!" -ForegroundColor Green
Write-Host "`nUseful commands:" -ForegroundColor Gray
Write-Host "  View logs: $ComposeCmd logs -f [service]" -ForegroundColor Gray
Write-Host "  Stop services: $ComposeCmd down" -ForegroundColor Gray
Write-Host "  View status: $ComposeCmd ps" -ForegroundColor Gray
Write-Host "  Initialize DB: .\scripts\init-database.ps1" -ForegroundColor Gray

