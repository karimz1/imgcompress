#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CDK_DIR="$ROOT_DIR/infra/cdk"
VENV_DIR="$CDK_DIR/.venv"

if ! command -v uv >/dev/null 2>&1; then
  echo "uv is not installed. Install it with:"
  echo "  curl -Ls https://astral.sh/uv/install.sh | sh"
  exit 1
fi

if [ ! -d "$VENV_DIR" ]; then
  uv venv "$VENV_DIR"
fi

uv pip install --python "$VENV_DIR/bin/python" -r "$CDK_DIR/requirements.txt"

(cd "$CDK_DIR" && PATH="$VENV_DIR/bin:$PATH" cdk destroy ImgcompressDocsStack \
  --force \
  -c deploy_docs=false)

"$VENV_DIR/bin/python" "$CDK_DIR/destroy.py"
