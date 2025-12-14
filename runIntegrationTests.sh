#!/bin/bash
set -e  # Exit immediately if a command exits with a non-zero status

. /venv/bin/activate

pytest tests/integration -s "$@"

deactivate
