#!/usr/bin/env bash
set -euo pipefail

# --- Configuration ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CDK_DIR="$SCRIPT_DIR/cdk"
VENV_DIR="$CDK_DIR/.venv"

HOSTED_ZONE_DOMAIN="${HOSTED_ZONE_DOMAIN:-karimzouine.com}"
SITE_DOMAIN="${SITE_DOMAIN:-imgcompress.$HOSTED_ZONE_DOMAIN}"
CDK_REGION="${CDK_REGION:-us-east-1}"

# --- Environment Setup ---
if ! command -v uv >/dev/null 2>&1; then
  echo "uv is not installed. Please install it to proceed."
  exit 1
fi

# Ensure venv exists for the CDK to run
if [ ! -d "$VENV_DIR" ]; then
  uv venv "$VENV_DIR"
fi

uv pip install --python "$VENV_DIR/bin/python" -r "$CDK_DIR/requirements.txt"

# --- Destruction Step ---
echo "⚠️  WARNING: This will destroy ImgcompressStaticSiteStack in $CDK_REGION"
echo "    SITE_DOMAIN: $SITE_DOMAIN"
echo "    HOSTED_ZONE_DOMAIN: $HOSTED_ZONE_DOMAIN"
read -r -p "Type 'destroy' to continue: " confirm
if [ "$confirm" != "destroy" ]; then
  echo "Aborted."
  exit 1
fi

export PATH="$VENV_DIR/bin:$PATH"

(
  cd "$CDK_DIR"
  AWS_REGION="$CDK_REGION" AWS_DEFAULT_REGION="$CDK_REGION" \
  cdk destroy ImgcompressStaticSiteStack \
    --force \
    -c deploy_docs=false \
    -c enable_custom_domain=true \
    -c "hosted_zone_domain=$HOSTED_ZONE_DOMAIN" \
    -c "site_domain=$SITE_DOMAIN"
)

# cleanup of local artifacts
echo "Cleaning up local build artifacts..."
rm -rf "$CDK_DIR/cdk.out"
rm -f "$CDK_DIR/cdk-outputs.json"

echo "Infrastructure destroyed successfully."
