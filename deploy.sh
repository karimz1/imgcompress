#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CDK_DIR="$ROOT_DIR/infra/cdk"
VENV_DIR="$CDK_DIR/.venv"
SITE_DIR="${DOCS_OUTPUT_DIR:-$ROOT_DIR/site}"
DIST_DIR="$CDK_DIR/dist"
ZIP_PATH="$DIST_DIR/docs.zip"

if ! command -v uv >/dev/null 2>&1; then
  echo "uv is not installed. Install it with:"
  echo "  curl -Ls https://astral.sh/uv/install.sh | sh"
  exit 1
fi

if [ ! -d "$VENV_DIR" ]; then
  uv venv "$VENV_DIR"
fi

uv pip install --python "$VENV_DIR/bin/python" -r "$CDK_DIR/requirements.txt"
uv pip install --python "$VENV_DIR/bin/python" -r "$ROOT_DIR/docs/requirements.txt"

ZENSICAL_EXTRA="${ZENSICAL_BUILD_ARGS:-}"
if [ -n "$ZENSICAL_EXTRA" ]; then
  # shellcheck disable=SC2086
  uv run --python "$VENV_DIR/bin/python" zensical build $ZENSICAL_EXTRA
else
  uv run --python "$VENV_DIR/bin/python" zensical build
fi

if [ ! -d "$SITE_DIR" ]; then
  echo "Docs output directory not found: $SITE_DIR"
  exit 1
fi

mkdir -p "$DIST_DIR"
rm -f "$ZIP_PATH"

(cd "$SITE_DIR" && zip -r -q "$ZIP_PATH" .)
echo "Docs bundle created at $ZIP_PATH"

(cd "$CDK_DIR" && PATH="$VENV_DIR/bin:$PATH" cdk deploy ImgcompressDocsStack \
  --require-approval never \
  --outputs-file "$CDK_DIR/cdk-outputs.json" \
  -c "docs_path=$SITE_DIR" \
  -c deploy_docs=true)

"$VENV_DIR/bin/python" "$CDK_DIR/deploy.py"
