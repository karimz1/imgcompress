<div align="center">
  <img src="./images/logo-mini-2.webp" alt="ImgCompress logo" height="80px" />
  <h1>ImgCompress</h1>
  <p><strong>Every image format. Zero cloud.</strong></p>
  <p>Convert 70+ formats, compress in bulk, and remove backgrounds with local AI.<br/>Everything runs inside your container, so your files never leave your server.</p>

  <p>
    <a href="https://imgcompress.karimzouine.com/">
      <img src="https://img.shields.io/badge/Features%20%26%20Capabilities-%E2%86%92-0f172a?style=for-the-badge&logo=gitbook&logoColor=white" alt="Features and Capabilities" />
    </a>
    <a href="https://imgcompress.karimzouine.com/docs/installation">
      <img src="https://img.shields.io/badge/Setup%20Guide-%E2%86%92-1e40af?style=for-the-badge&logo=gnubash&logoColor=white" alt="Setup Guide" />
    </a>
  </p>

  <p>
    <a href="https://hub.docker.com/r/karimz1/imgcompress">
      <img src="https://img.shields.io/docker/pulls/karimz1/imgcompress?style=flat-square&color=0db7ed&label=Docker%20Pulls&logo=docker&logoColor=white" alt="Docker Pulls" />
    </a>
    <a href="https://github.com/karimz1/imgcompress/stargazers">
      <img src="https://img.shields.io/github/stars/karimz1/imgcompress?style=flat-square&color=f4d03f&label=Stars&logo=github&logoColor=black" alt="GitHub Stars" />
    </a>
  </p>

  <p>
    <a href="https://imgcompress.karimzouine.com/">Website</a> ·
    <a href="https://imgcompress.karimzouine.com/docs">Docs</a> ·
    <a href="https://imgcompress.karimzouine.com/docs/installation">Installation Guide</a> ·
    <a href="https://hub.docker.com/r/karimz1/imgcompress">Docker Hub</a> ·
    <a href="https://github.com/karimz1/imgcompress/issues">Issues</a>
  </p>

  <br />

  <img src="./images/web-ui/web-ui-upload-configure.webp" alt="ImgCompress Web UI, upload and configure dashboard" width="100%" />
</div>

---

## What is ImgCompress?

ImgCompress is a **self-hosted image processing server** that runs entirely inside a single Docker container. It handles compression, format conversion, and AI-powered background removal, all locally on your own hardware. No cloud APIs, no third-party uploads, no tracking.

Built for people, homelab enthusiasts, and anyone who values privacy and owns their data.

---

## Features

| Feature | Details |
|---|---|
| **70+ Image Formats** | HEIC, HEIF, PSD, AVIF, EPS, PDF, WebP, TIFF, BMP, GIF, and 60+ more |
| **Local AI Background Removal** | Bundled model runs on your CPU. No API key, no subscription, no upload |
| **Bulk Compression** | Multi-core parallel processing across entire photo libraries |
| **Format Conversion** | HEIC to WebP, PSD to JPG, image batches to paginated PDF, and more |
| **Web UI + CLI** | Browser dashboard for day-to-day use; CLI for scripting pipelines |
| **Single Container** | Every codec and library pre-bundled, zero host dependencies |
| **Air-Gap Ready** | Once pulled, runs fully offline. No internet required, ever |

---

## AI Background Removal: Local & Private

Stop uploading personal or client photos to cloud-based removers. ImgCompress ships a bundled AI model that runs background removal **on your own hardware**. No API call, no subscription, no file ever leaves your server.

| Original | Background Removed |
|:---:|:---:|
| <img src="images/image-remover-examples/landscape-with-sunset-yixing-original.avif" width="380" alt="Original sunset landscape photo"/> | <img src="images/image-remover-examples/landscape-with-sunset-yixing-ai-transparency.avif" width="380" alt="Same photo with background removed by local AI"/> |

---

## Quick Start

Pull the image, open `localhost:3001`, start converting. About 60 seconds total.

```bash
docker run -d \
  --name imgcompress \
  -p 3001:5000 \
  karimz1/imgcompress:latest
```

For Docker Compose, environment variables, and deploying without the mascot, see the **[full installation guide](https://imgcompress.karimzouine.com/docs/installation)**.

---

## Why I Built ImgCompress

I was tired of the "software loop." Every time I needed something simple, I had to install another app:

- **PSD files**: Needed specialized software just to convert them to an image file.
- **HEIC files**: Needed another converter for regular photo files.
- **Image to PDF**: Needed another app just to share a screenshot for work, since a PDF is often better for emails and easy for others to print.
- **AI Backgrounds**: I realized I needed one more app for that too.

I thought to myself: "Why can't one tool just do it all?" Plus, uploading personal photos to random online converters never felt right to me.

### One Toolbox for Everything

So I built a single toolbox that can take over **70 different formats** and fix them all in one place. Whether you need to convert PSD or HEIC files to an image, turn a screenshot into a PDF for a work email, or shrink a massive 4K photo, this tool does it automatically.

The community has now pulled the image **34,000+ times**, which shows the pain is real.

### Why Docker?

I chose Docker because it keeps your computer clean. Instead of you having to install 70 different messy libraries on your system, I packed everything into one **Ready-to-go Box** that you can run anywhere called **imgcompress**. It just works.

---

## Privacy by Design

| | |
|---|---|
| **No cloud processing** | Conversions, compression, and AI inference all run locally. Images never leave your machine. |
| **No telemetry** | No analytics, no crash reporting, no feature flags phoning home. Completely silent on the network after startup. |
| **Offline after pull** | Once the image is pulled, no internet connection is ever needed again. No license checks, no expiry. |
| **Open source** | GPL-3.0. Audit the code, fork it, self-host it forever. |

---

## Documentation

- [Installation & Configuration](https://imgcompress.karimzouine.com/docs/installation): Docker setup, environment variables, reverse proxy examples
- [Developer Guide](https://imgcompress.karimzouine.com/docs/developers): VS Code Dev Containers, architecture overview, local env setup
- [E2E Testing with Playwright](https://imgcompress.karimzouine.com/docs/e2e): How offline stability is verified across all 70+ formats
- [Credits & Libraries](https://imgcompress.karimzouine.com/docs/credits): The open source projects that power ImgCompress
- [Hall of Fame](https://imgcompress.karimzouine.com/docs/hall-of-fame): Sponsors and contributors

---

## Contributing

Contributions are welcome: bug reports, format requests, or pull requests.

> [!TIP]
> **New contributor?** The project ships a **VS Code Dev Container** with all 70+ image libraries and the AI environment pre-configured. Working local setup in under a minute. See the [Developer Guide](https://imgcompress.karimzouine.com/docs/developers).

- Read the **[Contributing Guide](contributing.md)** before opening a PR
- Browse [`good-first-issue`](https://github.com/karimz1/imgcompress/labels/good-first-issue) labels for a starting point
- Every change is verified by a Playwright E2E suite that covers all supported formats

---

## License & Author

**Author**: [Karim Zouine](https://www.karimzouine.com)  
**License**: [GPL-3.0](LICENSE)  
**Docker Image**: [hub.docker.com/r/karimz1/imgcompress](https://hub.docker.com/r/karimz1/imgcompress)

If ImgCompress saves you time, a GitHub star helps others discover it.
