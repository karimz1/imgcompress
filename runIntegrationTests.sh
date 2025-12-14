#!/bin/bash
set -euo pipefail

. /venv/bin/activate

pytest tests/integration -s "$@"

deactivate
