#!/bin/bash
set -euo pipefail

# Use the bootstraper so local runs match production server settings.
python -m backend.image_converter.bootstraper web
