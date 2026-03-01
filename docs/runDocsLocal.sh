#!/usr/bin/env bash
set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Ensure uv is installed
if ! command -v uv >/dev/null 2>&1; then
  echo "uv is not installed. Install it with:"
  echo "  curl -Ls https://astral.sh/uv/install.sh | sh"
  exit 1
fi

# Ensure virtual environment exists in root
if [ ! -d "$ROOT_DIR/.venv" ]; then
  echo "Creating virtual environment in $ROOT_DIR..."
  (cd "$ROOT_DIR" && uv venv .venv)
fi

# Bundle assets with NPM (inside docs folder)
echo "Bundling third-party assets..."
(cd "$SCRIPT_DIR" && npm install && npm run bundle-assets)

# Zensical doesn't support exclude_docs, so keep docs_dir clean for search indexing
rm -rf "$SCRIPT_DIR/node_modules"

# Install documentation dependencies
echo "Installing documentation dependencies..."
(cd "$ROOT_DIR" && uv pip install -r docs/requirements.txt)

# Start local documentation server
echo "Starting local documentation server..."

# Get local IP for convenience
LOCAL_IP=$(ipconfig getifaddr en0 || ipconfig getifaddr en1 || echo "localhost")
echo "------------------------------------------------"
echo "💻 Local:   http://127.0.0.1:8000"
echo "📱 Mobile:  http://$LOCAL_IP:8000"
echo "------------------------------------------------"

(cd "$ROOT_DIR" && uv run .venv/bin/zensical serve --dev-addr 0.0.0.0:8000)
