#!/bin/bash
set -e  # Exit immediately if a command exits with a non-zero status

if [ -f /venv/bin/activate ]; then
  . /venv/bin/activate
fi

pytest tests/unit \
  -s "$@"


if [ -n "${VIRTUAL_ENV:-}" ]; then
  deactivate
fi
