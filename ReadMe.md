# imgcompress - Privacy-First Image Optimizer: Compress, Convert & AI Background Removal (Docker)

[![Documentation](https://img.shields.io/badge/docs-karimz1.github.io%2Fimgcompress-blue)](https://karimz1.github.io/imgcompress/)
[![Docker Pulls](https://img.shields.io/docker/pulls/karimz1/imgcompress)](https://hub.docker.com/r/karimz1/imgcompress)
[![Docker Image Size](https://img.shields.io/docker/image-size/karimz1/imgcompress/latest)](https://hub.docker.com/r/karimz1/imgcompress)
[![Docker Image Version (latest semver)](https://img.shields.io/docker/v/karimz1/imgcompress?sort=semver)](https://hub.docker.com/r/karimz1/imgcompress/tags)
[![Release Date](https://img.shields.io/github/release-date/karimz1/imgcompress)](https://github.com/karimz1/imgcompress/releases)
[![License](https://img.shields.io/github/license/karimz1/imgcompress)](https://github.com/karimz1/imgcompress/blob/main/LICENSE)
[![GitHub Sponsor](https://img.shields.io/static/v1?label=Sponsor&message=❤&logo=GitHub&color=ff69b4&style=flat-square)](https://github.com/sponsors/karimz1)

<img src="images/logo_transparent.png" alt="imgcompress logo" width="380"/>

**A self-hosted Docker image compression and conversion tool** with local AI background removal. Process unlimited images offline: no cloud uploads, no subscriptions, no per-image limits.

**Perfect for:** photographers managing large galleries, developers optimizing web assets, privacy-conscious users, and anyone needing a **free TinyPNG/Squoosh alternative** that runs entirely on your hardware.

- **🔒 Privacy-First & 100% Local**: All processing happens on your device.
- **💰 Unlimited & Free**: No subscriptions or API limits.
- **🖼️ Universal Support**: 70+ formats including HEIC, HEIF, WebP, PSD, and PDF.
- **🤖 Local AI**: Background removal all locally.
- **📦 Cross-Platform**: Deploy anywhere with Docker.


---

### 🧠 Local AI Background Removal Result:

| Original Image | Background Removed (Local AI) |
|----------------|-------------------------------|
| <img src="images/image-remover-examples/landscape-with-sunset-yixing.jpg" width="400" alt="Original image"/> | <img src="images/image-remover-examples/landscape-with-sunset-yixing.png" width="400" alt="Background removed image"/> |

Processed fully locally using [rembg](https://github.com/danielgatis/rembg) and [U-2-Net](https://github.com/xuebinqin/U-2-Net) local AI Model. No data ever leaves your network.
Internally it also uses: [onnxruntime](https://github.com/microsoft/onnxruntime) and [Pillow](https://github.com/python-pillow/Pillow) for Re-Serialization to trim Meta. 

> 📸 **Source of original image:** [Landscape with sunset in Yixing (Freepik)](https://www.freepik.com/free-photo/landscape-with-sunset-yixing_1287284.htm) — used for demonstration purposes.

___

### 🖥️ Web UI Preview

For a detailed guide on using the Web Interface in imgcompress, please visit the **[How to Use the Web UI](https://karimz1.github.io/imgcompress/web-ui.html)**.

| Step | Screenshot | Description |
|-----:|------------|-------------|
| **1** | <a href="images/ui-example/1.jpg"><img src="images/ui-example/1.jpg" width="240"/></a> | **Upload & Configure**<br/>Drag & drop images or PDFs, choose format, configure options. |
| **2** | <a href="images/ui-example/2.jpg"><img src="images/ui-example/2.jpg" width="240"/></a> | **Processing**<br/>Images are processed locally with live progress feedback. |
| **3** | <a href="images/ui-example/3.jpg"><img src="images/ui-example/3.jpg" width="240"/></a> | **Download Results**<br/>Download files individually or as a ZIP archive. |



## 🏁 Getting Started

To get up and running with **imgcompress** in seconds, please follow:
**[Installation Guide](https://karimz1.github.io/imgcompress/installation.html)**


## ✨ Key Features & Capabilities

- **📱 HEIC/HEIF Converter**: Instantly turn iPhone photos into high-quality JPG/PNG.
- **🤖 AI Background Removal**: Powered by `rembg`. 100% offline and private.
- **📰 PDF to Image**: Extract every page of a PDF as individual high-res images.
- **🖼️ Universal Conversion**: Support for 70+ formats (HEIC, HEIF, PSD, EPS, TIFF, etc.).
- **⚙️ Pro Controls**: Fine-tune quality, width dimensions, and lossless settings.
- **🚀 Parallel Processing**: Multi-core optimization for lightning-fast batch jobs.
- **🛠️ Automation**: Scriptable CLI with JSON output for CI/CD integration.
- **📦 Cross-Platform**: Runs everywhere (Linux, Mac, Windows, Raspberry Pi).

___

## 💼 Use Cases

- **Photographers**: Batch compress galleries by 70%+ without quality loss.
- **Developers**: Optimize web assets for better PageSpeed.
- **Privacy Users**: Process sensitive documents and family photos offline.
- **Enterprises**: GDPR/HIPAA compliant processing on your hardware, no data share.


## 📓 Release Notes & License

- **Release Notes**: [Read Release Notes](https://karimz1.github.io/imgcompress/release-notes.html)
- The current release and past releases can be found here: https://github.com/karimz1/imgcompress/releases 
- **License**: [GPL-3.0 License](LICENSE)



