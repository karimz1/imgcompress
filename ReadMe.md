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

- **🔒 Privacy-First**: 100% on-device processing. No cloud, no tracking.
- **💰 Unlimited & Free**: No subscriptions or API limits. Process millions for free.
- **🌐 70+ Formats**: HEIC, WebP, PSD, EPS, PDF, and more.
- **🏠 Self-Hosted**: Full control over your data with Docker.
- **🤖 Local AI**: Background removal without external API calls.



---

### 🧠 New Local AI Background Removal (Preview)

| Original Image | Background Removed (Local AI) |
|----------------|-------------------------------|
| <img src="images/image-remover-examples/landscape-with-sunset-yixing.jpg" width="360" alt="Original image"/> | <img src="images/image-remover-examples/landscape-with-sunset-yixing.png" width="360" alt="Background removed image"/> |


> Processed locally using on-device AI models. No data ever leaves your network.
>
> 👉 **[How to use Local AI Background Removal](https://karimz1.github.io/imgcompress/web-ui.html#local-ai-background-removal)**

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
  - [🛡️ Why Choose imgcompress?](#️-why-choose-imgcompress)
  - [🧠 New Local AI Background Removal](#-new-local-ai-background-removal-preview)
  - [🖥️ Web UI Preview](#️-web-ui-preview)
  - [🏁 Getting Started](#-getting-started)
  - [✨ Core Features](#-core-features)
  - [💼 Use Cases](#-use-cases)
  - [🔖 Choosing Your Version](#-choosing-your-version)
  - [🛠️ Scriptable CLI](#️-scriptable-cli--advanced-guide)
  - [🔒 Privacy & Security](#-privacy--security)
  - [🤝 Contribute](#-contribute)
  - [❤️ Donate](#️-donate)

## 🏁 Getting Started

To get up and running with **imgcompress** in seconds, please follow our:

👉 **[Quick Start & Installation Guide](https://karimz1.github.io/imgcompress/installation.html)**

This guide covers:
- `docker compose` and `docker run` setup.
- Updating to the latest version.
- Choosing the right version tag.


___

## ✨ Core Features

- **📱 HEIC/HEIF Converter**: Instantly turn iPhone photos into high-quality JPG/PNG.
- **🤖 AI Background Removal**: Powered by `rembg`. 100% offline and private.
- **📰 PDF to Image**: Extract every page of a PDF as individual high-res images.
- **🖼️ Universal Conversion**: Support for 70+ formats (HEIC, PSD, EPS, TIFF, etc.).
- **⚙️ Pro Controls**: Fine-tune quality, dimensions, and lossless settings.
- **🚀 Parallel Processing**: Multi-core optimization for lightning-fast batch jobs.
- **🛠️ Automation**: Scriptable CLI with JSON output for CI/CD integration.
- **📦 Cross-Platform**: Runs everywhere (Linux, Mac, Windows, Raspberry Pi).

___

## 💼 Use Cases

- **Photographers**: Batch compress galleries by 70%+ without quality loss.
- **Developers**: Optimize web assets for better PageSpeed & Core Web Vitals.
- **Privacy Users**: Process sensitive documents and family photos offline.
- **Enterprises**: GDPR/HIPAA compliant processing on your own infra.

____  

## 🔖 Choosing Your Version

We offer several versions (tags) of the Docker image depending on your needs (Stable, Nightly, or Pinned).

👉 **[See the Version Selection Guide](https://karimz1.github.io/imgcompress/installation.html#choosing-your-version)**

---


## 🛠️ Scriptable CLI — Advanced Guide

For advanced usage, automation, and CI/CD integration, please refer to the **[CLI & Automation Documentation](https://karimz1.github.io/imgcompress/cli.html)**.

It covers:
- Single file and batch processing.
- AI background removal via CLI.
- JSON output for machine parsing.

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

- **Release Notes**: [Read Release Notes](https://karimz1.github.io/imgcompress/release-notes.html)
- **License**: [GPL-3.0 License](LICENSE)



