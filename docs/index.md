# imgcompress

**Privacy-First Image Optimizer: Compress, Convert & AI Background Removal (Docker)**

[![Docker Pulls](https://img.shields.io/docker/pulls/karimz1/imgcompress)](https://hub.docker.com/r/karimz1/imgcompress)
[![Docker Image Size](https://img.shields.io/docker/image-size/karimz1/imgcompress/latest)](https://hub.docker.com/r/karimz1/imgcompress)

[<img src="images/logo_transparent.png" width="240" alt="imgcompress logo">](images/logo_transparent.png)

*Created by **[Karim Zouine](https://github.com/karimz1)** with ❤️*

**A self-hosted Docker image compression and conversion tool** with local AI background removal. Process unlimited images offline: no cloud uploads, no subscriptions, no per-image limits.

## ❓ Why imgcompress?

I created **imgcompress** because I was tired of the trade-offs required by modern image tools. Most web-based converters force you to choose between convenience and privacy, often requiring you to upload sensitive data to third-party servers.

I built this to be the last image utility you'll need a unified, local-first powerhouse that handles everything from batch resizing to AI-driven background removal.

### 🛡️ Privacy as a Requirement

Unlike traditional web services, imgcompress is engineered with a strict "Privacy by Default" architecture. I believe privacy isn't just a feature; it’s a technical requirement.

- **100% Local:** All processing happens strictly on your hardware.

- **Zero Data Leaks:** Your files are never uploaded, buffered, or transmitted to external servers.

- **Air-Gapped Ready:** Works perfectly without an internet connection.

[Get Started :octicons-arrow-right-24:](installation.md){ .md-button .md-button--primary }

---

## ✨ Key Features & Capabilities

- **📱 HEIC/HEIF Converter**: Instantly turn iPhone photos into high-quality JPG/PNG.
- **🤖 AI Background Removal**: Powered by `rembg`. 100% offline and private.
- **📰 PDF to Image**: Extract every page of a PDF as individual high-res images.
- **🖼️ Universal Conversion**: Support for 70+ formats (HEIC, HEIF, PSD, EPS, TIFF, etc.).
- **⚙️ Pro Controls**: Fine-tune quality, width dimensions, and lossless settings.
- **🚀 Parallel Processing**: Multi-core optimization for lightning-fast batch jobs.
- **🛠️ Automation**: Scriptable CLI with JSON output for CI/CD integration.
- **📦 Cross-Platform**: Runs everywhere (Linux, Mac, Windows, Raspberry Pi).

## 💼 Use Cases

- **Photographers**: Batch compress galleries by 70%+ without quality loss.
- **Developers**: Optimize web assets for better PageSpeed.
- **Privacy Users**: Process sensitive documents and family photos offline.
- **Enterprises**: GDPR/HIPAA compliant processing on your hardware - no data share.
