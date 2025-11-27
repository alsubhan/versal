#!/usr/bin/env bash
# Script to install Supabase CLI on macOS

set -euo pipefail

echo "=========================================="
echo "Installing Supabase CLI"
echo "=========================================="
echo ""

# Check if already installed
if command -v supabase &> /dev/null; then
  echo "✓ Supabase CLI is already installed"
  supabase --version
  exit 0
fi

echo "Choose installation method:"
echo ""
echo "Option 1: Homebrew (Recommended for macOS)"
echo "  Run: brew install supabase/tap/supabase"
echo ""
echo "Option 2: Direct Binary Download"
echo "  This script will download and install the binary"
echo ""

read -p "Use Option 2 (Direct Download)? [y/N]: " choice

if [[ "${choice}" != "y" && "${choice}" != "Y" ]]; then
  echo ""
  echo "To install via Homebrew:"
  echo "  1. Install Homebrew: /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
  echo "  2. Run: brew install supabase/tap/supabase"
  echo ""
  echo "Or run this script again and choose Option 2 for direct download."
  exit 0
fi

echo ""
echo "Downloading Supabase CLI binary..."

# Detect architecture
ARCH=$(uname -m)
if [[ "${ARCH}" == "arm64" ]]; then
  ARCH="arm64"
elif [[ "${ARCH}" == "x86_64" ]]; then
  ARCH="amd64"
else
  echo "Error: Unsupported architecture: ${ARCH}" >&2
  exit 1
fi

# Get latest version from GitHub API
LATEST_VERSION=$(curl -s https://api.github.com/repos/supabase/cli/releases/latest | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/' | sed 's/v//')

if [[ -z "${LATEST_VERSION}" ]]; then
  echo "Warning: Could not fetch latest version, using v1.200.0" >&2
  LATEST_VERSION="1.200.0"
fi

echo "Latest version: ${LATEST_VERSION}"

# Create local bin directory
LOCAL_BIN="${HOME}/.local/bin"
mkdir -p "${LOCAL_BIN}"

# Download binary (correct URL format)
BINARY_URL="https://github.com/supabase/cli/releases/download/v${LATEST_VERSION}/supabase_darwin_${ARCH}.tar.gz"
TEMP_DIR=$(mktemp -d)
TAR_FILE="${TEMP_DIR}/supabase.tar.gz"

echo "Downloading from: ${BINARY_URL}"

if curl -L -o "${TAR_FILE}" "${BINARY_URL}" 2>/dev/null; then
  echo "✓ Download complete"
else
  echo "Error: Failed to download Supabase CLI" >&2
  rm -rf "${TEMP_DIR}"
  exit 1
fi

# Extract
echo "Extracting..."
cd "${TEMP_DIR}"
if tar -xzf "${TAR_FILE}" 2>/dev/null; then
  echo "✓ Extracted successfully"
else
  echo "Error: Failed to extract archive" >&2
  echo "Trying alternative extraction method..." >&2
  gzip -dc "${TAR_FILE}" | tar -x 2>/dev/null || {
    echo "Error: All extraction methods failed" >&2
    rm -rf "${TEMP_DIR}"
    exit 1
  }
fi

# Find the binary (it might be in a subdirectory)
BINARY_PATH=$(find "${TEMP_DIR}" -name "supabase" -type f | head -1)

if [[ -n "${BINARY_PATH}" && -f "${BINARY_PATH}" ]]; then
  cp "${BINARY_PATH}" "${LOCAL_BIN}/supabase"
  chmod +x "${LOCAL_BIN}/supabase"
  echo "✓ Installed to ${LOCAL_BIN}/supabase"
else
  echo "Error: Binary not found in archive" >&2
  echo "Archive contents:" >&2
  tar -tzf "${TAR_FILE}" 2>/dev/null | head -10 >&2
  rm -rf "${TEMP_DIR}"
  exit 1
fi

# Cleanup
rm -rf "${TEMP_DIR}"

# Add to PATH if not already there
if [[ ":$PATH:" != *":${LOCAL_BIN}:"* ]]; then
  echo ""
  echo "Adding ${LOCAL_BIN} to PATH..."
  echo ""
  echo "Add this to your ~/.zshrc or ~/.bash_profile:"
  echo "  export PATH=\"\${HOME}/.local/bin:\${PATH}\""
  echo ""
  echo "Or run this command:"
  echo "  export PATH=\"\${HOME}/.local/bin:\${PATH}\""
  echo ""
  
  # Add to current session
  export PATH="${HOME}/.local/bin:${PATH}"
fi

# Verify installation
if command -v supabase &> /dev/null; then
  echo ""
  echo "=========================================="
  echo "Installation Complete!"
  echo "=========================================="
  echo ""
  supabase --version
  echo ""
  echo "Next steps:"
  echo "  1. Run: supabase login"
  echo "  2. Then run: ./scripts/extract-supabase-data.sh"
else
  echo ""
  echo "Installation complete, but supabase command not found in PATH."
  echo "Please add ${LOCAL_BIN} to your PATH and try again."
fi

