#!/bin/bash
set -e  # Exit immediately if a command exits with a non-zero status

# Use PLAYWRIGHT_BASE_URL if provided; default to http://localhost:5000
BASE_URL=${PLAYWRIGHT_BASE_URL:-http://localhost:5000}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
E2E_FRONTEND_DIR="${E2E_FRONTEND_DIR:-/tmp/imgcompress-e2e-frontend}"
echo "Using base URL: ${BASE_URL}"

# Playwright writes results inside the throwaway $E2E_FRONTEND_DIR copy of
# the frontend. Sync them back to the host-mounted frontend/e2e-test-results
# so callers (CI artifact uploads, local inspection) can actually see them.
# Runs on both success and failure via the EXIT trap.
sync_test_results() {
  local results_src="$E2E_FRONTEND_DIR/e2e-test-results"
  local results_dst="$APP_ROOT/frontend/e2e-test-results"
  if [ -d "$results_src" ]; then
    rm -rf "$results_dst"
    mkdir -p "$results_dst"
    cp -R "$results_src/." "$results_dst/" || true
    echo "Synced test results to $results_dst"
  else
    echo "No Playwright results at $results_src; skipping sync"
  fi
}
trap sync_test_results EXIT

# Run E2E Tests in Dev Container
echo "Running E2E Tests..."

export CI="${CI:-true}"

export SHELL="${SHELL:-/bin/sh}"
export PNPM_HOME="${PNPM_HOME:-$HOME/.local/share/pnpm}"
export PATH="$PNPM_HOME/bin:$PNPM_HOME:$PATH"
echo "SHELL is: $SHELL"
echo "PATH is: $PATH"

rm -rf "$E2E_FRONTEND_DIR"
mkdir -p "$E2E_FRONTEND_DIR"
tar \
  --exclude="./node_modules" \
  --exclude="./.next" \
  --exclude="./out" \
  -C "$APP_ROOT/frontend" \
  -cf - . | tar -C "$E2E_FRONTEND_DIR" -xf -

cd "$E2E_FRONTEND_DIR"

PNPM_PACKAGE="$(node -p "require('./package.json').packageManager")"
echo "Using package manager: ${PNPM_PACKAGE}"

run_pnpm() {
  if command -v npm >/dev/null 2>&1; then
    npm exec --yes --package="$PNPM_PACKAGE" -- pnpm "$@"
    return
  fi

  # Fallback: direct installer (handles cases where npm is missing but curl is present)
  if ! command -v pnpm >/dev/null 2>&1 && command -v curl >/dev/null 2>&1; then
    curl -fsSL https://get.pnpm.io/install.sh | SHELL="$SHELL" sh -
    export PATH="$PNPM_HOME/bin:$PNPM_HOME:$PATH"
    hash -r
  fi

  if command -v pnpm >/dev/null 2>&1; then
    pnpm "$@"
    return
  fi

  echo "Neither npm nor pnpm is available; aborting E2E tests." >&2
  exit 1
}

run_pnpm install --frozen-lockfile
run_pnpm exec playwright install --with-deps chromium
run_pnpm test:e2e -- "$@"

echo "E2E Tests completed successfully!"
