#!/bin/bash
set -e  # Exit immediately if a command exits with a non-zero status

source venv/bin/activate

mkdir -p reports

pytest tests/unit \
  --junitxml=reports/unit-test-results.xml \
  --cov=tests \
  --cov-report=xml:reports/unit-test-coverage.xml \
  -s \
  "$@"

deactivate
