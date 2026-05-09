#!/usr/bin/env bash
set -euo pipefail

DOCS_URL="https://imgcompress.karimzouine.com/docs/developers#root-cause"
COMMIT_MESSAGE="chore: regenerate pnpm lockfile after dependabot merge"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

if [[ ! -f "$FRONTEND_DIR/package.json" ]]; then
  echo "Could not find frontend/package.json from $SCRIPT_DIR" >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "node is required to read frontend/package.json" >&2
  exit 1
fi

if ! command -v corepack >/dev/null 2>&1; then
  echo "corepack is required to activate the frontend pnpm version" >&2
  exit 1
fi

echo "Regenerating frontend pnpm lockfile after a Dependabot merge."
echo "Root cause and manual recovery docs: $DOCS_URL"

cd "$FRONTEND_DIR"

PNPM_SPEC="$(node -p "require('./package.json').packageManager || 'pnpm@latest'")"
if [[ "$PNPM_SPEC" != pnpm@* ]]; then
  echo "frontend/package.json packageManager must be a pnpm spec, got: $PNPM_SPEC" >&2
  exit 1
fi

echo "Using $PNPM_SPEC"
corepack enable
corepack prepare "$PNPM_SPEC" --activate
echo "Activated pnpm $(corepack pnpm --version)"

echo "Removing generated frontend dependency artifacts..."
rm -rf node_modules
rm -f pnpm-lock.yaml

echo "Regenerating frontend/pnpm-lock.yaml..."
PNPM_INSTALL_ARGS_ARRAY=()
if [[ -n "${PNPM_INSTALL_ARGS:-}" ]]; then
  read -r -a PNPM_INSTALL_ARGS_ARRAY <<< "$PNPM_INSTALL_ARGS"
  echo "Using additional pnpm install args: $PNPM_INSTALL_ARGS"
fi
corepack pnpm install "${PNPM_INSTALL_ARGS_ARRAY[@]}"

git -C "$SCRIPT_DIR" add frontend/pnpm-lock.yaml

if git -C "$SCRIPT_DIR" diff --cached --quiet -- frontend/pnpm-lock.yaml; then
  echo "No lockfile changes to commit."
else
  git -C "$SCRIPT_DIR" commit \
    -m "$COMMIT_MESSAGE" \
    -m "Root cause and recovery docs: $DOCS_URL"
fi
