#!/usr/bin/env bash
set -euo pipefail

# Resolve repo root regardless of where this script is run from
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Configurable via env vars
REMOTE_HOST="${REMOTE_HOST:-subhan@aifin.tolor.com}"
REMOTE_PORT="${REMOTE_PORT:-1022}"
REMOTE_DIR="${REMOTE_DIR:-/home/subhan/versal}"
SOURCE_DIR="${SOURCE_DIR:-${REPO_ROOT}}"   # default to repo root

# SSH options with connection multiplexing to reduce repeated password prompts
CONTROL_PATH="${CONTROL_PATH:-$HOME/.ssh/cm-%r@%h:%p}"
SSH_BASE_OPTS=( -p "${REMOTE_PORT}" -o ControlMaster=auto -o ControlPersist=5m -o ControlPath="${CONTROL_PATH}" )

echo "Deploying from ${SOURCE_DIR} to ${REMOTE_HOST}:${REMOTE_PORT} -> ${REMOTE_DIR}"

# Establish the SSH control connection (will prompt once if using password auth)
ssh "${SSH_BASE_OPTS[@]}" -fN "${REMOTE_HOST}" || true

# Ensure remote directory exists
ssh "${SSH_BASE_OPTS[@]}" "${REMOTE_HOST}" "mkdir -p '${REMOTE_DIR}'"

# Build rsync exclude list (preserve remote .env by default)
RSYNC_EXCLUDES=(
  --exclude ".git"
  --exclude "backend/venv"
  --exclude "frontend/node_modules"
  --exclude "frontend/dist"
)

if [[ "${SYNC_LOCAL_ENV:-0}" == "1" && -f "${SOURCE_DIR}/.env" ]]; then
  echo "Including local .env in sync (SYNC_LOCAL_ENV=1)"
else
  RSYNC_EXCLUDES+=( --exclude ".env" )
fi

# Sync repo (delete removed files, but keep .env when excluded)
rsync -az --delete \
  "${RSYNC_EXCLUDES[@]}" \
  -e "ssh ${SSH_BASE_OPTS[*]}" \
  "${SOURCE_DIR}/" "${REMOTE_HOST}:${REMOTE_DIR}/"

# Report .env status on remote
if ssh "${SSH_BASE_OPTS[@]}" "${REMOTE_HOST}" "test -f '${REMOTE_DIR}/.env'"; then
  echo "Using remote .env at ${REMOTE_DIR}/.env"
else
  echo "Warning: ${REMOTE_DIR}/.env not found. Compose will use defaults if any."
fi

# Determine compose command on remote (docker compose preferred, fallback to docker-compose)
if ssh "${SSH_BASE_OPTS[@]}" "${REMOTE_HOST}" "docker compose version >/dev/null 2>&1"; then
  REMOTE_COMPOSE="docker compose"
elif ssh "${SSH_BASE_OPTS[@]}" "${REMOTE_HOST}" "docker-compose version >/dev/null 2>&1"; then
  REMOTE_COMPOSE="docker-compose"
else
  echo "Error: Neither 'docker compose' nor 'docker-compose' is available on the remote host." >&2
  exit 1
fi

# Optionally run compose with sudo on remote
if [[ "${REMOTE_SUDO:-0}" == "1" ]]; then
  REMOTE_COMPOSE="sudo ${REMOTE_COMPOSE}"
fi

########################################
# Service selection
########################################
# Allow selection via CLI flags or env vars
# - TARGET or --target: api | web | supabase | all
# - SERVICES or --services: space-separated list of service names

show_help() {
  cat <<USAGE
Usage: $(basename "$0") [--target api|web|supabase|all] [--services "svc1 svc2 ..."]

Examples:
  $(basename "$0") --target api
  TARGET=supabase $(basename "$0")
  SERVICES="api web" $(basename "$0")
USAGE
}

TARGET_OPTS="${TARGET:-${DEPLOY_TARGET:-}}"
SERVICES_OPTS="${SERVICES:-${DEPLOY_SERVICES:-}}"

# Parse simple flags
while [[ $# -gt 0 ]]; do
  case "$1" in
    -t|--target)
      TARGET_OPTS="$2"; shift 2;;
    -s|--services)
      SERVICES_OPTS="$2"; shift 2;;
    -h|--help)
      show_help; exit 0;;
    *)
      echo "Unknown option: $1" >&2; show_help; exit 1;;
  esac
done

# Map target to services if SERVICES not provided
SUPABASE_GROUP="supabase-db supabase-auth supabase-rest supabase-realtime supabase-meta supabase-storage supabase-kong supabase-studio"

COMPOSE_SERVICES="${SERVICES_OPTS}"
if [[ -z "${COMPOSE_SERVICES}" && -n "${TARGET_OPTS}" ]]; then
  case "${TARGET_OPTS}" in
    api|backend)
      COMPOSE_SERVICES="api";;
    web|frontend)
      COMPOSE_SERVICES="web";;
    supabase)
      COMPOSE_SERVICES="${SUPABASE_GROUP}";;
    all|*)
      COMPOSE_SERVICES="";; # empty means all services
  esac
fi

if [[ -n "${COMPOSE_SERVICES}" ]]; then
  echo "Deploying services: ${COMPOSE_SERVICES}"
else
  echo "Deploying ALL services in compose file"
fi

# Validate compose config exists and is readable
ssh "${SSH_BASE_OPTS[@]}" "${REMOTE_HOST}" "cd '${REMOTE_DIR}' && ${REMOTE_COMPOSE} config >/dev/null"

# Pull and deploy selected services (or all if none specified)
if [[ -n "${COMPOSE_SERVICES}" ]]; then
  ssh "${SSH_BASE_OPTS[@]}" "${REMOTE_HOST}" "cd '${REMOTE_DIR}' && ${REMOTE_COMPOSE} pull ${COMPOSE_SERVICES} || true"
  ssh "${SSH_BASE_OPTS[@]}" "${REMOTE_HOST}" "cd '${REMOTE_DIR}' && ${REMOTE_COMPOSE} up -d --build ${COMPOSE_SERVICES}"
else
  ssh "${SSH_BASE_OPTS[@]}" "${REMOTE_HOST}" "cd '${REMOTE_DIR}' && ${REMOTE_COMPOSE} pull || true"
  ssh "${SSH_BASE_OPTS[@]}" "${REMOTE_HOST}" "cd '${REMOTE_DIR}' && ${REMOTE_COMPOSE} up -d --build --remove-orphans"
fi

echo "Deployment complete."
