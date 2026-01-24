# ImgCompress: The Private, Self-Hosted Image Converter
## One Simple Toolbox for All Your Photos

<div align="center"> 

<img src="./docs/images/imgcompress-og-image.webp" alt="ImgCompress branding banner showing logo and key feature summary" width="100%" height="auto" />

[![Docker Pulls](https://img.shields.io/docker/pulls/karimz1/imgcompress?style=flat-square&color=indigo&label=Docker%20Pulls)](https://hub.docker.com/r/karimz1/imgcompress)
[![License](https://img.shields.io/github/license/karimz1/imgcompress)](https://github.com/karimz1/imgcompress/blob/main/LICENSE)
[![Documentation](https://img.shields.io/badge/docs-imgcompress.karimzouine.com-blue)](https://imgcompress.karimzouine.com/)

</div>

你好，我是 **imgcompress**！

I started developing this tool because I was tired of the "software loop." Every time I wanted to do something simple, I realized I needed a new app:

- **PSD files**: Needed specialized software just to convert them to an image file.
- **HEIC files**: Needed another converter for regular photo files.
- **Image to PDF**: Needed another app just to share a screenshot for work, since a PDF is often better for emails and easy for others to print.
- **AI Backgrounds**: I realized I needed one more app for that too.

I thought to myself: "Why can't one tool just do it all?" Plus, uploading personal photos to random online converters never felt right to me.

### One Toolbox for Everything
So I built a single toolbox that can take over **70 different formats** and fix them all in one place. Whether you need to convert PSD or HEIC files to an image, turn a screenshot into a PDF for a work email, or shrink a massive 4K photo, this tool does it automatically. 

I am so thankful that the community is using it! Seeing over [![Docker Pulls](https://img.shields.io/docker/pulls/karimz1/imgcompress?style=flat-square&color=indigo&label=Docker%20Pulls)](https://hub.docker.com/r/karimz1/imgcompress) pulls makes me so happy. It helped me realize that I was not the only one with that problem!

### Why Docker?
I chose Docker because it keeps your computer clean. Instead of you having to install 70 different messy libraries on your system, I packed everything into one **Ready-to-go Box** that you can run anywhere. It just works. It also makes shipping new features much easier. All you need is a few simple lines and you get the newest version instantly.

<div align="center">

### Instant, Powerful Web UI
*Full control at your fingertips. No setup, no tracking, 100% offline.*
<img src="./docs/images/web-ui-workflow/web-ui-upload-configure.webp" alt="ImgCompress Web UI Dashboard showing image upload and format configuration interface" width="100%" height="auto" />

</div>

## Key Advantages

*   **Privacy First**: Designed for private networks. No images or data ever leave your server / nas / homelab.
*   **Local AI**: Use AI to remove backgrounds without any cloud brain. Everything stays on your computer.
*   **Universal Format Support**: Convert between 70+ formats including **AVIF, WebP, HEIC, PSD, and PDF**.
*   **Professional PDF Generation**: Effortlessly convert images into native, structured PDFs with intelligent A4 pagination, "Smart Splitting" for long captures, and customizable layout controls.
*   **High Performance**: Multi-core batch processing for lightning-fast optimization.

## AI Demo: Professional Background Removal

Clear the background from any photo without using any cloud tools.

| Original Image | Background Removed (Local AI) |
| :--- | :--- |
| <img src="docs/images/image-remover-examples/landscape-with-sunset-yixing-original.avif" width="400" alt="Original Sunset Landscape"/> | <img src="docs/images/image-remover-examples/landscape-with-sunset-yixing-ai-transparency.avif" width="400" alt="Landscape with Background Removed"/> |

## Quick Start

1.  **Deploy via Docker**:
    ```bash
    docker run -d -p 3001:5000 --name imgcompress karimz1/imgcompress:latest
    ```
2.  **Access the Dashboard**: Open `http://localhost:3001` in your browser.
3.  **Read the Guides**: [Full Installation & Configuration &rarr;](https://imgcompress.karimzouine.com/installation/)

## Support & Community

*   **[Sponsorship & Honor Roll &rarr;](https://imgcompress.karimzouine.com/hall-of-fame/)**: Support independent development.
*   **[Contributing &rarr;](https://imgcompress.karimzouine.com/contributing/)**: Join the open-source community.

**License**: [GPL-3.0](LICENSE) | **Author**: [Karim Zouine](https://www.karimzouine.com) | **Image & Library Credits**: [View All Credits](https://imgcompress.karimzouine.com/credits/)
