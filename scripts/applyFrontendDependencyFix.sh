#!/usr/bin/env bash
set -euo pipefail

DOCS_URL="https://imgcompress.karimzouine.com/docs/developers#root-cause"
COMMIT_MESSAGE="chore: regenerate pnpm lockfile after dependabot merge"

# Set COMMIT_LOCKFILE=0 to regenerate the lockfile without committing it. CI uses
# this so it can pick the file up without needing a git identity on the runner.
COMMIT_LOCKFILE="${COMMIT_LOCKFILE:-1}"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

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
# corepack also accepts URL and git specs, which would let a package.json point
# this at arbitrary code. Only a published version or dist-tag is allowed.
PNPM_SPEC_PATTERN='^pnpm@(latest|[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?(\+[0-9A-Za-z.]+)?)$'
if [[ ! "$PNPM_SPEC" =~ $PNPM_SPEC_PATTERN ]]; then
  echo "frontend/package.json packageManager must be pnpm@<version>, got: $PNPM_SPEC" >&2
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
corepack pnpm install ${PNPM_INSTALL_ARGS_ARRAY[@]+"${PNPM_INSTALL_ARGS_ARRAY[@]}"}

if [[ "$COMMIT_LOCKFILE" == "0" ]]; then
  echo "COMMIT_LOCKFILE=0, leaving frontend/pnpm-lock.yaml uncommitted."
  exit 0
fi

git -C "$PROJECT_ROOT" add frontend/pnpm-lock.yaml

if git -C "$PROJECT_ROOT" diff --cached --quiet -- frontend/pnpm-lock.yaml; then
  echo "No lockfile changes to commit."
else
  git -C "$PROJECT_ROOT" commit \
    -m "$COMMIT_MESSAGE" \
    -m "Root cause and recovery docs: $DOCS_URL"
fi
