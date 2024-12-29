#!/bin/bash

# Run the Docker container
docker run --rm \
  -v "$(pwd)/sample-images:/app/input_folder" \
  -v "$(pwd)/output:/app/output_folder" \
  karimz1/imgcompress \
  /app/input_folder /app/output_folder --quality 90 --width 800