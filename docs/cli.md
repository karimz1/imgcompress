---
icon: lucide/terminal
title: "Mastering the Commands (CLI)"
description: "Everything you need to know about talking directly to the imgcompress tool for fast, automatic image work."
tags:
  - Get started
  - Automation
---

# Talking to the Container: The CLI

Sometimes you have thousands of photos and don't want to drag and drop them all day. That's where the **CLI** (Command Line Interface) comes in. 

It is like talking directly to the **imgcompress tool**.

## Why use the CLI?

- **Batch work**: Fix a whole folder of images in one go.
- **Fast**: It starts instantly because it doesn't need to show you the Web UI.

---

## How to talk to the Container
If you find this a bit tricky, here is a simple way to think about it: Your computer (the host) is talking to the **imgcompress container**. By running the command, you are allowing the **imgcompress tool** inside that container to talk back to your host so it can see and fix your photos. 

Since the tool lives inside a "suitcase" (the container), you need to build a **bridge** between your computer and the suitcase so it can see your files. 

We do this with the `-v` flag.

- **Your side**: `$(pwd)` (this means "the folder I'm in right now").
- **Container side**: `/container/images`. This is where the container looks for things.

---

## Examples

### 1. Fixing one image
Use these steps when you want to target just one image with specific settings.

**Step 1: Check your local files**
First, see what files are in your current folder:

```bash
ls
# Output:
# photo.jpg   other-image.webp
```

**Step 2: Run the command**
Now, replace `photo.jpg` in the command below with the name of your file:

```bash
docker run --rm \
  -v "$(pwd):/container/images" \
  -v "$(pwd)/done:/container/done" \
  karimz1/imgcompress:latest \
  cli \
  /container/images/photo.jpg \
  /container/done \
  --quality 80 \
  --format png
```

### 2. Fixing a whole folder
Want to shrink every image in your folder? Point it to the folder instead of a single file:

```bash
docker run --rm \
  -v "$(pwd):/container/images" \
  -v "$(pwd)/done:/container/done" \
  karimz1/imgcompress:latest \
  cli \
  /container/images \
  /container/done \
  --format jpeg \
  --quality 85
```

---

## Switches
These are the switches you can flip when talking to the container:

| Switch | What does it do? |
| :--- | :--- |
| `--quality` | How much to shrink it (1 to 100 percent). |
| `--width` | How wide the image should be (it keeps the height perfect). |
| `--format` | Choose `jpeg` or `png`. |
| `--remove-background` | Tell the AI to take the background away. |

!!! tip "For Code Wizards"
    Add `--json-output` at the end to get results that other programs can read easily.