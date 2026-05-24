#!/bin/bash
set -eu

if [ -f /venv/bin/activate ]; then
  . /venv/bin/activate
fi

if command -v ruff >/dev/null 2>&1; then
  ruff check backend tests healthcheck.py update_dockerhub_description.py
elif command -v uvx >/dev/null 2>&1; then
  uvx ruff check backend tests healthcheck.py update_dockerhub_description.py
else
  echo "ruff is required. Install ruff or run through the devcontainer." >&2
  exit 127
fi

if [ -n "${VIRTUAL_ENV:-}" ]; then
  deactivate
fi
