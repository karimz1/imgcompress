#!/bin/sh
set -euo pipefail
set -x

. /venv/bin/activate

if pytest tests/ \
  --junitxml=reports/test-results.xml \
  --cov=tests/ \
  --cov-report=xml:reports/test-coverage.xml \
  -s; then
    echo "Tests passed successfully."
else
    echo "Tests failed! Exiting..."
    deactivate
    exit 1
fi

deactivate
