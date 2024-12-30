#!/bin/sh

# Exit immediately if any command fails
set -e

python3 -m venv /venv
. /venv/bin/activate
pip install -r requirements-dev.txt

# Run pytest and handle failure
pytest tests/ \
  --junitxml=reports/test-results.xml \
  --cov=tests/ \
  --cov-report=xml:reports/test-coverage.xml \
  -s || { echo "Tests failed! Exiting..."; deactivate; exit 1; }

# Deactivate the virtual environment
deactivate
