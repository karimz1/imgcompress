#!/bin/bash
set -e  # Exit immediately if a command exits with a non-zero status

. /venv/bin/activate

# `test_unverified_formats_matrix.py` is an exploratory smoke test for the
# "Other possible formats" surface. It runs in its own non-blocking CI job
# (test-unverified-formats-smoke) so a failing exotic format does not gate
# normal PRs. Ignore it here to avoid double-running it.
pytest tests/integration \
  --ignore=tests/integration/test_unverified_formats_matrix.py \
  -s "$@"

deactivate
