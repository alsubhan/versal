#!/usr/bin/env bash
set -euo pipefail

# Local Docker deployment script for macOS
# Usage: ./deploy-local.sh [--target api|web|supabase|all] [--services "svc1 svc2 ..."]

# Resolve repo root regardless of where this script is run from
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Change to repo root
cd "${REPO_ROOT}"

show_help() {
  cat <<USAGE
Usage: $(basename "$0") [--target api|web|supabase|all] [--services "svc1 svc2 ..."] [--skip-env-check] [--blank-db] [--project-name NAME] [--core] [--force]

Parameters:
    --target          Target deployment group: api, web, supabase, or all
    --services        Space-separated list of specific service names
    --skip-env-check  Skip .env file validation and creation prompts (useful for automation)
    --blank-db        Initialize database as blank (no schema or data, only auth prerequisites)
    --project-name    Docker Compose project name (default: supabase). Use different names to run multiple instances.
    --core            Deploy only core services (db, kong, auth, rest, studio, meta). Default: deploy all services.
    --force           Force reinitialize: stop containers, remove volumes, and start fresh (WARNING: deletes all data)
    --help            Show this help message

Deployment Order:
    1. Official Supabase Docker setup is cloned/updated from GitHub (if needed)
    2. Supabase services are deployed first (if needed)
    3. Keys are extracted/generated and .env is updated
    4. Other services (api, web) are deployed after Supabase is ready

Environment Variables:
    The script will check for a .env file in the repository root. If not found, it will
    offer to create one from .env.example or env.example.
    
    For Supabase deployment, JWT_SECRET is required (or will be generated).
    ANON_KEY and SERVICE_ROLE_KEY will be generated from JWT_SECRET.
    The script uses the official Supabase Docker setup from GitHub and merges
    your custom services (api, web) with it.

Examples:
    ./deploy-local.sh --target supabase
    ./deploy-local.sh --target supabase --core
    ./deploy-local.sh --target supabase --blank-db
    ./deploy-local.sh --target supabase --project-name supabase-dev
    ./deploy-local.sh --target supabase --force
    ./deploy-local.sh --target all
    ./deploy-local.sh --target all --core
    ./deploy-local.sh --target api
    ./deploy-local.sh --services "api web"
    
Note: To run multiple Supabase instances, use --project-name with different names
      and ensure ports don't conflict (update KONG_HTTP_PORT in .env).
      
      Use --core to deploy only core services (db, kong, auth, rest, studio, meta)
      and skip optional services (realtime, storage, functions, supavisor, etc.).
USAGE
}

# Function to generate JWT token from secret
generate_jwt_token() {
  local role="$1"
  local jwt_secret="$2"
  
  # JWT header
  local header='{"alg":"HS256","typ":"JWT"}'
  
  # JWT payload with role
  local payload="{\"role\":\"${role}\",\"iss\":\"supabase\",\"aud\":\"supabase\"}"
  
  # Base64 encode header and payload
  local header_b64=$(echo -n "${header}" | base64 | tr -d '=' | tr '/+' '_-' | tr -d '\n')
  local payload_b64=$(echo -n "${payload}" | base64 | tr -d '=' | tr '/+' '_-' | tr -d '\n')
  
  # Create signature
  local signature=$(echo -n "${header_b64}.${payload_b64}" | openssl dgst -sha256 -hmac "${jwt_secret}" -binary | base64 | tr -d '=' | tr '/+' '_-' | tr -d '\n')
  
  # Return JWT token
  echo "${header_b64}.${payload_b64}.${signature}"
}

# Function to update .env file with key
update_env_key() {
  local key="$1"
  local value="$2"
  local env_file="$3"
  
  if grep -q "^${key}=" "${env_file}"; then
    # Update existing key
    if [[ "$OSTYPE" == "darwin"* ]]; then
      # macOS
      sed -i '' "s|^${key}=.*|${key}=${value}|" "${env_file}"
    else
      # Linux
      sed -i "s|^${key}=.*|${key}=${value}|" "${env_file}"
    fi
  else
    # Add new key
    echo "${key}=${value}" >> "${env_file}"
  fi
}

ensure_auth_factor_type() {
  echo ""
  echo "Ensuring auth schema prerequisites..."
  # Use db service name from official Supabase (usually just 'db')
  local db_service="db"
  if docker ps --format '{{.Names}}' | grep -q "^supabase-db$"; then
    db_service="supabase-db"
  elif docker ps --format '{{.Names}}' | grep -q "^.*-db-.*$"; then
    db_service=$(docker ps --format '{{.Names}}' | grep "db" | head -1)
  fi
  docker exec -i "${db_service}" psql -U postgres -d postgres <<'SQL' >/dev/null 2>&1 || true
CREATE SCHEMA IF NOT EXISTS auth;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'factor_type' AND typnamespace = 'auth'::regnamespace
  ) THEN
    CREATE TYPE auth.factor_type AS ENUM ('totp');
  END IF;
END $$;
SQL
}

# Parse arguments
TARGET_OPTS=""
SERVICES_OPTS=""
SKIP_ENV_CHECK=false
BLANK_DB=false
FORCE_REINIT=false
COMPOSE_PROJECT_NAME=""
CORE_ONLY=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    -t|--target)
      TARGET_OPTS="$2"
      shift 2
      ;;
    -s|--services)
      SERVICES_OPTS="$2"
      shift 2
      ;;
    --skip-env-check)
      SKIP_ENV_CHECK=true
      shift
      ;;
    --blank-db)
      BLANK_DB=true
      shift
      ;;
    --force)
      FORCE_REINIT=true
      shift
      ;;
    --project-name)
      COMPOSE_PROJECT_NAME="$2"
      shift 2
      ;;
    --core)
      CORE_ONLY=true
      shift
      ;;
    -h|--help)
      show_help
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      show_help
      exit 1
      ;;
  esac
done

echo "Deploying locally with Docker..."
echo "Repository root: ${REPO_ROOT}"

# Check if Docker is running
echo ""
echo "Checking Docker..."
if ! docker version >/dev/null 2>&1; then
  echo "Error: Docker is not running or not accessible." >&2
  echo "Please ensure Docker Desktop is running on macOS." >&2
  exit 1
fi
echo "Docker is running"

# Check for official Supabase setup (stored outside repo under ~/Documents)
SUPABASE_DATA_ROOT="${SUPABASE_DATA_ROOT:-${HOME}/Documents}"
mkdir -p "${SUPABASE_DATA_ROOT}"
SUPABASE_DOCKER_DIR="${SUPABASE_DATA_ROOT}/supabase-docker"
SETUP_SCRIPT="${SCRIPT_DIR}/setup-official-supabase.sh"

if [[ ! -d "${SUPABASE_DOCKER_DIR}" ]] || [[ ! -f "${SUPABASE_DOCKER_DIR}/docker-compose.yml" ]]; then
  echo ""
  echo "Official Supabase Docker setup not found."
  echo "Setting up official Supabase Docker files from GitHub..."
  if [[ -f "${SETUP_SCRIPT}" ]]; then
    SUPABASE_DATA_ROOT="${SUPABASE_DATA_ROOT}" bash "${SETUP_SCRIPT}"
  else
    echo "Error: Setup script not found: ${SETUP_SCRIPT}" >&2
  exit 1
  fi
fi

# Use official Supabase compose file as base
OFFICIAL_COMPOSE_FILE="${SUPABASE_DOCKER_DIR}/docker-compose.yml"
CUSTOM_COMPOSE_FILE="${REPO_ROOT}/docker-compose.versal.yml"
SUPABASE_ENV_FILE="${SUPABASE_DOCKER_DIR}/.env"

# Ensure Supabase .env file exists
if [[ ! -f "${SUPABASE_ENV_FILE}" ]]; then
  if [[ -f "${SUPABASE_DOCKER_DIR}/.env.example" ]]; then
    echo "Creating Supabase .env file from .env.example..."
    cp "${SUPABASE_DOCKER_DIR}/.env.example" "${SUPABASE_ENV_FILE}"
    echo "✓ Created ${SUPABASE_ENV_FILE}"
  else
    echo "Warning: ${SUPABASE_DOCKER_DIR}/.env.example not found. Creating minimal .env..." >&2
    touch "${SUPABASE_ENV_FILE}"
  fi
fi

# Create custom compose file for our services (api, web) if it doesn't exist
if [[ ! -f "${CUSTOM_COMPOSE_FILE}" ]]; then
  # Use absolute paths since we're running compose from a different directory
  cat > "${CUSTOM_COMPOSE_FILE}" <<EOF
services:
  api:
    container_name: versal-api
    build:
      context: ${REPO_ROOT}/backend
      dockerfile: Dockerfile
    env_file:
      - ${REPO_ROOT}/.env
    environment:
      - DEBUG=false
      # Official Supabase uses 'kong' as service name
      - SUPABASE_INTERNAL_URL=\${SUPABASE_INTERNAL_URL:-http://kong:8000}
      - SUPABASE_PUBLIC_URL=\${SUPABASE_PUBLIC_URL:-http://localhost:\${SUPABASE_PUBLIC_PORT:-8000}}
      # Use official Supabase env var names (ANON_KEY, SERVICE_ROLE_KEY)
      - SUPABASE_SERVICE_KEY=\${SERVICE_ROLE_KEY:-\${SUPABASE_SERVICE_KEY}}
      - SUPABASE_ANON_KEY=\${ANON_KEY:-\${SUPABASE_ANON_KEY}}
    ports:
      - "\${BACKEND_PORT:-8000}:8000"
    depends_on:
      - kong
    restart: unless-stopped
    networks:
      - default

  web:
    container_name: versal-app
    build:
      context: ${REPO_ROOT}/frontend
      dockerfile: Dockerfile
      args:
        VITE_API_BASE_URL: \${VITE_API_BASE_URL:-/api}
    ports:
      - "\${FRONTEND_PORT:-80}:80"
    depends_on:
      - api
    restart: unless-stopped
    networks:
      - default

networks:
  default:
    name: default
    external: true
EOF
  echo "Created custom compose file: ${CUSTOM_COMPOSE_FILE}"
fi

# Use both compose files together
# Note: Official Supabase compose expects to be run from supabase-docker directory
COMPOSE_FILE="${OFFICIAL_COMPOSE_FILE}"
COMPOSE_FILES="-f ${OFFICIAL_COMPOSE_FILE}"
if [[ -f "${CUSTOM_COMPOSE_FILE}" ]]; then
  COMPOSE_FILES="${COMPOSE_FILES} -f ${CUSTOM_COMPOSE_FILE}"
fi

# Set working directory for compose commands (official Supabase expects to run from supabase-docker)
COMPOSE_WORKDIR="${SUPABASE_DOCKER_DIR}"

# Wrapper function for compose commands that handles working directory and env file
# Official Supabase compose expects .env file in the same directory as docker-compose.yml
# We need to load the Supabase .env file and export variables, then run compose from repo root
run_compose() {
  # Load Supabase .env file
  set -a
  source "${SUPABASE_ENV_FILE}" 2>/dev/null || true
  set +a
  # Run compose from repo root with absolute paths to compose files
  # Use project name if specified (allows multiple instances)
  local compose_cmd="${COMPOSE_CMD}"
  if [[ -n "${COMPOSE_PROJECT_NAME}" ]]; then
    compose_cmd="${COMPOSE_CMD} -p ${COMPOSE_PROJECT_NAME}"
  fi
  (cd "${REPO_ROOT}" && ${compose_cmd} ${COMPOSE_FILES} "$@")
}

# Determine compose command (docker compose preferred, fallback to docker-compose)
COMPOSE_CMD=""
if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
  echo "Using 'docker compose' (new syntax)"
elif docker-compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker-compose"
  echo "Using 'docker-compose' (legacy syntax)"
else
  echo "Error: Neither 'docker compose' nor 'docker-compose' is available." >&2
  exit 1
fi

# Check .env file
ENV_FILE="${REPO_ROOT}/.env"
ENV_EXAMPLE_FILE="${REPO_ROOT}/.env.example"
# Also check for env.example (without the dot)
if [[ ! -f "${ENV_EXAMPLE_FILE}" ]]; then
  ENV_EXAMPLE_FILE="${REPO_ROOT}/env.example"
fi

# Create .env file if it doesn't exist
if [[ ! -f "${ENV_FILE}" ]]; then
  echo ""
  echo ".env file not found"
  
  if [[ -f "${ENV_EXAMPLE_FILE}" ]]; then
    if [[ "${SKIP_ENV_CHECK}" == "true" ]]; then
      echo "Skipping .env creation (--skip-env-check flag set)"
      echo "Note: Some services may fail without required environment variables." >&2
      # Still create a minimal .env from example
      cp "${ENV_EXAMPLE_FILE}" "${ENV_FILE}"
    else
      echo "Found .env.example file. Creating .env from it..."
        cp "${ENV_EXAMPLE_FILE}" "${ENV_FILE}"
        echo "Created .env file from .env.example"
    fi
  else
    echo "Warning: .env.example file not found. Creating minimal .env file." >&2
    touch "${ENV_FILE}"
  fi
fi

# Load .env file
set -a
source "${ENV_FILE}" 2>/dev/null || true
set +a

# Ensure GitHub token is provided (prompt user if missing)
if [[ -z "${GITHUB_TOKEN:-}" ]]; then
        echo ""
  echo "GITHUB_TOKEN is required for backend issue reporting."
  read -rsp "Enter your GitHub personal access token: " INPUT_GITHUB_TOKEN
        echo ""
  if [[ -z "${INPUT_GITHUB_TOKEN}" ]]; then
    echo "Error: GITHUB_TOKEN cannot be empty." >&2
    exit 1
  fi
  GITHUB_TOKEN="${INPUT_GITHUB_TOKEN}"
  update_env_key "GITHUB_TOKEN" "${GITHUB_TOKEN}" "${ENV_FILE}"
fi

# Generate or use existing JWT_SECRET (official Supabase uses JWT_SECRET)
# Support both official (JWT_SECRET) and custom (SUPABASE_JWT_SECRET) names
JWT_SECRET="${JWT_SECRET:-${SUPABASE_JWT_SECRET:-}}"
if [[ -z "${JWT_SECRET:-}" ]] || [[ "${JWT_SECRET}" == "your-jwt-secret-here" ]] || [[ "${JWT_SECRET}" == "super-secret-jwt-token-with-at-least-32-characters-long" ]]; then
  echo ""
  echo "Generating JWT_SECRET..."
  JWT_SECRET=$(openssl rand -base64 32 | tr -d '\n')
  update_env_key "JWT_SECRET" "${JWT_SECRET}" "${ENV_FILE}"
  # Also save as SUPABASE_JWT_SECRET for backward compatibility
  update_env_key "SUPABASE_JWT_SECRET" "${JWT_SECRET}" "${ENV_FILE}"
  echo "Generated and saved JWT_SECRET"
fi

# Generate ANON_KEY and SERVICE_ROLE_KEY from JWT_SECRET if not present
# Official Supabase uses ANON_KEY and SERVICE_ROLE_KEY
ANON_KEY="${ANON_KEY:-${SUPABASE_ANON_KEY:-}}"
if [[ -z "${ANON_KEY:-}" ]] || [[ "${ANON_KEY}" == "your-anon-key-here" ]]; then
  echo ""
  echo "Generating ANON_KEY from JWT_SECRET..."
  ANON_KEY=$(generate_jwt_token "anon" "${JWT_SECRET}")
  update_env_key "ANON_KEY" "${ANON_KEY}" "${ENV_FILE}"
  # Also save as SUPABASE_ANON_KEY for backward compatibility
  update_env_key "SUPABASE_ANON_KEY" "${ANON_KEY}" "${ENV_FILE}"
  echo "Generated and saved ANON_KEY"
fi

SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY:-${SUPABASE_SERVICE_KEY:-}}"
if [[ -z "${SERVICE_ROLE_KEY:-}" ]] || [[ "${SERVICE_ROLE_KEY}" == "your-service-key-here" ]]; then
  echo ""
  echo "Generating SERVICE_ROLE_KEY from JWT_SECRET..."
  SERVICE_ROLE_KEY=$(generate_jwt_token "service_role" "${JWT_SECRET}")
  update_env_key "SERVICE_ROLE_KEY" "${SERVICE_ROLE_KEY}" "${ENV_FILE}"
  # Also save as SUPABASE_SERVICE_KEY for backward compatibility
  update_env_key "SUPABASE_SERVICE_KEY" "${SERVICE_ROLE_KEY}" "${ENV_FILE}"
  echo "Generated and saved SERVICE_ROLE_KEY"
fi

# Set variables for backward compatibility
SUPABASE_JWT_SECRET="${JWT_SECRET}"
SUPABASE_ANON_KEY="${ANON_KEY}"
SUPABASE_SERVICE_KEY="${SERVICE_ROLE_KEY}"

# Sync generated keys to Supabase .env file
echo ""
echo "Syncing keys to Supabase .env file..."
update_env_key "JWT_SECRET" "${JWT_SECRET}" "${SUPABASE_ENV_FILE}"
update_env_key "ANON_KEY" "${ANON_KEY}" "${SUPABASE_ENV_FILE}"
update_env_key "SERVICE_ROLE_KEY" "${SERVICE_ROLE_KEY}" "${SUPABASE_ENV_FILE}"
# Also set common required variables if not already set
if ! grep -q "^POSTGRES_PASSWORD=" "${SUPABASE_ENV_FILE}" 2>/dev/null; then
  POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-${SUPABASE_DB_PASSWORD:-supabase}}"
  update_env_key "POSTGRES_PASSWORD" "${POSTGRES_PASSWORD}" "${SUPABASE_ENV_FILE}"
fi
# Also set DASHBOARD_PASSWORD if not set
if ! grep -q "^DASHBOARD_PASSWORD=" "${SUPABASE_ENV_FILE}" 2>/dev/null; then
  update_env_key "DASHBOARD_PASSWORD" "supabase" "${SUPABASE_ENV_FILE}"
fi
if ! grep -q "^POSTGRES_DB=" "${SUPABASE_ENV_FILE}" 2>/dev/null; then
  update_env_key "POSTGRES_DB" "postgres" "${SUPABASE_ENV_FILE}"
fi
if ! grep -q "^POSTGRES_HOST=" "${SUPABASE_ENV_FILE}" 2>/dev/null; then
  update_env_key "POSTGRES_HOST" "db" "${SUPABASE_ENV_FILE}"
fi
if ! grep -q "^POSTGRES_PORT=" "${SUPABASE_ENV_FILE}" 2>/dev/null; then
  update_env_key "POSTGRES_PORT" "5432" "${SUPABASE_ENV_FILE}"
fi
echo "✓ Keys synced to ${SUPABASE_ENV_FILE}"

# Reload .env to get updated values
set -a
source "${ENV_FILE}" 2>/dev/null || true
set +a

# Validate compose config
echo ""
echo "Validating docker-compose configuration..."
set +e
VALIDATION_OUTPUT=$(run_compose config 2>&1)
VALIDATION_EXIT=$?
set -e
if [[ $VALIDATION_EXIT -ne 0 ]]; then
  echo "Error: docker-compose configuration validation failed." >&2
  echo "Error details:" >&2
  echo "${VALIDATION_OUTPUT}" | grep -i "error" | head -10 || echo "${VALIDATION_OUTPUT}" | tail -20
  exit 1
fi
# Check for warnings about missing variables (these are usually OK, but let's verify)
if echo "${VALIDATION_OUTPUT}" | grep -qi "variable is not set"; then
  WARNING_COUNT=$(echo "${VALIDATION_OUTPUT}" | grep -ci "variable is not set")
  if [[ $WARNING_COUNT -gt 10 ]]; then
    echo "Warning: Many environment variables are not set (${WARNING_COUNT} warnings)" >&2
    echo "This may cause issues. Checking critical variables..." >&2
    # Check for critical missing variables
    MISSING_CRITICAL=false
    for var in JWT_SECRET ANON_KEY SERVICE_ROLE_KEY POSTGRES_PASSWORD; do
      if ! grep -q "^${var}=" "${SUPABASE_ENV_FILE}" 2>/dev/null; then
        echo "  Missing critical variable: ${var}" >&2
        MISSING_CRITICAL=true
      fi
    done
    if [[ "${MISSING_CRITICAL}" == "true" ]]; then
      echo "Error: Critical environment variables are missing!" >&2
      exit 1
    fi
  fi
fi
echo "Configuration is valid"

########################################
# Force reinitialize (if requested)
########################################
if [[ "${FORCE_REINIT}" == "true" ]]; then
  echo ""
  echo "=========================================="
  echo "Force Reinitialize: Clearing Everything"
  echo "=========================================="
  echo "WARNING: This will:"
  echo "  - Stop all containers"
  echo "  - Remove all containers"
  echo "  - Remove all volumes (database data will be deleted)"
  echo "  - Reinitialize from scratch"
  echo ""
  
  if [[ "${SKIP_ENV_CHECK}" == "false" ]]; then
    read -p "Are you sure you want to continue? (yes/no): " CONFIRM
    if [[ "${CONFIRM}" != "yes" ]]; then
      echo "Aborted."
      exit 0
    fi
  fi
  
  echo ""
  echo "Stopping and removing containers..."
  set +e  # Don't exit on error during cleanup
  
  # Stop and remove Supabase containers (use direct docker compose to avoid hanging)
  if [[ -d "${SUPABASE_DOCKER_DIR}" ]]; then
    local compose_cmd="docker compose"
    if [[ -n "${COMPOSE_PROJECT_NAME}" ]]; then
      compose_cmd="docker compose -p ${COMPOSE_PROJECT_NAME}"
    fi
    (cd "${SUPABASE_DOCKER_DIR}" && ${compose_cmd} down -v --remove-orphans 2>&1 | head -20) || true
  fi
  
  # Also stop and remove custom services
  if [[ -f "${REPO_ROOT}/docker-compose.versal.yml" ]]; then
    docker compose -f "${REPO_ROOT}/docker-compose.versal.yml" down -v --remove-orphans 2>&1 | head -20 || true
  fi
  
  # Force stop and remove any running containers
  echo "Force stopping containers..."
  docker ps --filter "name=supabase-" --format "{{.Names}}" 2>/dev/null | while read -r container; do
    [[ -n "${container}" ]] && docker stop "${container}" 2>/dev/null || true
  done
  docker ps --filter "name=versal-" --format "{{.Names}}" 2>/dev/null | while read -r container; do
    [[ -n "${container}" ]] && docker stop "${container}" 2>/dev/null || true
  done
  
  # Remove any orphaned containers
  echo "Removing containers..."
  docker ps -a --filter "name=supabase-" --format "{{.Names}}" 2>/dev/null | while read -r container; do
    [[ -n "${container}" ]] && docker rm -f "${container}" 2>/dev/null || true
  done
  docker ps -a --filter "name=versal-" --format "{{.Names}}" 2>/dev/null | while read -r container; do
    [[ -n "${container}" ]] && docker rm -f "${container}" 2>/dev/null || true
  done
  
  # Remove volumes (be careful - this deletes data)
  echo "Removing volumes..."
  docker volume ls --filter "name=supabase" --format "{{.Name}}" 2>/dev/null | while read -r volume; do
    [[ -n "${volume}" ]] && docker volume rm "${volume}" 2>/dev/null || true
  done
  docker volume ls --filter "name=versal" --format "{{.Name}}" 2>/dev/null | while read -r volume; do
    [[ -n "${volume}" ]] && docker volume rm "${volume}" 2>/dev/null || true
  done
  
  set -e  # Re-enable exit on error
  echo "✓ Cleanup completed"
  echo ""
  echo "Database will be reinitialized from init.sql on next deployment"
  echo ""
fi

########################################
# Service selection
########################################
# Allow selection via CLI parameters or env vars
TARGET_OPTS="${TARGET_OPTS:-${TARGET:-}}"
SERVICES_OPTS="${SERVICES_OPTS:-${SERVICES:-}}"

# Map target to services if SERVICES not provided
# Official Supabase service names (may vary, but common ones)
# Core services: db, kong, auth, rest, studio, meta
# Required dependencies: analytics (required by studio, kong, auth, rest, meta), vector (required by db)
# Optional services: realtime, storage, imgproxy, functions, supavisor
if [[ "${CORE_ONLY}" == "true" ]]; then
  SUPABASE_GROUP="db auth rest kong studio meta analytics vector"
  echo ""
  echo "Core mode: Deploying core services (db, kong, auth, rest, studio, meta)"
  echo "Including dependencies: analytics, vector"
  echo "Skipping: realtime, storage, imgproxy, functions, supavisor"
else
  SUPABASE_GROUP="db auth rest realtime meta storage kong studio functions vector analytics supavisor imgproxy"
fi

COMPOSE_SERVICES="${SERVICES_OPTS}"
if [[ -z "${COMPOSE_SERVICES}" && -n "${TARGET_OPTS}" ]]; then
  case "${TARGET_OPTS}" in
    api|backend)
      COMPOSE_SERVICES="api"
      ;;
    web|frontend)
      COMPOSE_SERVICES="web"
      ;;
    supabase)
      COMPOSE_SERVICES="${SUPABASE_GROUP}"
      ;;
    all|*)
      COMPOSE_SERVICES="" # empty means all services
      ;;
  esac
fi

# Determine if Supabase needs to be deployed
NEEDS_SUPABASE=false
DEPLOY_OTHER_SERVICES=false

if [[ -n "${COMPOSE_SERVICES}" ]]; then
  # Check if any Supabase services are in the list
  for svc in ${COMPOSE_SERVICES}; do
    if echo "${SUPABASE_GROUP}" | grep -qw "${svc}"; then
      NEEDS_SUPABASE=true
      break
    fi
  done
  # Also check if target was explicitly "supabase"
  if [[ "${TARGET_OPTS}" == "supabase" ]]; then
    NEEDS_SUPABASE=true
  fi
  # Check if any non-supabase services are requested
  for svc in ${COMPOSE_SERVICES}; do
    if ! echo "${SUPABASE_GROUP}" | grep -qw "${svc}"; then
      DEPLOY_OTHER_SERVICES=true
      break
    fi
  done
else
  # Deploying all services
  NEEDS_SUPABASE=true
  DEPLOY_OTHER_SERVICES=true
fi

# Step 1: Deploy Supabase first if needed
if [[ "${NEEDS_SUPABASE}" == "true" ]]; then
  echo ""
  echo "=========================================="
  echo "Step 1: Deploying Supabase services..."
  echo "=========================================="
  
  # Pull images
  echo ""
  echo "Pulling Supabase images..."
  echo "This may take several minutes on first run..."
  set +e  # Temporarily disable exit on error for pull (it may have warnings)
  run_compose pull ${SUPABASE_GROUP} 2>&1
  PULL_EXIT=$?
  set -e  # Re-enable exit on error
  if [[ $PULL_EXIT -ne 0 ]]; then
    echo ""
    echo "Warning: Image pull had some issues (exit code: $PULL_EXIT)" >&2
    echo "Continuing with deployment - images will be pulled if needed..." >&2
else
  echo ""
    echo "✓ Image pull completed"
fi

  # Deploy Supabase services
echo ""
  echo "Building and starting Supabase containers..."
  set +e  # Temporarily disable exit on error
  run_compose up -d --build ${SUPABASE_GROUP} 2>&1
  UP_EXIT=$?
  set -e  # Re-enable exit on error
  if [[ $UP_EXIT -ne 0 ]]; then
    echo ""
    echo "Error: Failed to start Supabase services (exit code: $UP_EXIT)" >&2
    echo "Checking container status..." >&2
    run_compose ps 2>&1 | head -20 || true
    exit 1
  fi
  echo "✓ Containers started"
  
  echo ""
  echo "Waiting for Supabase services to be ready..."
  echo "This may take 30-60 seconds..."
  
  # Wait for database to be ready
  max_retries=60
  retry_count=0
  db_ready=false
  
  # Find the database container name (official Supabase uses 'db' or project-prefixed names)
  db_container=""
  if docker ps --format '{{.Names}}' | grep -q "^supabase-db$"; then
    db_container="supabase-db"
  elif docker ps --format '{{.Names}}' | grep -qE "^.*-db-.*$|^db$"; then
    db_container=$(docker ps --format '{{.Names}}' | grep -E "db" | head -1)
  else
    # Try to find any postgres container
    db_container=$(docker ps --format '{{.Names}}' | grep -i postgres | head -1)
  fi
  
  if [[ -z "${db_container}" ]]; then
    echo "Warning: Could not find database container. Waiting for services to start..." >&2
    sleep 5
    db_container=$(docker ps --format '{{.Names}}' | grep -E "db|postgres" | head -1)
  fi
  
  while [[ $retry_count -lt $max_retries ]] && [[ "$db_ready" == "false" ]]; do
    if [[ -n "${db_container}" ]] && docker exec "${db_container}" pg_isready -U postgres >/dev/null 2>&1; then
      db_ready=true
      break
    fi
    retry_count=$((retry_count + 1))
    echo "  Waiting for database... ($retry_count/$max_retries)"
    sleep 2
  done
  
  if [[ "$db_ready" == "false" ]]; then
    echo "Warning: Database may not be fully ready, but continuing..." >&2
  else
    echo "Database is ready"
  fi
  
  # Wait a bit more for other Supabase services
  echo "Waiting for Supabase services to initialize..."
  sleep 10
  
echo ""
  echo "Supabase services deployed successfully!"
  
  # Check if database is already initialized
  echo ""
  echo "Checking if database is initialized..."
  DB_INITIALIZED=false
  
  # Find database container
  db_container=""
  if docker ps --format '{{.Names}}' | grep -q "^supabase-db$"; then
    db_container="supabase-db"
  elif docker ps --format '{{.Names}}' | grep -qE "^.*-db-.*$|^db$"; then
    db_container=$(docker ps --format '{{.Names}}' | grep -E "db" | head -1)
  else
    db_container=$(docker ps --format '{{.Names}}' | grep -i postgres | head -1)
  fi
  
  # Check if database is initialized by checking if master data exists
  # We check if system_settings table has data, not just if it exists
  DB_INITIALIZED=false
  if [[ -n "${db_container}" ]]; then
    # Check if system_settings table exists AND has data
    TABLE_EXISTS=$(docker exec "${db_container}" psql -U postgres -d postgres -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'system_settings');" 2>/dev/null | tr -d ' ')
    if [[ "${TABLE_EXISTS}" == "t" ]]; then
      # Check if it has data
      ROW_COUNT=$(docker exec "${db_container}" psql -U postgres -d postgres -t -c "SELECT COUNT(*) FROM system_settings;" 2>/dev/null | tr -d ' ')
      if [[ -n "${ROW_COUNT}" ]] && [[ "${ROW_COUNT}" -gt 0 ]]; then
        DB_INITIALIZED=true
        echo "✓ Database is already initialized (system_settings has ${ROW_COUNT} rows)"
      else
        echo "Database schema exists but master data is missing - will run initialization"
      fi
    else
      echo "Database is not initialized - will run initialization"
    fi
  else
    echo "Database container not found - will attempt initialization"
  fi
  
  # Initialize database if not already initialized
  if [[ "${DB_INITIALIZED}" == "false" ]]; then
    echo ""
    echo "=========================================="
    echo "Step 1.5: Initializing Database"
    echo "=========================================="
    
    if [[ "${BLANK_DB}" == "true" ]]; then
      echo ""
      echo "Blank database mode: Skipping schema and data initialization"
      echo "Database will be left empty (auth prerequisites will still be created for GoTrue)"
    else
      INIT_SQL_FILE="${REPO_ROOT}/supabase/init.sql"
      EXTRACT_SCRIPT="${SCRIPT_DIR}/extract-supabase-data.sh"
      
      # Check if init.sql exists, if not, extract from Supabase
      if [[ ! -f "${INIT_SQL_FILE}" ]]; then
        echo ""
        echo "init.sql not found. Extracting schema and master data from Supabase..."
        echo "This will only happen once."
        
        if [[ -f "${EXTRACT_SCRIPT}" ]]; then
          if bash "${EXTRACT_SCRIPT}"; then
            echo "✓ Schema and master data extracted successfully"
          else
            echo "Warning: Extraction script had issues. You may need to run it manually:" >&2
            echo "  ./scripts/extract-supabase-data.sh" >&2
          fi
        else
          echo "Warning: Extraction script not found: ${EXTRACT_SCRIPT}" >&2
          echo "Please run: ./scripts/extract-supabase-data.sh manually" >&2
        fi
      else
        echo "✓ Found existing init.sql file"
      fi
      
      # Run init.sql if it exists
      if [[ -f "${INIT_SQL_FILE}" ]]; then
        echo ""
        echo "Running database initialization from init.sql..."
        echo "This may take a few minutes..."
        
        # If --force flag is used, truncate all tables first
        if [[ "${FORCE_REINIT}" == "true" ]] && [[ -n "${db_container}" ]]; then
          echo ""
          echo "Force mode: Truncating all tables in public schema..."
          echo "This will delete all data but keep the schema structure."
          
          # Truncate all tables in public schema (CASCADE handles foreign key constraints)
          TRUNCATE_OUTPUT=$(docker exec "${db_container}" psql -U postgres -d postgres 2>&1 <<'SQL'
-- Disable triggers temporarily to avoid issues
SET session_replication_role = replica;

-- Get all table names in public schema and truncate them
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public'
    ORDER BY tablename
  LOOP
    BEGIN
      EXECUTE 'TRUNCATE TABLE public.' || quote_ident(r.tablename) || ' CASCADE';
      RAISE NOTICE 'Truncated: %', r.tablename;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Could not truncate %: %', r.tablename, SQLERRM;
    END;
  END LOOP;
END $$;

-- Re-enable triggers
SET session_replication_role = DEFAULT;
SQL
)
          
          if echo "${TRUNCATE_OUTPUT}" | grep -qi "truncated"; then
            TRUNCATED_COUNT=$(echo "${TRUNCATE_OUTPUT}" | grep -c "Truncated:" || echo "0")
            echo "✓ Truncated ${TRUNCATED_COUNT} table(s)"
          else
            echo "Warning: Some tables may not have been truncated (this is OK if tables don't exist yet)" >&2
          fi
        fi
        
        # If tables exist but are empty, extract only master data section
        if [[ "${TABLE_EXISTS}" == "t" ]] && [[ "${ROW_COUNT:-0}" -eq 0 ]]; then
          echo "Tables exist but are empty. Extracting master data section only..."
          MASTER_DATA_SECTION=$(awk '/-- Master Data/,0 {print}' "${INIT_SQL_FILE}" 2>/dev/null)
          if [[ -n "${MASTER_DATA_SECTION}" ]]; then
            # Insert master data with error handling
            # Disable triggers to handle circular foreign key constraints (categories table warning)
            # This is necessary because categories table has circular foreign-key constraints
            # We'll insert in a transaction but continue even if some INSERTs fail
            echo "Inserting master data (this may take a moment)..."
            echo "Note: Some INSERTs may fail due to foreign key constraints or duplicates (this is expected)"
            
            # Insert master data - process each INSERT statement individually to avoid transaction abort
            # This handles cases where one INSERT fails (e.g., foreign key constraint) without aborting others
            # Save master data to temp file for processing
            TEMP_MASTER_FILE=$(mktemp)
            echo "${MASTER_DATA_SECTION}" > "${TEMP_MASTER_FILE}"
            
            # Use Python to split and insert each statement individually
            # Better extraction: find INSERT boundaries by looking for next INSERT or comment, not just semicolons
            INSERT_OUTPUT=$(python3 <<PYTHON
import subprocess
import sys
import re

# Read master data from file
with open('${TEMP_MASTER_FILE}', 'r') as f:
    lines = f.readlines()

# Find all INSERT statements by finding their boundaries
inserts = []
i = 0
while i < len(lines):
    line = lines[i]
    # Check if this is the start of an INSERT statement
    if re.match(r'^\s*INSERT\s+INTO\s+"public"', line, re.IGNORECASE):
        start_idx = i
        # Find where this INSERT ends (next INSERT or comment, or end of file)
        end_idx = start_idx + 1
        while end_idx < len(lines):
            next_line = lines[end_idx]
            # Stop if we hit another INSERT (not the same table)
            if re.match(r'^\s*INSERT\s+INTO\s+"public"', next_line, re.IGNORECASE):
                break
            # Stop if we hit a comment (but allow comments within the INSERT)
            if next_line.strip().startswith('--') and 'Master Data' not in next_line:
                break
            end_idx += 1
        
        # Extract the INSERT statement
        insert_lines = lines[start_idx:end_idx]
        insert_stmt = ''.join(insert_lines).strip()
        
        # Ensure it ends with semicolon
        if not insert_stmt.endswith(';'):
            # Remove trailing comma if present and add semicolon
            insert_stmt = insert_stmt.rstrip().rstrip(',').rstrip()
            if insert_stmt.endswith(')'):
                insert_stmt += ';'
            else:
                insert_stmt += ');'
        
        inserts.append(insert_stmt)
        i = end_idx
    else:
        i += 1

# Insert each statement individually
success_count = 0
error_count = 0
all_output = []

for insert_stmt in inserts:
    if not insert_stmt.strip() or insert_stmt.strip().startswith('--'):
        continue
    
    # Create SQL with transaction and error handling
    sql = """BEGIN;
SET session_replication_role = replica;
""" + insert_stmt + """
SET session_replication_role = DEFAULT;
COMMIT;
"""
    
    # Execute via docker
    try:
        result = subprocess.run(
            ['docker', 'exec', '-i', '${db_container}', 'psql', '-U', 'postgres', '-d', 'postgres'],
            input=sql,
            capture_output=True,
            text=True,
            timeout=30
        )
        
        output = result.stdout + result.stderr
        all_output.append(output)
        
        # Check for successful insert (INSERT 0 N means N rows inserted)
        if 'INSERT 0' in output:
            # Count rows inserted
            import re
            insert_match = re.search(r'INSERT 0 (\d+)', output)
            if insert_match:
                rows_inserted = int(insert_match.group(1))
                if rows_inserted > 0:
                    success_count += 1
                # If 0 rows inserted but no error, might be duplicate (still success)
                elif 'ERROR' not in output or 'duplicate' in output.lower():
                    success_count += 1
                else:
                    error_count += 1
            else:
                success_count += 1
        elif 'duplicate key' in output.lower() or 'already exists' in output.lower():
            # Duplicate key is OK - data already exists
            success_count += 1
        elif 'ERROR' in output:
            error_count += 1
    except Exception as e:
        all_output.append(f"Error executing INSERT: {str(e)}")
        error_count += 1

print(f"Processed {len(inserts)} INSERT statements: {success_count} succeeded, {error_count} failed")
print('\n'.join(all_output))
PYTHON
            2>&1)
            
            # Clean up temp file
            rm -f "${TEMP_MASTER_FILE}"
            
            # Check for actual errors (psql returns 0 even with errors, so check output)
            if echo "${INSERT_OUTPUT}" | grep -qi "ERROR:"; then
              ERROR_COUNT=$(echo "${INSERT_OUTPUT}" | grep -ci "ERROR:")
              SUCCESS_COUNT=$(echo "${INSERT_OUTPUT}" | grep -c "INSERT 0" || echo "0")
              echo "Master data insertion completed with ${SUCCESS_COUNT} successful insert(s)" >&2
              if [[ ${ERROR_COUNT} -gt 0 ]]; then
                echo "Warning: ${ERROR_COUNT} error(s) occurred (duplicates or foreign key constraints)" >&2
                echo "Some tables may have dependencies that couldn't be satisfied." >&2
              fi
              # Show summary of what was inserted
              # Verify all master tables (same list as in extract-supabase-data.sh)
              echo ""
              echo "Verifying inserted data..."
              MASTER_TABLES_TO_VERIFY=(system_settings roles taxes categories units locations suppliers customers products product_serials profiles user_roles user_settings)
              VERIFY_SQL=""
              for table in "${MASTER_TABLES_TO_VERIFY[@]}"; do
                VERIFY_SQL="${VERIFY_SQL}SELECT '${table}: ' || COUNT(*) FROM ${table}; "
              done
              docker exec "${db_container}" psql -U postgres -d postgres -t -c "${VERIFY_SQL}" 2>/dev/null | grep -v "^$" | sed 's/^/  /' || echo "  (Some tables may not exist yet)"
            else
              echo "✓ Master data inserted successfully"
            fi
          else
            # Fallback to full init.sql
            docker exec -i "${db_container}" psql -U postgres -d postgres < "${INIT_SQL_FILE}" 2>&1 || true
          fi
        else
          # Full initialization (schema + data)
          # Filter out auth schema section - Supabase Auth manages it via migrations
          echo "Filtering out auth schema (managed by Supabase Auth migrations)..."
          FILTERED_INIT_SQL=$(mktemp)
          
          # Extract everything except the auth schema section
          # Keep: Database Schema (public), Auth Users Data, Master Data
          # Skip: Auth Schema section (lines between "-- Auth Schema" and "-- Auth Users Data")
          awk '
            BEGIN { skip_auth_schema = 0 }
            /^-- ==========================================$/ {
              getline
              if ($0 ~ /Auth Schema/) {
                skip_auth_schema = 1
                # Skip this section header
                next
              } else if ($0 ~ /Auth Users Data|Master Data|Database Schema/) {
                skip_auth_schema = 0
                print "-- =========================================="
                print $0
                print "-- =========================================="
                print ""
                next
              }
            }
            skip_auth_schema == 0 { print }
          ' "${INIT_SQL_FILE}" > "${FILTERED_INIT_SQL}"
          
          # Disable triggers before initialization and re-enable after
          # This prevents triggers from firing during schema creation and data insertion
          # which can cause issues with foreign key constraints and circular dependencies
          echo "Disabling triggers during initialization..."
          
          # Split init.sql into schema and data sections
          # We need to apply schema first, then migrations, then data
          SCHEMA_SECTION=$(awk '/-- Database Schema/,/-- Auth Users Data|-- Master Data/ {if ($0 ~ /-- Auth Users Data|-- Master Data/) exit; print}' "${FILTERED_INIT_SQL}" 2>/dev/null || cat "${FILTERED_INIT_SQL}")
          DATA_SECTION=$(awk '/-- Auth Users Data|-- Master Data/,0 {print}' "${FILTERED_INIT_SQL}" 2>/dev/null || echo "")
          
          # Step 1: Apply schema (with triggers disabled)
          echo "Applying database schema..."
          SCHEMA_SQL_FILE=$(mktemp)
          {
            echo "-- Disable triggers before schema creation"
            echo "SET session_replication_role = replica;"
            echo "SET CONSTRAINTS ALL DEFERRED;"
            echo ""
            echo "${SCHEMA_SECTION}"
            echo ""
            echo "-- Re-enable triggers after schema creation"
            echo "SET CONSTRAINTS ALL IMMEDIATE;"
            echo "SET session_replication_role = DEFAULT;"
          } > "${SCHEMA_SQL_FILE}"
          
          SCHEMA_OUTPUT=$(docker exec -i "${db_container}" psql -U postgres -d postgres < "${SCHEMA_SQL_FILE}" 2>&1 || true)
          rm -f "${SCHEMA_SQL_FILE}"
          
          if echo "${SCHEMA_OUTPUT}" | grep -qiE "ERROR.*(syntax|foreign key)" && ! echo "${SCHEMA_OUTPUT}" | grep -qi "permission denied for schema auth"; then
            echo "Warning: Schema creation had some errors:" >&2
            echo "${SCHEMA_OUTPUT}" | grep -iE "ERROR.*(syntax|foreign key)" | head -3 >&2
          else
            echo "✓ Schema created successfully"
          fi
          
          # Step 2: Apply migrations from supabase/migrations directory
          # This should run after schema is created but before data insertion
          MIGRATIONS_DIR="${REPO_ROOT}/supabase/migrations"
          if [[ -d "${MIGRATIONS_DIR}" ]] && [[ -n "${db_container}" ]]; then
            echo ""
            echo "Applying migrations from supabase/migrations..."
            
            # Get all migration files, sorted by filename (timestamp)
            MIGRATION_FILES=$(find "${MIGRATIONS_DIR}" -name "*.sql" -type f | sort)
            
            if [[ -n "${MIGRATION_FILES}" ]]; then
              MIGRATION_COUNT=$(echo "${MIGRATION_FILES}" | wc -l | tr -d ' ')
              echo "Found ${MIGRATION_COUNT} migration file(s)"
              
              # Apply each migration file
              APPLIED_COUNT=0
              FAILED_COUNT=0
              for migration_file in ${MIGRATION_FILES}; do
                migration_name=$(basename "${migration_file}")
                echo "  Applying: ${migration_name}..."
                
                # Apply migration with error handling
                MIGRATION_OUTPUT=$(docker exec -i "${db_container}" psql -U postgres -d postgres < "${migration_file}" 2>&1 || true)
                
                if echo "${MIGRATION_OUTPUT}" | grep -qiE "ERROR.*(syntax|permission|does not exist)" && ! echo "${MIGRATION_OUTPUT}" | grep -qi "already exists\|duplicate"; then
                  echo "    ⚠ Warning: Migration had issues (may already be applied)" >&2
                  FAILED_COUNT=$((FAILED_COUNT + 1))
                  # Show first error line
                  echo "${MIGRATION_OUTPUT}" | grep -i "ERROR" | head -1 | sed 's/^/      /' >&2 || true
                else
                  APPLIED_COUNT=$((APPLIED_COUNT + 1))
                  echo "    ✓ Applied successfully"
                fi
              done
              
              echo "✓ Migrations applied: ${APPLIED_COUNT} succeeded, ${FAILED_COUNT} had warnings (may already be applied)"
            else
              echo "No migration files found in ${MIGRATIONS_DIR}"
            fi
          fi
          
          # Step 3: Apply data (with triggers disabled)
          if [[ -n "${DATA_SECTION}" ]]; then
            echo ""
            echo "Inserting master data..."
            DATA_SQL_FILE=$(mktemp)
            {
              echo "-- Disable triggers before data insertion"
              echo "SET session_replication_role = replica;"
              echo "SET CONSTRAINTS ALL DEFERRED;"
              echo ""
              echo "${DATA_SECTION}"
              echo ""
              echo "-- Re-enable triggers after data insertion"
              echo "SET CONSTRAINTS ALL IMMEDIATE;"
              echo "SET session_replication_role = DEFAULT;"
            } > "${DATA_SQL_FILE}"
            
            DATA_OUTPUT=$(docker exec -i "${db_container}" psql -U postgres -d postgres < "${DATA_SQL_FILE}" 2>&1 || true)
            rm -f "${DATA_SQL_FILE}"
            
            if echo "${DATA_OUTPUT}" | grep -qiE "ERROR.*(syntax|foreign key|duplicate key|violates)" && ! echo "${DATA_OUTPUT}" | grep -qi "permission denied for schema auth"; then
              echo "Warning: Data insertion had some errors:" >&2
              echo "${DATA_OUTPUT}" | grep -iE "ERROR.*(syntax|foreign key|duplicate key|violates)" | head -5 >&2
            else
              echo "✓ Data inserted successfully"
            fi
          fi
          
          # Ensure enable_signup is set to true in system_settings
          if [[ -n "${db_container}" ]]; then
            echo ""
            echo "Setting enable_signup = true in system_settings..."
            SIGNUP_UPDATE_OUTPUT=$(docker exec "${db_container}" psql -U postgres -d postgres 2>&1 <<'SQL'
-- Update enable_signup to true if system_settings table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'system_settings') THEN
    UPDATE system_settings SET value = 'true' WHERE key = 'enable_signup';
    
    -- If no row was updated, insert it
    IF NOT FOUND THEN
      INSERT INTO system_settings (key, value, description) 
      VALUES ('enable_signup', 'true', 'Enable user signup')
      ON CONFLICT (key) DO UPDATE SET value = 'true';
    END IF;
    
    RAISE NOTICE 'enable_signup set to true';
  END IF;
END $$;
SQL
)
            
            if echo "${SIGNUP_UPDATE_OUTPUT}" | grep -qi "enable_signup set to true"; then
              echo "✓ enable_signup set to true"
            else
              echo "Warning: Could not set enable_signup (table may not exist yet)" >&2
            fi
          fi
          
          rm -f "${FILTERED_INIT_SQL}"
        fi
      else
        echo "Warning: init.sql file not found. Database will be empty." >&2
        echo "To initialize:" >&2
        echo "  1. Run: ./scripts/extract-supabase-data.sh" >&2
        echo "  2. Then run this deployment script again" >&2
      fi
    fi

    # Insert auth.users data if it exists in init.sql (after auth migrations have run)
    if [[ -n "${db_container}" ]] && docker ps --format '{{.Names}}' | grep -q "^${db_container}$"; then
      echo ""
      echo "Checking for auth.users data to import..."
      
      # Extract auth users section (from "-- Auth Users Data" to "-- Master Data" or end)
      AUTH_USERS_START=$(grep -n "^-- Auth Users Data" "${INIT_SQL_FILE}" 2>/dev/null | cut -d: -f1 || echo "")
      
      if [[ -n "${AUTH_USERS_START}" ]]; then
        # Find the end of auth users section (next major section or end of file)
        AUTH_USERS_END=$(awk -v start="${AUTH_USERS_START}" 'NR > start && /^-- Master Data|^-- =/ {print NR; exit}' "${INIT_SQL_FILE}" 2>/dev/null || echo "")
        
        if [[ -z "${AUTH_USERS_END}" ]]; then
          # If no end marker, use end of file
          AUTH_USERS_END=$(wc -l < "${INIT_SQL_FILE}" | tr -d ' ')
        fi
        
        # Extract the section (skip comment lines)
        AUTH_USERS_SECTION=$(sed -n "${AUTH_USERS_START},${AUTH_USERS_END}p" "${INIT_SQL_FILE}" 2>/dev/null | grep -v "^--" | grep -v "^$" || true)
        
        # Check if there's actual data (not just "No auth.users data to import")
        if [[ -n "${AUTH_USERS_SECTION}" ]] && ! echo "${AUTH_USERS_SECTION}" | grep -qi "No auth.users data"; then
          if echo "${AUTH_USERS_SECTION}" | grep -qiE "(INSERT|COPY).*auth.*users"; then
          echo "Found auth.users data in init.sql. Inserting after auth migrations..."
          
          # Wait for auth migrations to complete (check if auth.users table exists)
          MAX_WAIT=30
          WAIT_COUNT=0
          while [[ ${WAIT_COUNT} -lt ${MAX_WAIT} ]]; do
            if docker exec "${db_container}" psql -U postgres -d postgres -t -c "SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users' LIMIT 1;" 2>/dev/null | grep -q "1"; then
              break
            fi
            sleep 1
            WAIT_COUNT=$((WAIT_COUNT + 1))
          done
          
          if docker exec "${db_container}" psql -U postgres -d postgres -t -c "SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users' LIMIT 1;" 2>/dev/null | grep -q "1"; then
            echo "Inserting auth.users data..."
            
            # Insert auth users data with error handling
            INSERT_RESULT=$(docker exec -i "${db_container}" psql -U postgres -d postgres 2>&1 <<SQL
BEGIN;
SET session_replication_role = replica;
${AUTH_USERS_SECTION}
SET session_replication_role = DEFAULT;
COMMIT;
SQL
)
            
            if echo "${INSERT_RESULT}" | grep -qE "(INSERT|COPY)"; then
              USER_COUNT=$(docker exec "${db_container}" psql -U postgres -d postgres -t -c "SELECT COUNT(*) FROM auth.users;" 2>/dev/null | tr -d ' ' || echo "0")
              echo "✓ Auth users imported (${USER_COUNT} users)"
            elif echo "${INSERT_RESULT}" | grep -qi "duplicate\|already exists"; then
              USER_COUNT=$(docker exec "${db_container}" psql -U postgres -d postgres -t -c "SELECT COUNT(*) FROM auth.users;" 2>/dev/null | tr -d ' ' || echo "0")
              echo "✓ Auth users already exist (${USER_COUNT} users)"
            else
              echo "Warning: Auth users insertion had issues" >&2
              echo "${INSERT_RESULT}" | grep -i "error" | head -3 >&2 || true
            fi
          else
            echo "Warning: auth.users table not found after waiting (migrations may have failed)" >&2
          fi
          else
            echo "No auth.users data found in init.sql (skipping - section exists but is empty)"
          fi
        else
          echo "Auth users section exists but contains no data (skipping)"
        fi
      else
        echo "No auth.users section found in init.sql (skipping)"
      fi
    fi

    # Insert default users (admin, staff, manager) if they don't exist
    if [[ -n "${db_container}" ]] && docker ps --format '{{.Names}}' | grep -q "^${db_container}$"; then
      echo ""
      echo "Creating default users (admin, staff, manager)..."
      
      # Wait for auth migrations to complete
      MAX_WAIT=30
      WAIT_COUNT=0
      while [[ ${WAIT_COUNT} -lt ${MAX_WAIT} ]]; do
        if docker exec "${db_container}" psql -U postgres -d postgres -t -c "SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users' LIMIT 1;" 2>/dev/null | grep -q "1"; then
          break
        fi
        sleep 1
        WAIT_COUNT=$((WAIT_COUNT + 1))
      done
      
      if docker exec "${db_container}" psql -U postgres -d postgres -t -c "SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users' LIMIT 1;" 2>/dev/null | grep -q "1"; then
        # Check if users already exist in auth.users (not just profiles)
        ADMIN_EXISTS=$(docker exec "${db_container}" psql -U postgres -d postgres -t -c "SELECT COUNT(*) FROM auth.users WHERE email = 'admin@versal.com';" 2>/dev/null | tr -d ' ' || echo "0")
        STAFF_EXISTS=$(docker exec "${db_container}" psql -U postgres -d postgres -t -c "SELECT COUNT(*) FROM auth.users WHERE email = 'staff@versal.com';" 2>/dev/null | tr -d ' ' || echo "0")
        MANAGER_EXISTS=$(docker exec "${db_container}" psql -U postgres -d postgres -t -c "SELECT COUNT(*) FROM auth.users WHERE email = 'manager@versal.com';" 2>/dev/null | tr -d ' ' || echo "0")
        
        # Debug: Show what we found
        if [[ "${ADMIN_EXISTS}" != "1" ]] || [[ "${STAFF_EXISTS}" != "1" ]] || [[ "${MANAGER_EXISTS}" != "1" ]]; then
          echo "Creating missing users (admin: ${ADMIN_EXISTS}, staff: ${STAFF_EXISTS}, manager: ${MANAGER_EXISTS})..."
        fi
        
        if [[ "${ADMIN_EXISTS}" == "1" ]] && [[ "${STAFF_EXISTS}" == "1" ]] && [[ "${MANAGER_EXISTS}" == "1" ]]; then
          echo "✓ Default users already exist in auth.users"
        else
          # Insert default users using PostgreSQL crypt function (requires pgcrypto)
          # Default password for all users: "password123"
          DEFAULT_USERS_RESULT=$(docker exec -i "${db_container}" psql -U postgres -d postgres 2>&1 <<'SQL'
-- Enable pgcrypto if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Default password: password123
-- Using bcrypt with cost factor 10 (Supabase standard)
DO $$
DECLARE
  admin_id UUID;
  staff_id UUID;
  manager_id UUID;
  admin_role_id UUID := '977228e3-a283-43a5-b7c8-37cce50fc160';
  manager_role_id UUID := '34956656-03e8-4ea0-a408-f6d343f2225a';
  staff_role_id UUID := 'a3ef37b6-25cc-456b-a4a1-7e550b20a267';
  password_hash TEXT;
  now_ts TIMESTAMPTZ := NOW();
BEGIN
  -- Generate bcrypt hash for password "password123"
  -- Note: crypt() with 'bf' uses bcrypt, cost factor 10
  password_hash := crypt('password123', gen_salt('bf', 10));
  
  -- Insert admin user (check if exists first, then insert or update)
  -- Get existing user ID if email exists
  SELECT id INTO admin_id FROM auth.users WHERE email = 'admin@versal.com' LIMIT 1;
  
  -- If user doesn't exist, insert new user
  IF admin_id IS NULL THEN
    admin_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
      is_super_admin, role, aud
    ) VALUES (
      admin_id,
      '00000000-0000-0000-0000-000000000000'::uuid,
      'admin@versal.com',
      password_hash,
      now_ts,
      now_ts,
      now_ts,
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      '{"username": "admin", "full_name": "Administrator", "role": "admin"}'::jsonb,
      false,
      'authenticated',
      'authenticated'
    );
  ELSE
    -- Update existing user's password
    UPDATE auth.users SET
      encrypted_password = password_hash,
      updated_at = now_ts
    WHERE id = admin_id;
  END IF;
  
  -- admin_id is now set above (either from existing user or newly generated)
  
  -- Delete existing profile with same username but different id (if any)
  DELETE FROM public.profiles WHERE username = 'admin' AND id != admin_id;
  
  -- Insert or update profile
  INSERT INTO public.profiles (
    id, username, full_name, is_active, role_id, created_at, updated_at
  ) VALUES (
    admin_id,
    'admin',
    'Administrator',
    true,
    admin_role_id,
    now_ts,
    now_ts
  ) ON CONFLICT (id) DO UPDATE SET 
    role_id = EXCLUDED.role_id,
    username = EXCLUDED.username,
    full_name = EXCLUDED.full_name;
  
  -- Insert staff user (check if exists first)
  SELECT id INTO staff_id FROM auth.users WHERE email = 'staff@versal.com' LIMIT 1;
  
  IF staff_id IS NULL THEN
    staff_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
      is_super_admin, role, aud
    ) VALUES (
      staff_id,
      '00000000-0000-0000-0000-000000000000'::uuid,
      'staff@versal.com',
      password_hash,
      now_ts,
      now_ts,
      now_ts,
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      '{"username": "staff", "full_name": "Staff User", "role": "staff"}'::jsonb,
      false,
      'authenticated',
      'authenticated'
    );
  ELSE
    UPDATE auth.users SET
      encrypted_password = password_hash,
      updated_at = now_ts
    WHERE id = staff_id;
  END IF;
  
  -- staff_id is now set above (either from existing user or newly generated)
  
  -- Delete existing profile with same username but different id (if any)
  DELETE FROM public.profiles WHERE username = 'staff' AND id != staff_id;
  
  -- Insert or update profile
  INSERT INTO public.profiles (
    id, username, full_name, is_active, role_id, created_at, updated_at
  ) VALUES (
    staff_id,
    'staff',
    'Staff User',
    true,
    staff_role_id,
    now_ts,
    now_ts
  ) ON CONFLICT (id) DO UPDATE SET 
    role_id = EXCLUDED.role_id,
    username = EXCLUDED.username,
    full_name = EXCLUDED.full_name;
  
  -- Insert manager user (check if exists first)
  SELECT id INTO manager_id FROM auth.users WHERE email = 'manager@versal.com' LIMIT 1;
  
  IF manager_id IS NULL THEN
    manager_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
      is_super_admin, role, aud
    ) VALUES (
      manager_id,
      '00000000-0000-0000-0000-000000000000'::uuid,
      'manager@versal.com',
      password_hash,
      now_ts,
      now_ts,
      now_ts,
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      '{"username": "manager", "full_name": "Manager", "role": "manager"}'::jsonb,
      false,
      'authenticated',
      'authenticated'
    );
  ELSE
    UPDATE auth.users SET
      encrypted_password = password_hash,
      updated_at = now_ts
    WHERE id = manager_id;
  END IF;
  
  -- manager_id is now set above (either from existing user or newly generated)
  
  -- Delete existing profile with same username but different id (if any)
  DELETE FROM public.profiles WHERE username = 'manager' AND id != manager_id;
  
  -- Insert or update profile
  INSERT INTO public.profiles (
    id, username, full_name, is_active, role_id, created_at, updated_at
  ) VALUES (
    manager_id,
    'manager',
    'Manager',
    true,
    manager_role_id,
    now_ts,
    now_ts
  ) ON CONFLICT (id) DO UPDATE SET 
    role_id = EXCLUDED.role_id,
    username = EXCLUDED.username,
    full_name = EXCLUDED.full_name;
  
  RAISE NOTICE 'Default users created successfully';
END $$;

-- Verify users were created
SELECT 
  'admin' as username, 
  COUNT(*) as auth_count 
FROM auth.users 
WHERE email = 'admin@versal.com'
UNION ALL
SELECT 'staff', COUNT(*) FROM auth.users WHERE email = 'staff@versal.com'
UNION ALL
SELECT 'manager', COUNT(*) FROM auth.users WHERE email = 'manager@versal.com';
SQL
)
        
          if echo "${DEFAULT_USERS_RESULT}" | grep -q "NOTICE.*Default users created" || echo "${DEFAULT_USERS_RESULT}" | grep -q "INSERT 0"; then
            echo "✓ Default users created successfully"
            echo "  Default password for all users: password123"
            echo "  Users:"
            echo "    - admin@versal.com (Administrator)"
            echo "    - staff@versal.com (Staff User)"
            echo "    - manager@versal.com (Manager)"
          elif echo "${DEFAULT_USERS_RESULT}" | grep -qi "duplicate\|already exists"; then
            echo "✓ Default users already exist"
          else
            # Check if users were actually created despite errors
            FINAL_ADMIN_COUNT=$(docker exec "${db_container}" psql -U postgres -d postgres -t -c "SELECT COUNT(*) FROM auth.users WHERE email = 'admin@versal.com';" 2>/dev/null | tr -d ' ' || echo "0")
            FINAL_STAFF_COUNT=$(docker exec "${db_container}" psql -U postgres -d postgres -t -c "SELECT COUNT(*) FROM auth.users WHERE email = 'staff@versal.com';" 2>/dev/null | tr -d ' ' || echo "0")
            FINAL_MANAGER_COUNT=$(docker exec "${db_container}" psql -U postgres -d postgres -t -c "SELECT COUNT(*) FROM auth.users WHERE email = 'manager@versal.com';" 2>/dev/null | tr -d ' ' || echo "0")
            
            if [[ "${FINAL_ADMIN_COUNT}" == "1" ]] && [[ "${FINAL_STAFF_COUNT}" == "1" ]] && [[ "${FINAL_MANAGER_COUNT}" == "1" ]]; then
              echo "✓ Default users exist (some warnings during creation are expected)"
            else
              echo "Warning: Issues creating default users" >&2
              echo "${DEFAULT_USERS_RESULT}" | grep -i "error" | head -5 >&2 || true
            fi
          fi
        fi
      else
        echo "Warning: auth.users table not found (migrations may not have completed)" >&2
      fi
    fi

  fi
  
  echo ""
  echo "Supabase keys in .env file:"
  echo "  JWT_SECRET: ${JWT_SECRET:0:20}..."
  echo "  ANON_KEY: ${ANON_KEY:0:30}..."
  echo "  SERVICE_ROLE_KEY: ${SERVICE_ROLE_KEY:0:30}..."
  echo "  (Also saved as SUPABASE_* for backward compatibility)"
  echo ""
  echo "You can now use these keys in your application."
  echo "Supabase Studio: http://localhost:8000"
  echo "Supabase API: http://localhost:8000"
  
  # Ensure auth enum exists (this will be created automatically by migrations, but we try to help)
  echo ""
  if docker ps --format '{{.Names}}' | grep -qiE "(db|postgres)"; then
    ensure_auth_factor_type
  fi
  
  # Restart auth service to pick up any changes
  echo "Restarting auth service..."
  # Find auth service name (official uses 'auth', container name might be prefixed)
  auth_service="auth"
  # Try to find the actual container/service name
  for name in "supabase-auth-1" "supabase_auth_1" "supabase-auth" "auth"; do
    if docker ps --format '{{.Names}}' | grep -q "^${name}$"; then
      auth_service="${name}"
      break
    fi
  done
  # Use service name from compose (not container name)
  if echo "${SUPABASE_GROUP}" | grep -q "auth"; then
    auth_service="auth"
  fi
  set +e  # Temporarily disable exit on error
  run_compose up -d "${auth_service}" >/dev/null 2>&1 || echo "Note: Auth service will start automatically" >&2
  set -e  # Re-enable exit on error
fi

# Step 2: Deploy other services if requested
if [[ "${DEPLOY_OTHER_SERVICES}" == "true" ]]; then
  echo ""
  echo "=========================================="
  echo "Step 2: Deploying other services..."
  echo "=========================================="
  
  # Determine which services to deploy
  OTHER_SERVICES=""
  if [[ -n "${COMPOSE_SERVICES}" ]]; then
    # Filter out Supabase services
    for svc in ${COMPOSE_SERVICES}; do
      if [[ ! "${SUPABASE_GROUP}" =~ ${svc} ]]; then
        OTHER_SERVICES="${OTHER_SERVICES} ${svc}"
      fi
    done
    OTHER_SERVICES=$(echo "${OTHER_SERVICES}" | xargs) # trim whitespace
  fi
  
  if [[ -n "${OTHER_SERVICES}" ]]; then
    echo ""
    echo "Deploying services: ${OTHER_SERVICES}"
    
    # Pull images
    echo ""
    echo "Pulling images..."
    run_compose pull ${OTHER_SERVICES} || true
    
    # Deploy services
echo ""
echo "Building and starting containers..."
    if ! run_compose up -d --build ${OTHER_SERVICES}; then
    echo "Error: Failed to start services" >&2
    exit 1
  fi
    echo "✓ Containers started"
    echo ""
    echo "Other services deployed successfully!"
  elif [[ -z "${COMPOSE_SERVICES}" ]]; then
    # Deploying all services (already deployed Supabase, now deploy rest)
    echo ""
    echo "Deploying remaining services..."
    
    # Determine which services to deploy (only api and web from custom compose)
    REMAINING_SERVICES="api web"
    
    # Pull images for remaining services
    echo ""
    echo "Pulling images..."
    set +e  # Temporarily disable exit on error
    run_compose pull ${REMAINING_SERVICES} 2>&1
    PULL_EXIT=$?
    set -e  # Re-enable exit on error
    if [[ $PULL_EXIT -ne 0 ]]; then
      echo "Note: Some images may need to be built (this is normal for build services)" >&2
    fi
    echo "✓ Image pull completed"
    
    # Deploy remaining services (only api and web)
echo ""
    echo "Building and starting containers..."
    set +e  # Temporarily disable exit on error
    run_compose up -d --build ${REMAINING_SERVICES} 2>&1
    UP_EXIT=$?
    set -e  # Re-enable exit on error
    if [[ $UP_EXIT -ne 0 ]]; then
      echo "Error: Failed to start services (exit code: $UP_EXIT)" >&2
    exit 1
    fi
    echo "✓ Containers started"
    echo ""
    echo "Other services deployed successfully!"
  fi
fi

# Show container status
echo ""
echo "=========================================="
echo "Container status:"
echo "=========================================="
# Run ps command - limit output to prevent hanging on large outputs
set +e  # Temporarily disable exit on error
{ run_compose ps 2>&1 || true; } | head -20
set -e  # Re-enable exit on error
echo ""  # Add blank line after status

echo ""
echo "Deployment complete!"
echo ""
echo "Useful commands:"
echo "  View logs: run_compose logs -f [service]"
echo "  Stop services: run_compose down"
echo "  View status: run_compose ps"
echo ""
echo "Application access:"
echo "  Frontend (versal-app):  http://localhost:${FRONTEND_PORT:-80}"
echo "  Backend  (versal-api): http://localhost:${BACKEND_PORT:-8000}"
echo ""
echo "Supabase access (via Kong API Gateway on port 8000):"
echo "  Studio: http://localhost:8000"
echo "  REST API: http://localhost:8000/rest/v1/"
echo "  Auth API: http://localhost:8000/auth/v1/"
echo "  Storage API: http://localhost:8000/storage/v1/"
echo "  Realtime API: http://localhost:8000/realtime/v1/"
