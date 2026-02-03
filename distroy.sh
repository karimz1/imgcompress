#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CDK_DIR="$ROOT_DIR/infra/cdk"
VENV_DIR="$CDK_DIR/.venv"
HOSTED_ZONE_DOMAIN="${HOSTED_ZONE_DOMAIN:-karimzouine.com}"
SITE_DOMAIN="${SITE_DOMAIN:-ig.$HOSTED_ZONE_DOMAIN}"
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

(cd "$CDK_DIR" && AWS_REGION="$CDK_REGION" AWS_DEFAULT_REGION="$CDK_REGION" PATH="$VENV_DIR/bin:$PATH" \
  cdk destroy ImgcompressDocsStack \
  --force \
  -c deploy_docs=false \
  -c enable_custom_domain=true \
  -c "hosted_zone_domain=$HOSTED_ZONE_DOMAIN" \
  -c "site_domain=$SITE_DOMAIN")

"$VENV_DIR/bin/python" "$CDK_DIR/destroy.py"
