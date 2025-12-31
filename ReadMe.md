# imgcompress - Privacy-First Image Optimizer: Compress, Convert & AI Background Removal (Docker)

[![Documentation](https://img.shields.io/badge/docs-karimz1.github.io%2Fimgcompress-blue)](https://karimz1.github.io/imgcompress/)
[![Docker Pulls](https://img.shields.io/docker/pulls/karimz1/imgcompress)](https://hub.docker.com/r/karimz1/imgcompress)
[![Docker Image Size](https://img.shields.io/docker/image-size/karimz1/imgcompress/latest)](https://hub.docker.com/r/karimz1/imgcompress)
[![Docker Image Version (latest semver)](https://img.shields.io/docker/v/karimz1/imgcompress?sort=semver)](https://hub.docker.com/r/karimz1/imgcompress/tags)
[![Release Date](https://img.shields.io/github/release-date/karimz1/imgcompress)](https://github.com/karimz1/imgcompress/releases)
[![License](https://img.shields.io/github/license/karimz1/imgcompress)](https://github.com/karimz1/imgcompress/blob/main/LICENSE)
[![Donate with PayPal](https://img.shields.io/badge/Donate-PayPal-blue?logo=paypal)](https://paypal.me/KarimZouine972)

<img src="images/logo_transparent.png" alt="imgcompress logo" width="490"/>

**A self-hosted Docker image compression and conversion tool** with local AI background removal. Process unlimited images offline: no cloud uploads, no subscriptions, no per-image limits.

**Perfect for:** photographers managing large galleries, developers optimizing web assets, privacy-conscious users, and anyone needing a **free TinyPNG/Squoosh alternative** that runs entirely on your hardware.

### 🛡️ Why Choose imgcompress?

- **🔒 Privacy-First**: Your images never leave your network. Process sensitive documents, personal photos, and confidential materials with complete data sovereignty.
- **💰 Unlimited Free Usage**: No subscriptions, API keys, or per-image credits. Compress millions of images at zero cost: a true alternative to expensive cloud services.
- **🌐 Universal Format Support**: 70+ formats including HEIC, WebP, PSD, EPS, TIFF, and PDF ingestion. One tool for all your conversion needs.
- **🏠 Self-Hosted Control**: Docker-based deployment for home labs, NAS devices, and enterprise environments. Full control over your image processing pipeline.
- **🤖 Local AI Background Removal**: Remove backgrounds using on-device AI models. No external API calls, no data leakage.



---

### 🧠 New Local AI Background Removal (Preview)

| Original Image | Background Removed (Local AI) |
|----------------|-------------------------------|
| <img src="images/image-remover-examples/landscape-with-sunset-yixing.jpg" width="360" alt="Original image"/> | <img src="images/image-remover-examples/landscape-with-sunset-yixing.png" width="360" alt="Background removed image"/> |


> Processed locally using an embedded AI model no external services involved. Now integrated in imgcompress.

<p align="center">
  👉 <strong>To use it, enable the toggle in the UI:</strong><br>
  <img src="images/enable_rembg.png" width="400" alt="Enable remove background toggle"><br>
  <em>(Note: This option only appears when <strong>PNG</strong> is selected as the output format)</em>
</p>

📸 **Source of original image:**  
[Landscape with sunset in Yixing (Freepik)](https://www.freepik.com/free-photo/landscape-with-sunset-yixing_1287284.htm) — used for demonstration purposes.

🧠 **AI background removal powered internally by** [rembg](https://github.com/danielgatis/rembg)  
(rembg is used locally inside the container of imgcompress. No data is sent externally for privacy.)

___

### 🖥️ Web UI Preview

For a detailed guide on using the Web Interface, features, and workflows, please visit the **[Web UI Documentation](https://karimz1.github.io/imgcompress/web-ui.html)**.

| Step | Screenshot | Description |
|-----:|------------|-------------|
| **1** | <a href="images/ui-example/1.jpg"><img src="images/ui-example/1.jpg" width="240"/></a> | **Upload & Configure**<br/>Drag & drop images or PDFs, choose format, configure options. |
| **2** | <a href="images/ui-example/2.jpg"><img src="images/ui-example/2.jpg" width="240"/></a> | **Processing**<br/>Images are processed locally with live progress feedback. |
| **3** | <a href="images/ui-example/3.jpg"><img src="images/ui-example/3.jpg" width="240"/></a> | **Download Results**<br/>Download files individually or as a ZIP archive. |

___
  

- [imgcompress — Privacy-First Image Optimizer: Compress, Convert & AI Background Removal](#imgcompress---privacy-first-image-optimizer-compress-convert--ai-background-removal-docker)
  - [�️ Why Choose imgcompress?](#️-why-choose-imgcompress)
  - [🧠 New Local AI Background Removal](#-new-local-ai-background-removal-preview)
  - [🖥️ Web UI Preview](#️-web-ui-preview)
  - [� Quick Start](#-quick-start)
    - [Using `docker compose`](#using-docker-compose)
    - [Using `docker run`](#using-docker-run)
  - [🔄 Updating imgcompress](#-updating-imgcompress-get-the-latest-stable-release)
  - [✨ Core Features](#-core-features)
  - [💼 Common Use Cases](#-common-use-cases)
  - [🔖 Choosing Your Version](#-choosing-your-version)
  - [🛠️ Scriptable CLI](#️-scriptable-cli--advanced-guide)
  - [✅ Supported Image Formats](#-supported-image-formats)
  - [🖥️ Supported Platforms](#️-supported-platforms)
  - [🔒 Privacy & Security](#-privacy--security)
  - [🤝 Contribute](#-contribute)
  - [❤️ Donate](#️-donate)


## 🚀 Quick Start

### Using `docker compose`

```yaml
services:
  imgcompress:
    image: karimz1/imgcompress:latest
    container_name: imgcompress
    restart: always
    ports:
      - "3001:5000"                     # HOST:CONTAINER — change 3001 if needed
    environment:
      - DISABLE_LOGO=true               # Optional: disable mascot
      - DISABLE_STORAGE_MANAGEMENT=true # Optional: disable the Storage Management
````
Start:
```bash
docker compose up -d 
```

Then open:

👉 **[http://localhost:3001](http://localhost:3001/)**


### Using `docker run`

````bash
docker run -d --name imgcompress -p 3001:5000 karimz1/imgcompress:latest
````

#### 🧼 Minimal Mode: Hide the Mascot

Prefer a cleaner UI?

```` bash
docker run -d --name imgcompress -p 3001:5000 -e DISABLE_LOGO=true karimz1/imgcompress:latest
````
___

## 🔄 Updating imgcompress (get the latest stable release)

### Using `docker compose`
```bash
docker compose pull
docker compose up -d --force-recreate
```

### Using `docker run`

```bash
docker pull karimz1/imgcompress:latest
docker stop imgcompress
docker rm imgcompress
docker run -d --name imgcompress -p 3001:5000 karimz1/imgcompress:latest
```
> **Open imgcompress:** **[http://localhost:3001](http://localhost:3001/)**


⬅️ Back to: [**Quick Start (`docker compose`)**](#using-docker-compose)
 or [**Quick Start (`docker run`)**](#using-docker-run)



___

## ❓ Why imgcompress?

Tired of **uploading sensitive images to cloud services**? Frustrated by **per-image pricing** on tools like TinyPNG? Need to **batch-process thousands of HEIC files** without expensive software?

**imgcompress solves this.** I'm **Karim Zouine**, and I built this as a **zero-cost, privacy-first alternative** to cloud-based image tools.

**What makes it different:**
- **No cloud uploads**: Your images stay on your hardware. Critical for NDAs, medical imagery, or personal photos.
- **No usage limits**: Process 10 images or 10 million. No subscriptions, no API quotas.
- **All-in-one**: Compression, conversion (HEIC→JPG, PNG→WebP, PDF→images), resizing, and AI background removal in a single tool.
- **Production-ready**: Multi-core processing, CLI automation, Docker isolation, and cross-platform support (ARM64/AMD64).

___

## ✨ Core Features

### 📱 HEIC/HEIF to JPG Converter
Instantly convert Apple HEIC/HEIF images to JPG, PNG or any supported format. No more compatibility issues when sharing iPhone photos.

### 🤖 AI-Powered Background Removal
Remove image backgrounds using local AI models (powered by rembg). Runs 100% offline: no API calls, no external services, complete privacy.

### 📰 PDF to Image Converter
Upload multi-page PDFs and automatically extract/rasterize every page as individual images. Perfect for document processing workflows.

### 🖼️ Universal Image Conversion
Supports 70+ formats: HEIC, JPG, PNG, PSD, TIFF, EPS, ICO, WebP, GIF, BMP, and more. One tool for all conversion needs.

### ⚙️ Granular Quality Control
Set JPEG quality (1-100), enable PNG lossless mode, specify target dimensions, and fine-tune output settings.

### 🚀 Multi-Core Batch Processing
Automatically utilizes all CPU cores for parallel processing. Compress thousands of images in minutes, not hours.

### 🛠️ CLI Automation for CI/CD
Scriptable command-line interface with `--json-output` for logs. Integrate into build pipelines, cronjobs, or automated workflows.

### 📦 Cross-Platform Docker Image
Runs on Linux (x86-64, ARM64), macOS (Intel/Apple Silicon), Windows (WSL2), Raspberry Pi 4+, and AWS Graviton.

___

## 💼 Common Use Cases

### For Photographers
- **Batch compress wedding photos**: Reduce file sizes by 70% without visible quality loss before client delivery.
- **Convert RAW to Web formats**: Process thousands of images for portfolio websites or online galleries.
- **HEIC compatibility**: Convert iPhone photos to JPG for universal client compatibility.

### For Developers
- **Optimize web assets**: Compress images for faster page loads and better Core Web Vitals scores.
- **CI/CD integration**: Automate image optimization in build pipelines using the CLI.
- **Thumbnail generation**: Batch-resize product images for e-commerce platforms.

### For Privacy-Conscious Users
- **Process sensitive documents**: Compress legal, medical, or confidential images without cloud uploads.
- **Family photo management**: Organize and optimize personal galleries on your NAS or home server.
- **Offline workflows**: Run completely air-gapped for maximum data security.

### For Enterprises
- **GDPR/HIPAA compliance**: Keep image processing on-premises to meet regulatory requirements.
- **Cost optimization**: Eliminate per-image fees from cloud services. Process unlimited images on your own infrastructure.
- **Custom workflows**: Deploy on internal infrastructure with full control over processing logic.

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

### **Pinned Release (for example: `0.2.8`)**
A frozen version that **never updates**.  
Ideal for locked-down deployments or staying on a version you trust.

### **Nightly (``nightly``)**
Includes the newest changes and dependency updates.  
⚠️ May include breaking changes — think of it as a **public beta**.


## 🛠️ Scriptable CLI — Advanced Guide

For advanced usage, automation, and CI/CD integration, please refer to the **[CLI & Automation Documentation](https://karimz1.github.io/imgcompress/cli.html)**.

It covers:
- Single file and batch processing.
- AI background removal via CLI.
- JSON output for machine parsing.

___

## ✅ Supported Image Formats

✔ Verified in CI: `.heic .heif .png .jpg .jpeg .ico .eps .psd .pdf`

For the complete list of 70+ supported formats, see the **[Full Documentation](https://karimz1.github.io/imgcompress/index.html#supported-formats)**.

___

## 🖥️ Supported Platforms

Running on Linux (amd64/arm64), Windows (WSL2), macOS, or Raspberry Pi?

👉 **[Check the Supported Platforms Guide](https://karimz1.github.io/imgcompress/installation.html#supported-platforms)**

___

## 🔒 Privacy & Security

**Privacy First.** 100% local processing, no telemetry, no tracking.

👉 **[Read the Full Privacy Policy](https://karimz1.github.io/imgcompress/privacy.html)** (Includes Enterprise Air-Gapped Setup)

---

## 🤝 Contribute

We welcome contributions! Please see our **[Contribution Guide](https://karimz1.github.io/imgcompress/contributing.html)**.

---

## ❤️ Donate

If you find this tool useful, consider supporting its development.

[![Donate with PayPal](https://img.shields.io/badge/Donate-PayPal-blue?logo=paypal)](https://paypal.me/KarimZouine972)

---

## 📓 Release Notes & License

- **Release Notes**: [Read Release Notes](frontend/public/release-notes.md)
- **License**: [GPL-3.0 License](LICENSE)



