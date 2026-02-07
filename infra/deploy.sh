#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CDK_DIR="$SCRIPT_DIR/cdk"
VENV_DIR="$CDK_DIR/.venv"
SITE_DIR="${DOCS_OUTPUT_DIR:-$ROOT_DIR/site}"
DIST_DIR="$CDK_DIR/dist"
ZIP_PATH="$DIST_DIR/docs.zip"
HOSTED_ZONE_DOMAIN="${HOSTED_ZONE_DOMAIN:-karimzouine.com}"
SITE_DOMAIN="${SITE_DOMAIN:-imgcompress.$HOSTED_ZONE_DOMAIN}"
CDK_REGION="${CDK_REGION:-us-east-1}"

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
  (cd "$ROOT_DIR" && uv run --python "$VENV_DIR/bin/python" zensical build $ZENSICAL_EXTRA)
else
  (cd "$ROOT_DIR" && uv run --python "$VENV_DIR/bin/python" zensical build)
fi

if [ ! -d "$SITE_DIR" ]; then
  echo "Docs output directory not found: $SITE_DIR"
  exit 1
fi


mkdir -p "$DIST_DIR"
rm -f "$ZIP_PATH"

(cd "$SITE_DIR" && zip -r -q "$ZIP_PATH" . -x '*.DS_Store' -x '__MACOSX/*')
echo "Docs bundle created at $ZIP_PATH"

(cd "$CDK_DIR" && AWS_REGION="$CDK_REGION" AWS_DEFAULT_REGION="$CDK_REGION" PATH="$VENV_DIR/bin:$PATH" \
  cdk deploy ImgcompressDocsStack \
  --require-approval never \
  --outputs-file "$CDK_DIR/cdk-outputs.json" \
  -c "docs_path=$SITE_DIR" \
  -c deploy_docs=true \
  -c enable_custom_domain=true \
  -c "hosted_zone_domain=$HOSTED_ZONE_DOMAIN" \
  -c "site_domain=$SITE_DOMAIN")

"$VENV_DIR/bin/python" "$CDK_DIR/deploy.py"
