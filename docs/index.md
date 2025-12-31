# imgcompress

**Privacy-First Image Optimizer: Compress, Convert & AI Background Removal (Docker)**

[<img src="images/logo_transparent.png" width="490" alt="imgcompress logo">](images/logo_transparent.png)

**A self-hosted Docker image compression and conversion tool** with local AI background removal. Process unlimited images offline: no cloud uploads, no subscriptions, no per-image limits.

[Get Started :octicons-arrow-right-24:](installation.md){ .md-button .md-button--primary }

**Perfect for:** photographers managing large galleries, developers optimizing web assets, privacy-conscious users, and anyone needing a **free TinyPNG/Squoosh alternative** that runs entirely on your hardware.

---

## 🛡️ Why Choose imgcompress?

- **🔒 Privacy-First**: Your images never leave your network. Process sensitive documents, personal photos, and confidential materials with complete data sovereignty.
- **💰 Unlimited Free Usage**: No subscriptions, API keys, or per-image credits. Compress millions of images at zero cost: a true alternative to expensive cloud services.
- **🌐 Universal Format Support**: 70+ formats including HEIC, WebP, PSD, EPS, TIFF, and PDF ingestion. One tool for all your conversion needs.
- **🏠 Self-Hosted Control**: Docker-based deployment for home labs, NAS devices, and enterprise environments. Full control over your image processing pipeline.
- **🤖 Local AI Background Removal**: Remove backgrounds using on-device AI models. No external API calls, no data leakage.

## ✨ Core Features

### 📱 HEIC/HEIF to JPG Converter
Instantly convert Apple HEIC/HEIF images to JPG, PNG or any supported format. No more compatibility issues when sharing iPhone photos.

### 🤖 AI-Powered Background Removal
Remove image backgrounds using local AI models (powered by [rembg](https://github.com/danielgatis/rembg)). Runs 100% offline: no API calls, no external services, complete privacy.

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