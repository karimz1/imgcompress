#!/bin/bash
set -euo pipefail

. /venv/bin/activate

pytest tests/ \
  --junitxml=reports/test-results.xml \
  --cov=tests/ \
  --cov-report=xml:reports/test-coverage.xml \
  -s

deactivate
