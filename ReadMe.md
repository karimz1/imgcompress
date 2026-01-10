# imgcompress: Privacy-First Image Optimizer: Compress, Convert and remove backgrounds using local AI (Docker)

<div align="center"> 
<img src="./images/logo_transparent.png" alt="imgcompress_mascot" width="400" height="auto" />

[![Docker Pulls](https://img.shields.io/docker/pulls/karimz1/imgcompress)](https://hub.docker.com/r/karimz1/imgcompress)
[![Docker Image Size](https://img.shields.io/docker/image-size/karimz1/imgcompress/latest)](https://hub.docker.com/r/karimz1/imgcompress)
[![Docker Image Version (latest semver)](https://img.shields.io/docker/v/karimz1/imgcompress?sort=semver)](https://hub.docker.com/r/karimz1/imgcompress/tags)
[![Release Date](https://img.shields.io/github/release-date/karimz1/imgcompress)](https://github.com/karimz1/imgcompress/releases)
[![License](https://img.shields.io/github/license/karimz1/imgcompress)](https://github.com/karimz1/imgcompress/blob/main/LICENSE)
[![Documentation](https://img.shields.io/badge/docs-karimz1.github.io%2Fimgcompress-blue)](https://karimz1.github.io/imgcompress/)
[![GitHub Sponsor](https://img.shields.io/static/v1?label=Sponsor&message=❤&logo=GitHub&color=ff69b4&style=flat-square)](https://github.com/sponsors/karimz1)
[![PayPal Support](https://img.shields.io/badge/Donate-PayPal-00457C?logo=paypal&logoColor=white&style=flat-square)](https://www.paypal.com/paypalme/KarimZouine972)

</div>

**ImgCompress** is a **self-hosted Docker image compression and conversion tool** featuring local AI-powered background removal. Process unlimited images offline with **zero cloud uploads**, no subscriptions, and complete data sovereignty.

**Perfect for:** photographers managing large galleries, developers optimizing web assets for PageSpeed, privacy-conscious users, and anyone needing a **free Online Image Compress alternative** that runs entirely on your hardware.

----

## Why choose ImgCompress?

I created **ImgCompress** as a private alternative to cloud-based converters. Most web tools force a choice between convenience and privacy. ImgCompress is the last **local-first image web tool** you'll need, handling everything from batch resizing to professional AI powered background removal on your own hardware.

### Privacy by Design (GDPR Compliant)

Unlike traditional SaaS services, ImgCompress is engineered with a strict **"Privacy by Default"** architecture. It is the ideal solution for processing sensitive data without external risks.

- **100% Local Processing:** All tasks run strictly on your CPU/GPU.
- **No External API Calls:** Your files are never uploaded, buffered, or sent to third-party servers.

----

## Table of Content
- [imgcompress: Privacy-First Image Optimizer: Compress, Convert and remove backgrounds using local AI (Docker)](#imgcompress-privacy-first-image-optimizer-compress-convert-and-remove-backgrounds-using-local-ai-docker)
  - [Why choose ImgCompress?](#why-choose-imgcompress)
    - [Privacy by Design (GDPR Compliant)](#privacy-by-design-gdpr-compliant)
  - [Table of Content](#table-of-content)
  - [Quick Start](#quick-start)
    - [Docker Run](#docker-run)
    - [Docker Compose](#docker-compose)
  - [Advanced Image Processing Features](#advanced-image-processing-features)
    - [Local AI Background Removal Result:](#local-ai-background-removal-result)
    - [Web UI Preview](#web-ui-preview)
  - [Business \& Personal Use Cases](#business--personal-use-cases)
  - [Frequently Asked Questions (FAQ)](#frequently-asked-questions-faq)
    - [Is imgcompress really free?](#is-imgcompress-really-free)
    - [Do I need an internet connection?](#do-i-need-an-internet-connection)
    - [How does this compare to TinyPNG or Squoosh?](#how-does-this-compare-to-tinypng-or-squoosh)
    - [Hall of Fame](#hall-of-fame)
  - [Release Notes \& License](#release-notes--license)

----

## Quick Start

Get up and running in seconds with Docker.

### Docker Run
```bash
docker run -d --name imgcompress -p 3001:5000 karimz1/imgcompress:latest
```

### Docker Compose
```yaml
services:
  imgcompress:
    image: karimz1/imgcompress:latest
    container_name: imgcompress
    restart: always
    ports:
      - "3001:5000"
```

Open your browser and visit **http://localhost:3001**.

For **advanced use cases**, detailed configuration, and deployment options, please visit:  
**[Full Installation Guide & Documentation](https://karimz1.github.io/imgcompress/installation.html)**

----

## Advanced Image Processing Features

- **HEIC/HEIF to JPG Converter**: Instantly convert iPhone photos into high-quality JPEG or PNG.
- **Local AI Background Removal**: Powered by [rembg](https://github.com/danielgatis/rembg) and [U<sup>2</sup>-Net](https://github.com/xuebinqin/U-2-Net) local AI model. 100% offline and private.
- **PDF to Image Tool**: Extract PDF pages as individual high-resolution images (PNG/JPG/AVIF).
- **Universal Format Support**: Convert between 70+ formats including **WebP, PSD, EPS, and TIFF**.
- **Professional Compression Controls**: Fine-tune quality settings, dimensions, and lossless optimization.
- **Automation Friendly**: Scriptable CLI with JSON output for DevOps and CI/CD pipelines.
- **Cross-Platform**: Runs everywhere (Linux, Mac, Windows, Raspberry Pi) via Docker.

----

### Local AI Background Removal Result:

| Original Image | Background Removed (Local AI) |
|----------------|-------------------------------|
| <img src="images/image-remover-examples/landscape-with-sunset-yixing.jpg" width="400" alt="Original image before background removal"/> | <img src="images/image-remover-examples/landscape-with-sunset-yixing.png" width="400" alt="Image after AI background removal"/> |

> ℹ️ **Info**
>
> Processed fully locally using [rembg](https://github.com/danielgatis/rembg) and  
> [U<sup>2</sup>-Net](https://github.com/xuebinqin/U-2-Net) local AI model.  
> No data ever leaves your network.
>
> Internally it also uses [onnxruntime](https://github.com/microsoft/onnxruntime).  
> Imgcompress also uses [Pillow](https://github.com/python-pillow/Pillow) for re-serialization of images.


> 📸 **Source of Original Image** [Landscape with sunset in Yixing (Freepik)](https://www.freepik.com/free-photo/landscape-with-sunset-yixing_1287284.htm), used for demonstration purposes.
> 

----

### Web UI Preview

For a detailed guide on using the Web Interface in imgcompress, please visit the **[How to Use the Web UI](https://karimz1.github.io/imgcompress/web-ui.html)**.

| Step | Screenshot | Description |
|-----:|------------|-------------|
| **1** | <a href="images/ui-example/1.jpg"><img src="images/ui-example/1.jpg" width="240" alt="Upload and configure image compression settings"/></a> | **Upload & Configure**<br/>Drag & drop images or PDFs, choose format, configure options. |
| **2** | <a href="images/ui-example/2.jpg"><img src="images/ui-example/2.jpg" width="240" alt="Processing images locally"/></a> | **Processing**<br/>Images are processed locally with live progress feedback. |
| **3** | <a href="images/ui-example/3.jpg"><img src="images/ui-example/3.jpg" width="240" alt="Download optimized images"/></a> | **Download Results**<br/>Download files individually or as a ZIP archive. |

----

## Business & Personal Use Cases

- **Web Developers**: Optimize website assets to improve **Google PageSpeed** scores.
- **Photographers**: Batch compress high-res galleries by up to 80% without visible quality loss using [AVIF Format](https://en.wikipedia.org/wiki/AVIF ).
- **Privacy-Conscious Users**: Securely process family photos and sensitive documents without uploading them to cloud servers.
- **Enterprises**: Maintain **GDPR, HIPAA, or SOC2 compliance** by processing all media in-house, ensuring no data share.

----

## Frequently Asked Questions (FAQ)

### Is imgcompress really free?
Yes, it is 100% free and open-source. There are no subscriptions, no paid tiers, and no limits on the number of images you can process. It works on your own hardware so convert as many images as you like.

### Do I need an internet connection?
No. Once you've pulled the Docker image, **imgcompress** works entirely offline. No data is ever sent to the cloud, making it perfect for privacy-sensitive work.

### How does this compare to TinyPNG or Squoosh?
**ImgCompress** is an easy-to-use **all-in-one** toolkit. Unlike online tools that limit you to basic formats, ImgCompress supports **nearly all image formats**: including **HEIC, HEIF, PSD (Photoshop), EPS (Vector), AVIF, and many more**. It brings professional-grade format support and bulk optimization directly to your local hardware all for average users in a simple and nice Web Interface.

----

### Hall of Fame

[![GitHub Sponsor](https://img.shields.io/static/v1?label=Sponsor&message=❤&logo=GitHub&color=ff69b4&style=flat-square)](https://github.com/sponsors/karimz1)
[![PayPal Support](https://img.shields.io/badge/Donate-PayPal-00457C?logo=paypal&logoColor=white&style=flat-square)](https://www.paypal.com/paypalme/KarimZouine972)

I love thanking my supporters! Whether you use GitHub or PayPal, your contribution is recognized here.

> **✨ Special Thanks**
> A very special thank you for the incredible support and encouragement for this project!

| Date | Supporter | Project Impact |
| :--- | :--- | :--- |
| Jan 2026 | *Anonymous* | One-time Donation (PayPal) |
| Oct 2025 | [@Fayyaadh](https://github.com/Fayyaadh) | One-time Donation (PayPal) |


> **Note for PayPal Supporters:** To be added to the table above, please include a note in the PayPal payment field with your GitHub profile link or website.

*Prefer to stay under the radar? You are always welcome to support anonymously.*

**Thank you for being part of the journey!**

----

## Release Notes & License

- **Release Notes**: [Read Release Notes](https://karimz1.github.io/imgcompress/release-notes.html)
- The current release and past releases can be found here: https://github.com/karimz1/imgcompress/releases 
- **License**: [GPL-3.0 License](LICENSE)







