#!/usr/bin/env bash
set -euo pipefail

# --- Configuration ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CDK_DIR="$SCRIPT_DIR/cdk"
VENV_DIR="$CDK_DIR/.venv"

# Use environment variables if set, otherwise use defaults
SITE_DIR="${DOCS_OUTPUT_DIR:-$ROOT_DIR/site}"
HOSTED_ZONE_DOMAIN="${HOSTED_ZONE_DOMAIN:-karimzouine.com}"
SITE_DOMAIN="${SITE_DOMAIN:-imgcompress.$HOSTED_ZONE_DOMAIN}"
CDK_REGION="${CDK_REGION:-us-east-1}"

# --- Environment Setup ---
if ! command -v uv >/dev/null 2>&1; then
  echo "Error: 'uv' is not installed. Visit https://astral.sh/uv for installation."
  exit 1
fi

if [ ! -d "$VENV_DIR" ]; then
  echo "Creating virtual environment..."
  uv venv "$VENV_DIR"
fi

echo "Syncing dependencies..."
uv pip install --python "$VENV_DIR/bin/python" \
  -r "$CDK_DIR/requirements.txt" \
  -r "$ROOT_DIR/docs/requirements.txt"

# --- Formatting & Asset Bundling ---
echo "Bundling documentation assets..."
(
  cd "$ROOT_DIR/docs"
  npm install
  npm run bundle-assets
)

# --- Build Step ---
echo "Building static site with zensical..."
ZENSICAL_EXTRA="${ZENSICAL_BUILD_ARGS:-}"
(
  cd "$ROOT_DIR"
  # shellcheck disable=SC2086
  uv run --python "$VENV_DIR/bin/python" zensical build $ZENSICAL_EXTRA
)

if [ ! -d "$SITE_DIR" ]; then
  echo "Error: Site directory not found at $SITE_DIR"
  exit 1
fi

# --- Deployment Step ---
echo "Deploying CloudFront Distribution and S3 Assets..."

export PATH="$VENV_DIR/bin:$PATH"

(
  cd "$CDK_DIR"
  AWS_REGION="$CDK_REGION" AWS_DEFAULT_REGION="$CDK_REGION" \
  cdk deploy ImgcompressStaticSiteStack \
    --require-approval never \
    --outputs-file "cdk-outputs.json" \
    -c "docs_path=$SITE_DIR" \
    -c "deploy_docs=true" \
    -c "enable_custom_domain=true" \
    -c "hosted_zone_domain=$HOSTED_ZONE_DOMAIN" \
    -c "site_domain=$SITE_DOMAIN"
)

echo "Deployment Complete!"
