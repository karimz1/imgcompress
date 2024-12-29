#!/bin/sh

python3 -m venv /venv
. /venv/bin/activate
pip install -r requirements-dev.txt
pytest tests/ \
  --junitxml=reports/test-results.xml \
  --cov=tests/ \
  --cov-report=xml:reports/test-coverage.xml \
  -s

deactivate
