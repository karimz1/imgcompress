#!/usr/bin/env bash
set -e

# Ensure uv is installed
if ! command -v uv >/dev/null 2>&1; then
  echo "uv is not installed. Install it with:"
  echo "  curl -Ls https://astral.sh/uv/install.sh | sh"
  exit 1
fi

# Create virtual environment if missing
if [ ! -d ".venv" ]; then
  echo "Creating virtual environment..."
  uv venv .venv
fi

# Install documentation dependencies
echo "Installing documentation dependencies..."
uv pip install -r docs/requirements.txt

# Start local documentation server
echo "Starting local documentation server..."
echo "Open http://127.0.0.1:8000 in your browser"

uv run .venv/bin/zensical serve
