# ImgCompress

<div align="center">
  <p><strong>ImgCompress</strong></p>
  <p><strong>70+ image formats supported.</strong></p>
  <p>Offline image compression, conversion, and AI background removal for Docker homelabs.</p>
  
  <p>
    <a href="https://imgcompress.karimzouine.com/installation/" style="display:inline-flex;align-items:center;gap:8px;padding:12px 22px;border-radius:999px;background:#0f172a;color:#ffffff;font-weight:800;text-decoration:none;border:1px solid #0f172a;">Start Setup Guide →</a>
    <span style="display:inline-flex;align-items:center;gap:8px;margin-left:12px;color:#0f172a;font-weight:700;">
      <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/docker/docker-original.svg" alt="Docker" width="22" height="22" />
      <span><img src="https://img.shields.io/docker/pulls/karimz1/imgcompress?style=flat-square&color=0db7ed&label=pulls" alt="Docker pulls badge"/></span>
    </span>
  </p>

  <p>
    <img src="./docs/images/web-ui-workflow/web-ui-upload-configure.webp" alt="ImgCompress Web UI" width="100%" height="auto" />
  </p>

  <p>
    <a href="https://imgcompress.karimzouine.com/" aria-label="ImgCompress documentation">Documentation</a> ·
    <a href="https://hub.docker.com/r/karimz1/imgcompress" aria-label="Docker Hub">Docker Hub</a> ·
    <a href="https://github.com/karimz1/imgcompress/blob/main/LICENSE" aria-label="License">GPL-3.0</a>
  </p>
</div>

## AI Background Removal (Offline and Private)

Clear the background from any photo with a **local AI background remover**, no cloud, no tracking. Everything runs 100% on your hardware for privacy and speed.

| Original Image | Background Removed (Local AI) |
| :--- | :--- |
| <img src="docs/images/image-remover-examples/landscape-with-sunset-yixing-original.avif" width="400" alt="Original Sunset Landscape"/> | <img src="docs/images/image-remover-examples/landscape-with-sunset-yixing-ai-transparency.avif" width="400" alt="Landscape with Background Removed"/> |

## Why I built ImgCompress

I was tired of the "software loop." Every time I needed something simple, I had to install another app:

- **PSD files**: Needed specialized software just to convert them to an image file.
- **HEIC files**: Needed another converter for regular photo files.
- **Image to PDF**: Needed another app just to share a screenshot for work, since a PDF is often better for emails and easy for others to print.
- **AI Backgrounds**: I realized I needed one more app for that too.

I thought to myself: "Why can't one tool just do it all?" Plus, uploading personal photos to random online converters never felt right to me.

### One Toolbox for Everything
So I built a single toolbox that can take over **70 different formats** and fix them all in one place. Whether you need to convert PSD or HEIC files to an image, turn a screenshot into a PDF for a work email, or shrink a massive 4K photo, this tool does it automatically. 

The community has now pulled the image **tens of thousands of times**, which shows the pain is real.

### Why Docker?
I chose Docker because it keeps your computer clean. Instead of you having to install 70 different messy libraries on your system, I packed everything into one **Ready-to-go Box** that you can run anywhere called **imgcompress**. It just works.


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
