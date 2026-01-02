# CLI & Automation Guide

For advanced workflows, CI/CD pipelines, and high-volume batch processing, **imgcompress** provides a robust command-line interface (CLI).

## 🛠️ Performance Overview

The CLI allows you to execute the image processor directly without initializing the web server. This significantly reduces memory overhead and startup time for automation scripts and scheduled tasks.

| **Mode** | **Purpose**                 | **Best For**                                          |
| -------- | --------------------------- | ----------------------------------------------------- |
| **web**  | [Web UI](web-ui.md) (Default Mode) | Interactive usage using web interface, recommended for most users. |
| **cli**  | Single-shot Execution       | Continuous Integration (CI), cronjobs, batch scripts. |

------

## 💻 Technical Examples

The CLI operates inside the same Docker container. You must map your local directories to the container to grant it access to your files.

!!! important
    **Volume Mapping:** The `-v "$(pwd):/container/images"` flag creates a bridge between your local folder and the container.

    * **Host Path:** `$(pwd)` is where your files live on your computer.
    * **Container Path:** `/container/images` is where the tool "looks" for them inside its own isolated environment.

    Because the tool is running **inside** the container, all paths you pass as arguments must start with the internal path (e.g., `/container/...`).



### 1. Single File Processing

Use these commands when you need to target a specific asset with precise settings.

**Step 1: Check your local files** Identify the image you want to convert in your current folder.

```bash
❯ ls
anotherImage.jpg   myExampleImage.jpg
```

**Step 2: Run the command** Replace `myExampleImage.jpg` in the path below with the filename you saw in your `ls` output.

```bash
docker run --rm \
  -v "$(pwd):/container/images" \
  -v "$(pwd)/converted:/container/converted" \
  karimz1/imgcompress:latest \
  cli \
  /container/images/myExampleImage.jpg \
  /container/converted \
  --quality 80 \
  --width 1920 \
  --format png
```

**AI Background Removal** Perfect for product photography. This requires the output format to be `png` to support transparency.

```bash
docker run --rm \
  -v "$(pwd):/container/images" \
  -v "$(pwd)/converted:/container/converted" \
  karimz1/imgcompress:latest \
  cli \
  /container/images/myExampleImage.jpg \
  /container/converted \
  --format png \
  --remove-background
```

### 2. Batch Processing

To process **every image** in your current folder at once, provide the folder path instead of a specific filename:

```bash
docker run --rm \
  -v "$(pwd):/container/images" \
  -v "$(pwd)/converted:/container/converted" \
  karimz1/imgcompress:latest \
  cli \
  /container/images \
  /container/converted \
  --quality 85 \
  --width 1200 \
  --format jpeg
```

!!! TIP
    Automation Tip: Use the ``--json-output`` flag to receive structured logs. This is perfect for piping output into ``jq`` to trigger follow-up actions in your scripts.

------

## ⚙️ Parameter Reference

| **Flag**              | **Default** | **Description**                                         |
| --------------------- | ----------- | ------------------------------------------------------- |
| `--quality`           | `85`        | Compression level (1-100).                              |
| `--width`             | *None*      | Resize to a specific width (maintains aspect ratio).    |
| `--format`            | `jpeg`      | Output encoding: `jpeg` or `png`.                       |
| `--remove-background` | `False`     | Enable AI background removal (Requires `--format png`). |
| `--json-output`       | `False`     | Output logs in JSON format for easy script integration. |
| `--debug`             | `False`     | Enable verbose developer logs for troubleshooting.      |

------

## 📄 Expected Output

When a process finishes successfully (as shown in [Single File Processing](#1-single-file-processing)), the CLI provides a concise summary:

### Plain Text Mode (Default)
```Plaintext
started using mode: cli
Processing file: /container/images/myExampleImage.jpg
Summary: 1 file(s) processed, 0 error(s).
```

### JSON Capture Mode 

Append the flag: `--json-output` at the end of the command.
```json
{
    "status": "complete",
    "conversion_results": {
        "files": [
            {
                "file": "myExampleImage.png",
                "source": "/container/images/myExampleImage.jpg",
                "destination": "/container/converted/myExampleImage.png",
                "original_width": 3840,
                "resized_width": 1920,
                "is_successful": true,
                "error": null
            }
        ],
        "file_processing_summary": {
            "total_files_count": 1,
            "successful_files_count": 1,
            "failed_files_count": 0
        }
    }
}
```