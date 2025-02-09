#!/bin/bash
set -euo pipefail

python -m flask --app backend.image_converter.presentation.web.server --debug run --host=0.0.0.0 --port=5000