#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV_DIR="${PROJECT_ROOT}/.venv"

cd "${PROJECT_ROOT}"

if [ -f /venv/bin/activate ]; then
  # Running inside the devcontainer.
  . /venv/bin/activate
else
  # Create a project-local virtual environment if it doesn't exist.
  if [ ! -f "${VENV_DIR}/bin/activate" ]; then
    python3 -m venv "${VENV_DIR}"
  fi

  . "${VENV_DIR}/bin/activate"

  # Install Ruff into the local virtual environment if needed.
  if [ ! -x "${VENV_DIR}/bin/ruff" ]; then
    python -m pip install ruff
  fi
fi

ruff check \
  backend \
  tests \
  healthcheck.py \
  update_dockerhub_description.py

if command -v deactivate >/dev/null 2>&1; then
  deactivate
fi