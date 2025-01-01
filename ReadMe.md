# imgcompress: Image Compression Tool

![Docker Pulls](https://img.shields.io/docker/pulls/karimz1/imgcompress)
![Docker Image Version](https://img.shields.io/docker/v/karimz1/imgcompress?sort=semver)
![Docker Image Size](https://img.shields.io/docker/image-size/karimz1/imgcompress/latest)
[![Build and Test Docker Image](https://github.com/karimz1/imgcompress/actions/workflows/deploy.yml/badge.svg?branch=main)](https://github.com/karimz1/imgcompress/actions/workflows/deploy.yml)

![imgcompress Logo](./images/imgcompress_logo.jpg)

## What is this image ?

`imgcompress` is a lightweight, efficient, and fully Dockerized tool for compressing, resizing, and converting images, specifically tailored to modern image processing needs. With built-in support for HEIC-to-JPG conversion and JSON output for seamless integration with external systems, this tool is designed to work efficiently in both standalone and automated workflows.

### Key Features

- **HEIC to JPG Conversion**: Convert iPhone HEIC photos to widely compatible JPG format.
- **Compression and Resizing**: Adjust image quality and dimensions for optimized storage and faster loading.
- **Batch Processing**: Process entire directories of images with one command.
- **Default Text Logging**: Standard logs with timestamps and statuses are human-readable and suitable for debugging or monitoring.
- **JSON Logging for API-Like Usage**: Output structured logs in JSON format for easy integration with external applications or pipelines.
- **Automatic Folder Management**: Automatically creates output directories if they don't exist.
- **Configurable Logging**: Debug mode (`--debug`) for detailed logs and standard logs for routine tasks.

------

## Installation

Pull the Docker image with a single command:

```bash
docker pull karimz1/imgcompress
```

------

## Usage

### Basic Example

```bash
docker run --rm \
  -v "$(pwd)/tests/sample-images:/app/input_folder" \
  -v "$(pwd)/tests/output:/app/output_folder" \
  karimz1/imgcompress \
  /app/input_folder /app/output_folder --quality 85 --width 800
```

### Parameters Breakdown

- **`--quality`**: Set compression quality (1–100, default: 85).
- **`--width`**: Optional, resizes images to the specified width while maintaining aspect ratio.
- **`--debug`**: Enable verbose logs for troubleshooting.
- **`--json-output`**: Output logs in JSON format for capturing results programmatically.

------

### Default Text Output

By default, `imgcompress` produces text-based logs, ideal for manual monitoring or debugging. Example:

```shell
2025-01-01 00:29:48,496 - INFO - Starting conversion: /app/input_folder -> /app/output_folder with quality=80, width=800
2025-01-01 00:29:48,924 - INFO - Converted: /app/input_folder/pexels-willianjusten-29944187.jpg -> /app/output_folder/pexels-willianjusten-29944187.jpg (Q=80, W=800)
2025-01-01 00:29:50,494 - INFO - Converted: /app/input_folder/test_image.png -> /app/output_folder/test_image.jpg (Q=80, W=800)
2025-01-01 00:29:50,820 - INFO - Converted: /app/input_folder/pexels-pealdesign-28594392.jpg -> /app/output_folder/pexels-pealdesign-28594392.jpg (Q=80, W=800)
2025-01-01 00:29:50,820 - INFO - Summary: 3 files processed, 0 errors.
```

------


### JSON Output Mode

When the `--json-output` flag is used, all logs and summaries are emitted as structured JSON. This feature makes `imgcompress` act as a lightweight API for external applications or pipelines. Example JSON output for a successful run:

```json
{"level": "info", "message": "Starting conversion: /app/input_folder -> /app/output_folder with quality=80, width=800"}
{"level": "info", "message": "Converted: /app/input_folder/pexels-willianjusten-29944187.jpg -> /app/output_folder/pexels-willianjusten-29944187.jpg (Q=80, W=800)"}
{"level": "info", "message": "Converted: /app/input_folder/test_image.png -> /app/output_folder/test_image.jpg (Q=80, W=800)"}
{"level": "info", "message": "Converted: /app/input_folder/pexels-pealdesign-28594392.jpg -> /app/output_folder/pexels-pealdesign-28594392.jpg (Q=80, W=800)"}
{
    "summary": [
        {
            "file": "pexels-willianjusten-29944187.jpg",
            "status": "success",
            "source": "/app/input_folder/pexels-willianjusten-29944187.jpg",
            "destination": "/app/output_folder/pexels-willianjusten-29944187.jpg",
            "original_width": 3648,
            "resized_width": 800
        },
        {
            "file": "test_image.png",
            "status": "success",
            "source": "/app/input_folder/test_image.png",
            "destination": "/app/output_folder/test_image.jpg",
            "original_width": 6000,
            "resized_width": 800
        },
        {
            "file": "pexels-pealdesign-28594392.jpg",
            "status": "success",
            "source": "/app/input_folder/pexels-pealdesign-28594392.jpg",
            "destination": "/app/output_folder/pexels-pealdesign-28594392.jpg",
            "original_width": 3486,
            "resized_width": 800
        }
    ],
    "status": "success",
    "errors": 0
}
```

In case of errors, the `status` will be `failed`, and detailed information about each failed file will be included.

------

### Full Help Menu

Use the `--help` flag for complete details on all options:

```bash
docker run --rm karimz1/imgcompress --help
```

------

## Advanced Use Cases

### HEIC Conversion

Simply add HEIC files to the input directory. `imgcompress` will automatically convert them to JPG while respecting the provided compression quality and resizing options.

### Integrating with External Applications

To integrate `imgcompress` with a larger pipeline or workflow, use the `--json-output` flag to capture output and monitor statuses programmatically. This allows for seamless automation and error handling in CI/CD pipelines or other automated environments.

------

## Contribution

We welcome contributions from the community! To contribute:

1. Fork the repository.
2. Clone your fork.
3. Create a feature branch.
4. Commit and push your changes.
5. Submit a pull request.

For any issues or feature requests, feel free to open an issue in the GitHub repository.

------

## ❤️ Supporting the Project ❤️

If you find this project useful, please consider supporting its development. Donations are appreciated and help maintain and improve this tool. 

**PayPal:** [mails.karimzouine@gmail.com](mailto:mails.karimzouine@gmail.com)

------

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.