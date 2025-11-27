#!/usr/bin/env bash
set -euo pipefail

# Script to set up official Supabase Docker files from GitHub
# This follows the official guide: https://supabase.com/docs/guides/self-hosting/docker

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SUPABASE_DOCKER_DIR="${REPO_ROOT}/supabase-docker"
SUPABASE_REPO_DIR="${REPO_ROOT}/.supabase-repo"
SUPABASE_REPO_URL="https://github.com/supabase/supabase.git"

cd "${REPO_ROOT}"

echo "=========================================="
echo "Setting up Official Supabase Docker Files"
echo "=========================================="
echo ""

# Step 1: Clone or update Supabase repo
if [[ -d "${SUPABASE_REPO_DIR}" ]]; then
  echo "Updating Supabase repository..."
  (cd "${SUPABASE_REPO_DIR}" && git pull --depth 1 || true)
else
  echo "Cloning Supabase repository (shallow clone)..."
  git clone --depth 1 "${SUPABASE_REPO_URL}" "${SUPABASE_REPO_DIR}"
fi

# Step 2: Create supabase-docker directory
if [[ ! -d "${SUPABASE_DOCKER_DIR}" ]]; then
  echo "Creating supabase-docker directory..."
  mkdir -p "${SUPABASE_DOCKER_DIR}"
fi

# Step 3: Copy official docker files
echo "Copying official Supabase Docker files..."
if [[ -d "${SUPABASE_REPO_DIR}/docker" ]]; then
  cp -rf "${SUPABASE_REPO_DIR}/docker"/* "${SUPABASE_DOCKER_DIR}/"
  echo "✓ Official Supabase Docker files copied"
else
  echo "Error: Could not find docker directory in Supabase repo" >&2
  exit 1
fi

# Step 4: Ensure .env.example exists (it should have been copied, but verify)
if [[ ! -f "${SUPABASE_DOCKER_DIR}/.env.example" ]]; then
  if [[ -f "${SUPABASE_REPO_DIR}/docker/.env.example" ]]; then
    echo "Copying .env.example..."
    cp "${SUPABASE_REPO_DIR}/docker/.env.example" "${SUPABASE_DOCKER_DIR}/.env.example"
    echo "✓ Copied .env.example"
  else
    echo "Warning: .env.example not found in Supabase repo" >&2
  fi
fi

# Step 5: Copy .env.example to .env if .env doesn't exist
if [[ ! -f "${SUPABASE_DOCKER_DIR}/.env" ]] && [[ -f "${SUPABASE_DOCKER_DIR}/.env.example" ]]; then
  echo "Creating .env from .env.example..."
  cp "${SUPABASE_DOCKER_DIR}/.env.example" "${SUPABASE_DOCKER_DIR}/.env"
  echo "✓ Created .env file (deployment script will update it with generated keys)"
fi

echo ""
echo "✓ Official Supabase Docker setup complete!"
echo ""
echo "Files are in: ${SUPABASE_DOCKER_DIR}"
echo ""
echo "Next steps:"
echo "  1. Review and update: ${SUPABASE_DOCKER_DIR}/.env"
echo "  2. The deployment script will merge your custom services (api, web) with the official setup"

