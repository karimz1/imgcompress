#!/bin/bash

pytest tests/ \
  --junitxml=reports/test-results.xml \
  --cov=tests/ \
  --cov-report=xml:reports/test-coverage.xml


