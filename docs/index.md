---
icon: lucide/home
title: "ImgCompress: Simple & Private Image Optimizer"
description: "Shrink images, remove backgrounds with AI, and convert files like HEIC/PSD locally. 100% private."
tags:
  - Introduction
  - Overview
---

# ImgCompress: The Simple Docker Image for All Your Photos

[<img src="images/imgcompress-og-image.webp" width="1200" height="630" fetchpriority="high" alt="ImgCompress: The private and easy way to shrink images and remove backgrounds offline">](images/imgcompress-og-image.webp){ aria-label="View ImgCompress branding banner" }

I started developing **imgcompress** because I was tired of the "software loop." Every time I wanted to do something simple, I realized I needed a new app:

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

## Key Advantages

- **Privacy First**: Designed for private networks. No images or data ever leave your server / nas / homelab.
- **Local AI**: Use AI to remove backgrounds without any cloud brain. Everything stays on your computer.
- **Universal Format Support**: Convert between 70+ formats including **AVIF, WebP, HEIC, PSD, and PDF**.
- **Professional PDF Generation**: Effortlessly convert images into native, structured PDFs with intelligent A4 pagination, "Smart Splitting" for long captures, and customizable layout controls.
- **High Performance**: Multi-core batch processing for lightning-fast optimization.

## Quick Look
Experience easy image processing on your own hardware. No account required and no tracking.

[<img src="images/web-ui-workflow/web-ui-upload-configure.webp" width="1200" height="680" alt="Drag and drop your photos to make them smaller.">](images/web-ui-workflow/web-ui-upload-configure.webp){ aria-label="View larger screenshot of Web UI" }

## How to use it

1. **Drag & Drop** your photos into the app.
2. **Choose a setting**: Shrink, convert, or remove backgrounds.
3. **Download** your new images.

## Want to try it?
Just follow the simple setup guide to get your own image toolbox running in no time.

[Start the Setup Guide :octicons-arrow-right-24:](installation.md){ .md-button .md-button--primary }

---

## AI Background Removal
Clear the background from any photo without using any cloud tools.

| Before | After |
| :--- | :--- |
| ![A pretty sunset](images/image-remover-examples/landscape-with-sunset-yixing-original.avif){ width="400" height="266" loading="lazy" } | ![The sunset with no background](images/image-remover-examples/landscape-with-sunset-yixing-ai-transparency.avif){ width="400" height="266" loading="lazy" } |
