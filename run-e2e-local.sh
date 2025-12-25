#!/bin/bash
set -e  # Exit immediately if a command exits with a non-zero status

# Use PLAYWRIGHT_BASE_URL if provided; default to http://localhost:5000
BASE_URL=${PLAYWRIGHT_BASE_URL:-http://localhost:3000}
echo "Using base URL: ${BASE_URL}"

# Run E2E Tests in Dev Container
echo "Running E2E Tests..."

# Force non-interactive behavior for pnpm in CI/containers
export CI="${CI:-true}"

export SHELL="${SHELL:-/bin/sh}"
export PNPM_HOME="${PNPM_HOME:-$HOME/.local/share/pnpm}"
export PATH="$PNPM_HOME:$PATH"
echo "SHELL is: $SHELL"
echo "PATH is: $PATH"

# Ensure pnpm is available (some devcontainer images may lack it or PATH may be missing)
if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm not found; installing it..."
  if command -v corepack >/dev/null 2>&1; then
    corepack enable
    corepack prepare pnpm@latest --activate
  fi

  if ! command -v pnpm >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
    npm install -g pnpm
  fi

  # Fallback: direct installer (handles cases where npm is missing but curl is present)
  if ! command -v pnpm >/dev/null 2>&1 && command -v curl >/dev/null 2>&1; then
    curl -fsSL https://get.pnpm.io/install.sh | SHELL="$SHELL" sh -
    export PATH="$PNPM_HOME:$PATH"
  fi

  if ! command -v pnpm >/dev/null 2>&1; then
    echo "pnpm is still unavailable; aborting E2E tests." >&2
    exit 1
  fi
fi

cd frontend 
pnpm install
pnpm exec playwright install --with-deps
pnpm test:e2e

echo "E2E Tests completed successfully!"
