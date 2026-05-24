#!/bin/bash
set -e  # Exit immediately if a command exits with a non-zero status

. /venv/bin/activate

# `test_unverified_formats_api.py` exercises /api/compress against a
# running app container, so it cannot run in this job (which has no app
# container up). It runs in its own CI job `test-unverified-formats-api`
# that brings up the container first.
pytest tests/integration \
  --ignore=tests/integration/test_unverified_formats_api.py \
  -s "$@"

deactivate
