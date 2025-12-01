[![Docker Pulls](https://img.shields.io/docker/pulls/karimz1/imgcompress)](https://hub.docker.com/r/karimz1/imgcompress)
[![Docker Image Size](https://img.shields.io/docker/image-size/karimz1/imgcompress/latest)](https://hub.docker.com/r/karimz1/imgcompress)
[![Docker Image Version (latest semver)](https://img.shields.io/docker/v/karimz1/imgcompress?sort=semver)](https://hub.docker.com/r/karimz1/imgcompress/tags)

# imgcompress — Fast, Private Image Compression & Conversion Tool in Docker

Self-hosted TinyPNG alternative to compress, convert, and resize images. The ultimate image compression and convert tool on the web — but running 100% locally on your own server for maximum privacy. Over 69+ formats are supported including HEIC, HEIF, JPG, JPEG, PNG, PSD, TIFF, EPS, ICO, WebP, GIF, PDF & more. Runs entirely in Docker for easy deployment.

Instantly **compress, convert, and resize images** — all **locally**, inside a lightweight Docker container.  
No installs. No uploads. No data ever leaves your machine.

👉 One command to start the web app — drag & drop your images, and download optimized results in seconds.

## Demo Example:
<img src="images/web-ui.gif" alt="imgcompress Web UI in Action" width="490"/>

> **Demo shows:** Import → Convert → Download — all processed locally.  
> Works with HEIC, HEIF, JPG, JPEG, PNG, PSD, TIFF, EPS, ICO, PDFs (each page), and so much more.

> **Demo shows:** Import → Convert → Download — all processed locally.  
> Works with HEIC, HEIF, JPG, JPEG, PNG, PSD, TIFF, EPS, ICO, PDFs (each page), and so much more.

## 📋 Table of Contents
- [imgcompress — Fast, Private Image Compression \& Conversion Tool in Docker](#imgcompress--fast-private-image-compression--conversion-tool-in-docker)
  - [Demo Example:](#demo-example)
  - [📋 Table of Contents](#-table-of-contents)
  - [🚀 Quick Start (Web UI in 30 s)](#-quick-start-web-ui-in-30-s)
  - [🧪 Quick Start (docker run)](#-quick-start-docker-run)
  - [🧼 Minimal Mode: Hide the Mascot](#-minimal-mode-hide-the-mascot)
  - [❓ Why imgcompress?](#-why-imgcompress)
    - [✨ Feature Overview](#-feature-overview)
  - [**🔖 Choosing Your Version**](#-choosing-your-version)
    - [**Stable (``latest``)**](#stable-latest)
    - [**Pinned Release (for example: `0.2.3`)**](#pinned-release-for-example-023)
    - [**Nightly (``nightly``)**](#nightly-nightly)
  - [🛠️ Scriptable CLI — Advanced Guide](#️-scriptable-cli--advanced-guide)
  - [✅ Supported Image Formats](#-supported-image-formats)
    - [🗂️ Supported (not yet verified)](#️-supported-not-yet-verified)
  - [🖥️ Supported Platforms](#️-supported-platforms)
  - [🔒 Privacy \& Security](#-privacy--security)
  - [🤝 Contribute](#-contribute)
  - [❤️ Donate to Support Development](#️-donate-to-support-development)
  - [📓 Release Notes](#-release-notes)
  - [📝 License](#-license)


## 🚀 Quick Start (Web UI in 30 s)

Run **imgcompress** via Docker Compose:

```yaml
services:
  imgcompress:
    image: karimz1/imgcompress:latest
    container_name: imgcompress
    restart: always
    ports:
      - "3001:5000"                  # HOST:CONTAINER — change 3001 if needed
    environment:
      - DISABLE_LOGO=true            # Optional: disable mascot
    command:
      - "web"                        # Launch the Web UI
````
Start:
```bash
docker compose up -d 
```

Then open:

👉 **[http://localhost:3001](http://localhost:3001/)**

## 🧪 Quick Start (docker run)

````bash
docker run -d --name imgcompress -p 3001:5000 karimz1/imgcompress:latest web
````

## 🧼 Minimal Mode: Hide the Mascot

Prefer a cleaner UI?

```` bash
docker run -d --name imgcompress -p 3001:5000 -e DISABLE_LOGO=true karimz1/imgcompress:latest web
````
___

All locally, via Docker — for complete privacy.

## ❓ Why imgcompress?

Ever been frustrated juggling multiple tools just to convert or compress images?
**Me too**. I’m **Karim Zouine**, and I built imgcompress as a simple, unified tool for:

- compression
- conversion
- resizing
- batch processing

All locally, via Docker — for complete privacy.

___

### ✨ Feature Overview

📱 Instant HEIC → Anything: Convert HEIC/HEIF to JPG, PNG, ICO, and more.

📰 PDF ingestion: Upload PDFs and automatically rasterize every page before compressing or converting.

🖼️ Universal convert + resize: Supports HEIC, JPG, JPEG, PNG, PSD, TIFF, EPS, ICO, WebP, GIF, PDF and more.

⚙️ Full control: Set JPEG quality, PNG lossless mode, target width, and more.

🚀 Multi-core batch processing: Automatically uses all CPU cores.

🛠️ Automation-ready CLI: Perfect for scripts, CI/CD, cronjobs.

🔄 Machine-friendly logs: Use --json-output for automation & dashboards.

📦 Runs everywhere: Linux, macOS, Windows (WSL2), ARM64, AMD64.
  
____  

## **🔖 Choosing Your Version**

imgcompress provides **three tags**, depending on your needs:

| **Version**        | **Tag** | **What’s Included**           | **Best For**                     |
| ------------------ | ------- | ----------------------------- | -------------------------------- |
| **Stable**         | ``latest``  | Fully tested release          | Most users — recommended         |
| **Pinned Release** | ``X.Y.Z``   | Exact version, never changes | Reproducible deployments, historic versions |
| **Nightly**        | ``nightly`` | Latest changes & dependency bumps | Testing new features (may break) |


[See all available tags](https://hub.docker.com/r/karimz1/imgcompress/tags)

---

### **Stable (``latest``)**
The safest and most reliable choice.  
Every latest release passes **QA checks by the author (Karim Zouine)** before publication.

### **Pinned Release (for example: `0.2.3`)**
A frozen version that **never updates**.  
Ideal for locked-down deployments or staying on a version you trust.

### **Nightly (``nightly``)**
Includes the newest changes and dependency updates.  
⚠️ May include breaking changes — think of it as a **public beta**.


## 🛠️ Scriptable CLI — Advanced Guide

Need to crunch **thousands or millions** of images? Use the CLI:

**Single File**

``` bash
docker run --rm \
  -v "$(pwd):/container/images" \
  -v "$(pwd)/converted:/container/converted" \
  karimz1/imgcompress:latest \
  /container/images/example.jpg /container/converted --quality 80 --width 1920
```

**Folder**

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

✔ Verified in CI

See function: def verified_image_formats()

Current list (as of 27.11.2025):
````
.heic .heif .png .jpg .jpeg .ico .eps .psd .pdf
````


### 🗂️ Supported (not yet verified)</summary>

imgcompress supports all formats provided by Pillow.
[Full list](https://pillow.readthedocs.io/en/stable/handbook/image-file-formats.html#) but keep in mind not all have been tested in the suite ***yet*** but I'm on it: [Improvement: Test matrix over all Pillow-supported formats #312](https://github.com/karimz1/imgcompress/issues/312)  

Need a format that’s missing or failing?
[Open an issue](https://github.com/karimz1/imgcompress/issues) with a sample file and short description. Happy to expand coverage!

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

- **100 % local processing** — no uploads, no telemetry
- **No telemetry, no tracking** — the container has zero outbound analytics.
- **Open-source and auditable**
- **Run fully offline**
- **Docker isolation** — run with read-only volumes or network-disabled mode for extra peace of mind.

---

## 🤝 Contribute

Want to make imgcompress even better?

1. ⭐ Star the repo to support the project  
2. **Fork → Branch → PR** — developers are welcome to contribute!  
3. Browse `good first issue` or `help wanted` labels for starter tasks  
4. File bugs or feature requests on the [issue tracker](https://github.com/karimz1/imgcompress/issues)

Thank you for supporting open source ❤️

---

## ❤️ Donate to Support Development

If imgcompress saves you time, consider donating.  
Every contribution helps support development, testing, and ongoing maintenance.

[![Donate with PayPal](https://img.shields.io/badge/Donate-PayPal-blue?logo=paypal)](https://paypal.me/KarimZouine972)

*(Completely optional, and always appreciated.)*

---

## 📓 Release Notes

See the full release history in [frontend/public/release-notes.md](https://github.com/karimz1/imgcompress/blob/main/frontend/public/release-notes.md).

## 📝 License

Released under the **MIT License**, see [LICENSE](https://github.com/karimz1/imgcompress/blob/main/LICENSE) for full text.
Third-party libraries remain under their respective licenses.
