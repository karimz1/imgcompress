#!/bin/bash
set -e  # Exit immediately if a command exits with a non-zero status

. /venv/bin/activate

pytest tests/ \
  --junitxml=reports/test-results.xml \
  --cov=tests/ \
  --cov-report=xml:reports/test-coverage.xml \
  -s

deactivate
