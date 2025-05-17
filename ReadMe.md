# imgcompress: The Ultimate Docker Image Compression Tool

[![Docker Pulls](https://img.shields.io/docker/pulls/karimz1/imgcompress)](https://hub.docker.com/r/karimz1/imgcompress)  
[![Docker Image Version](https://img.shields.io/docker/v/karimz1/imgcompress?sort=semver)](https://hub.docker.com/r/karimz1/imgcompress)  
[![Docker Image Size](https://img.shields.io/docker/image-size/karimz1/imgcompress/latest)](https://hub.docker.com/r/karimz1/imgcompress)  
[![Build and Test Docker Image](https://github.com/karimz1/imgcompress/actions/workflows/deploy.yml/badge.svg?branch=main)](https://github.com/karimz1/imgcompress/actions/workflows/deploy.yml)

![Web UI in Action](images/web_ui_2025-02-22_17-54-17.gif)

## 📋 Table of Contents
- [🚀 Quick Start (Web UI in 30 s)](#-quick-start-web-ui-in-30-s)
- [❓Why imgcompress?](#why-imgcompress)
- [✨ Feature Overview](#-feature-overview)
- [🛠️ Scriptable CLI — Advanced Guide](#️-scriptable-cli--advanced-guide)
- [✅ Supported Image Formats](#-supported-image-formats)
- [🖥️ Supported Platforms](#️-supported-platforms)
- [🔒 Privacy \& Security](#-privacy--security)
- [🤝 Contribute](#-contribute)
- [❤️ Support Development](#️-support-development)
- [📝 License](#-license)

## 🚀 Quick Start (Web UI in 30 s)

Spin up **Imgcompress** with Docker Compose (auto-updates via Watchtower are optional):

```yaml
services:
  imgcompress:
    image: karimz1/imgcompress:latest
    container_name: imgcompress
    restart: always
    ports:
      - "3001:5000"                  # HOST:CONTAINER — change 3001 if you like
    command:
      - "web"                        # launch the Web UI
````
```bash
docker compose up -d   # start it
```

Open **[http://localhost:3001](http://localhost:3001/)**, drag-and-drop images, enjoy!

🧪 Quick test, easy throw-away one-liner, if you don't like it (<code>Ctrl-C</code> to stop)

````bash
docker run --rm -p 8081:5000 karimz1/imgcompress:latest web
````

## ❓Why imgcompress?

Ever been frustrated by juggling multiple programs just to convert or compress images?
**Me too.** I’m **Karim Zouine**, and I built **Imgcompress** as a one-stop solution to compress, convert and resize images—locally, inside Docker, on any OS, with no privacy worries.


## ✨ Feature Overview

- **📱 HEIC-to-Anything in one click**  
  Convert iPhone HEIC/HEIF photos to JPEG, PNG—or any other format—instantly, with zero plugins.

- **🖼️ Universal conversion + resize**  
  Turn *nearly* any image type Pillow supports into JPEG, PNG, ICO, WebP and more; perfect for thumbnails, favicons, hero banners or custom sizes.

- **⚙️ Precision quality control**  
  Dial in exact JPEG quality (1-100) or choose lossless PNG/WebP; strike the perfect balance between clarity and file size.

- **🚀 Parallel batch engine**  
  Drop a single file *or* an entire directory; Imgcompress fans out the work across CPU cores for maximum throughput.

- **🛠️ Scriptable CLI for advanced workflows**  
  Stream **millions** of images from Bash, cron or CI pipelines, chain transformations, and capture structured JSON logs for downstream automation.

- **🔄 Automation-friendly logging**
  Human-readable by default; flip `--json-output` to feed dashboards, tests or ETL jobs.

  **📦 Runs anywhere Docker does**
  Same image on Linux, macOS, Windows (WSL 2), x86-64 or ARM64.
  

## 🛠️ Scriptable CLI — Advanced Guide

Need to crunch **millions** of images? Fire up the CLI, no limits, fully scriptable.

**Single File Processing:**

``` bash
docker run --rm \
  -v "$(pwd):/container/images" \
  -v "$(pwd)/converted:/container/converted" \
  karimz1/imgcompress:latest \
  /container/images/example.jpg /container/converted --quality 80 --width 1920
```

**Folder Processing:**

``` bash
docker run --rm \
  -v "$(pwd):/container/images" \
  -v "$(pwd)/converted:/container/converted" \
  karimz1/imgcompress:latest \
  /container/images /container/converted --quality 85 --width 800
```
**How it works**

1. **📁 Local directory mapping**
   - **Input:** original images
   - **Output:** optimised images
2. **⚙️ Process parameters**
   - `--quality` (1–100, default 85)
   - `--width` (optional resize)
   - `--debug` (verbose logs)
   - `--json-output` (machine-friendly logs for CI)


---

## ✅ Supported Image Formats

**Verified in CI**

`*.heic · *.heif · *.png · *.jpg · *.jpeg · *.ico`


<details>
<summary>🗂️ Supported (not yet verified)</summary>

The formats below are available through [Pillow Doc](https://pillow.readthedocs.io/en/stable/handbook/image-file-formats.html#) but haven’t gone through my test-suite ***yet***.  

Open an issue with a sample file if you hit problems; I’ll add a test and patch it.

| Extension(s) | Extension(s) | Extension(s) | Extension(s) |
| ------------ | ------------ | ------------ | ------------ |
| .apng        | .blp         | .bmp         | .bufr        |
| .bw          | .cur         | .dcx         | .dds         |
| .dib         | .emf         | .eps         | .fit / .fits |
| .flc / .fli  | .ftc / .ftu  | .gbr         | .gif         |
| .grib        | .h5 / .hdf   | .icb         | .icns        |
| .iim         | .im          | .j2c / .j2k  | .jfif        |
| .jp2 / .jpc  | .jpf         | .jpx         | .mpeg / .mpg |
| .msp         | .pbm         | .pcd         | .pcx         |
| .pfm         | .pgm         | .pnm         | .ppm         |
| .ps / .psd   | .pxr         | .qoi         | .ras         |
| .rgb / .rgba | .sgi         | .tga         | .tif / .tiff |
| .vda / .vst  | .webp        | .wmf         | .xbm         |
| .xpm         |              |              |              |

Need a format that’s missing or failing?
[Open an issue](https://github.com/karimz1/imgcompress/issues) with a sample file and short description—happy to expand coverage!
</details>

------

## 🖥️ Supported Platforms

| Docker image platform | Typical host | Status |
|-----------------------|--------------|:------:|
| **linux/amd64**       | x86-64 Linux, Windows (WSL 2) | ✅ |
| **linux/arm64**       | Apple Silicon, Raspberry Pi 4+, AWS Graviton | ✅ |

> **Windows desktop:** Runs via Docker Desktop + WSL 2 (no native Windows-container build needed).

<details>
<summary>💡 Testing note (click to expand)</summary>

All platforms above are built and run in CI with QEMU multi-arch emulation and a GitHub Actions matrix.  
That means the images pass automated tests, but not every architecture has been manually tried on physical hardware.

</details>


------

## 🔒 Privacy & Security

- **100 % local processing** — images never leave your machine.
- **No telemetry, no tracking** — the container has zero outbound analytics.
- **Open-source code & reproducible builds** — inspect, audit, fork at will.
- **Docker isolation** — run with read-only volumes or network-disabled mode for extra peace of mind.

---

## 🤝 Contribute

Want to make Imgcompress even better?

1. **Star** the repo to spread the word.  
2. **Fork → Branch → PR** — small patches are welcome!  
3. Browse ⚡ **`good first issue`** and **`help wanted`** tags for starter tasks.  
4. File a bug or feature request on the [issue tracker](https://github.com/karimz1/imgcompress/issues).

All contributions follow the standard *Fork & PR* workflow plus. Thank you for making open-source better!

---

## ❤️ Support Development

If Imgcompress saves you time, consider buying me a coffee, every donation keeps CI minutes ticking and pays for test data storage.

[![Donate with PayPal](https://img.shields.io/badge/Donate-PayPal-blue?logo=paypal)](https://paypal.me/KarimZouine972)

*(Completely optional, always appreciated.)*

---

## 📝 License

Released under the **MIT License**, see [`LICENSE`](LICENSE) for full text.
Third-party libraries remain under their respective licenses.