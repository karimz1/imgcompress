# imgcompress: Image Compression Tool

![Docker Pulls](https://img.shields.io/docker/pulls/karimz1/imgcompress)
![Docker Image Version](https://img.shields.io/docker/v/karimz1/imgcompress?sort=semver)
![Docker Image Size](https://img.shields.io/docker/image-size/karimz1/imgcompress/latest)
[![Build and Test Docker Image](https://github.com/karimz1/imgcompress/actions/workflows/deploy.yml/badge.svg?branch=main)](https://github.com/karimz1/imgcompress/actions/workflows/deploy.yml)


## What is this image ?

`imgcompress` is a lightweight, efficient, and scalable image compression tool available as a Docker image. It is designed for compressing and optimizing images while maintaining high quality. A standout feature is its support for converting HEIC photos (common on iPhones) to standard JPG format.

## Features

- **Dockerized**: Run the tool effortlessly in any Docker-compatible environment.
- **Configurable**: Adjust image quality and dimensions as needed.
- **Batch Processing**: Process entire directories in one go.
- **Automatic Output Directory**: Creates the output folder if it doesn’t already exist.
- **HEIC to JPG Conversion**: Seamlessly convert HEIC images from iPhones to JPG.

------

## Installation

To get started, pull the Docker image:

```bash
docker pull karimz1/imgcompress
```

------

## Usage

### Basic Command

```bash
docker run --rm \
  -v "$(pwd)/tests/sample-images:/app/input_folder" \
  -v "$(pwd)/tests/output:/app/output_folder" \
  karimz1/imgcompress \
  /app/input_folder /app/output_folder --quality 90 --width 800
```

### Command Breakdown

- `docker run --rm`: Runs the container and removes it after execution.
- `-v "$(pwd)/tests/sample-images:/app/input_folder"`: Maps your local input folder containing images to the container's input directory.
- `-v "$(pwd)/tests/output:/app/output_folder"`: Maps your local output folder to the container's output directory.
- `/app/input_folder /app/output_folder`: Source and destination paths inside the container.
- `--quality 90`: Sets the compression quality (default: 90).
- `--width 800`: Optional, resizes images to a max width of 800 pixels.

### HEIC Conversion

Add HEIC files to the input directory to automatically convert them to JPG format during processing.

### Using Custom Paths

Replace `$(pwd)/tests/sample-images` and `$(pwd)/tests/output` with your own directories. Ensure the input directory exists and contains images.

------

## Contribution

1. Fork the repository.
2. Clone your fork.
3. Create a new branch for your feature or bugfix.
4. Commit and push your changes.
5. Open a pull request.

------

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.
