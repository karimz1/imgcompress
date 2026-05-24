#!/usr/bin/env bash
set -e

if [ -f /venv/bin/activate ]; then
  . /venv/bin/activate
fi

mkdir -p reports

PYTEST_COV_ARGS=()
PYTHON_BIN="python"

if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  PYTHON_BIN="python3"
fi

if "$PYTHON_BIN" -c "import pytest_cov" >/dev/null 2>&1; then
  PYTEST_COV_ARGS=(
    --cov=tests
    --cov-report=xml:reports/unit-test-coverage.xml
  )
fi

pytest tests/unit \
  --junitxml=reports/unit-test-results.xml \
  "${PYTEST_COV_ARGS[@]}" \
  -s \
  "$@"

if [ -n "${VIRTUAL_ENV:-}" ]; then
  deactivate
fi