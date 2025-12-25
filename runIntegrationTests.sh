#!/bin/bash
set -e  # Exit immediately if a command exits with a non-zero status

source . /venv/bin/activate

pytest tests/integration -s "$@"

deactivate
