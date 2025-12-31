# Scriptable CLI

For advanced use cases, CI/CD pipelines, and batch processing, imgcompress offers a powerful command-line interface.

## 🛠️ Overview

The CLI allows you to run the image processor directly without starting the Web server. This is perfect for automation scripts.

### CLI vs Web Mode

| Mode | Description | When to use | 
|----|----|----|
| `web` | Starts the Web UI server (Default) | Interactive usage, hosting on a server/NAS |
| `cli` | Runs the image processor once | Automation, cronjobs, build pipelines |

## 💻 Examples

The CLI runs inside the Docker container. You map your local folders to the container to process files.

### 1. Process a Single File

Optimize `example.jpg` and save it to the `converted` folder.

```bash
docker run --rm \
  -v "$(pwd):/container/images" \
  -v "$(pwd)/converted:/container/converted" \
  karimz1/imgcompress:latest \
  cli \
  /container/images/example.jpg /container/converted --quality 80 --width 1920
```

### 2. Batch Process a Folder

Convert all images in the current directory.

```bash
docker run --rm \
  -v "$(pwd):/container/images" \
  -v "$(pwd)/converted:/container/converted" \
  karimz1/imgcompress:latest \
  cli \
  /container/images /container/converted --quality 85 --width 800
```

### 3. AI Background Removal

Remove background from `photo.jpg` and save as PNG.

```bash
docker run --rm \
  -v "$(pwd):/container/images" \
  -v "$(pwd)/converted:/container/converted" \
  karimz1/imgcompress:latest \
  cli \
  /container/images/photo.jpg /container/converted \
  --format png --remove-background
```

## ⚙️ Parameters

| Flag | Default | Description |
|------|---------|-------------|
| `--quality` | `85` | JPEG quality (1-100) |
| `--width` | `None` | Resize to specific width (maintains aspect ratio) |
| `--format` | `jpeg` | Output format: `jpeg` or `png` |
| `--remove-background` | `False` | Enable AI background removal (Requires `--format png`) |
| `--debug` | `False` | Enable verbose logging |
| `--json-output` | `False` | Output logs in JSON format for parsing |

