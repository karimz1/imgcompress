# CLI & Automation

For advanced workflows, CI/CD pipelines, and high-volume batch processing, imgcompress provides a robust command-line interface (CLI).

## 🛠️ Performance Overview

The CLI allows you to execute the image processor directly without initializing the web server. This significantly reduces overhead for automation scripts and scheduled tasks.

### Execution Modes

| Mode | Purpose | Best For |
| :--- | :--- | :--- |
| `web` | Persistent Web UI (Default) | Interactive usage, home labs, NAS hosting. |
| `cli` | Single-shot Execution | Continuous Integration, cronjobs, batch scripts. |

---

## 💻 Technical Examples

The CLI operates inside the same Docker container. You must map your local directories to the container to grant it access to your files.

!!! info "Volume Mapping"
    Remember that `-v "$(pwd):/container/images"` maps your current working directory to the container's internal path. All paths passed to the CLI must use the **internal container paths**.

### 1. Optimize a Single Image
Perfect for optimizing a high-res asset with specific constraints.

```bash
docker run --rm \
  -v "$(pwd):/container/images" \
  -v "$(pwd)/converted:/container/converted" \
  karimz1/imgcompress:latest \
  cli \
  /container/images/hero.jpg /container/converted --quality 80 --width 1920
```

### 2. Batch Processing
Automatically process an entire directory of images.

```bash
docker run --rm \
  -v "$(pwd):/container/images" \
  -v "$(pwd)/converted:/container/converted" \
  karimz1/imgcompress:latest \
  cli \
  /container/images /container/converted --quality 85 --width 1200
```

### 3. Headless AI Background Removal
Execute AI-powered object isolation without a browser.

```bash
docker run --rm \
  -v "$(pwd):/container/images" \
  -v "$(pwd)/converted:/container/converted" \
  karimz1/imgcompress:latest \
  cli \
  /container/images/product.jpg /container/converted \
  --format png --remove-background
```

!!! tip "Automation Tip"
    Use the `--json-output` flag to receive structured logs that can be easily parsed by `jq` in your shell scripts.

---

## ⚙️ Parameter Reference

| Flag | Default | Description |
| :--- | :--- | :--- |
| `--quality` | `85` | Compression level (1-100). |
| `--width` | `None` | Resize to a specific width (maintains aspect ratio). |
| `--format` | `jpeg` | Output encoding: `jpeg` or `png`. |
| `--remove-background` | `False` | Enable AI background removal (Requires `--format png`). |
| `--json-output` | `False` | Output logs in JSON format for easy script integration. |
| `--debug` | `False` | Enable verbose developer logs. |

