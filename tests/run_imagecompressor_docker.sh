# !/bin/bash

TESTS_DIR="$(cd "$(dirname "$0")" && pwd)"

docker run --rm \
  -v "${TESTS_DIR}/sample-images:/app/input_folder" \
  -v "${TESTS_DIR}/output:/app/output_folder" \
  karimz1/imgcompress:local-test \
  /app/input_folder /app/output_folder --quality 90 --width 800