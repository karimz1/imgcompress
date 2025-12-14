#!/bin/bash
set -euo pipefail

. /venv/bin/activate

mkdir -p reports

pytest tests/unit \
  --junitxml=reports/unit-test-results.xml \
  --cov=tests \
  --cov-report=xml:reports/unit-test-coverage.xml \
  -s \
  "$@"

deactivate
