#!/bin/bash
set -e  # Exit immediately if a command exits with a non-zero status

if [ -f /venv/bin/activate ]; then
  . /venv/bin/activate
fi

# `test_unverified_formats_api.py` and `test_rembg_models_api.py` exercise
# /api/compress against a running app container, so they cannot run in this job
# (which has no app container up). They run in the `test-unverified-formats-api`
# CI job that brings up the container first.
pytest tests/integration \
  --ignore=tests/integration/test_unverified_formats_api.py \
  --ignore=tests/integration/test_rembg_models_api.py \
  -s "$@"

if [ -n "${VIRTUAL_ENV:-}" ]; then
  deactivate
fi
