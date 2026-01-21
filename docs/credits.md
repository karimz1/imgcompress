---
title: "Credits: Technologies & Assets"
description: "A tribute to the open-source libraries, AI models, and infrastructure that power ImgCompress."
---

# Credits

**ImgCompress** is built upon a foundation of industry-leading open-source technologies. This page serves as a tribute to the tools and communities that enable high-performance, private image optimization.

## Assets & Media

!!! note "Image Attributions"
    **Picture by** [**Evening_tao**](https://www.freepik.com/free-photo/landscape-with-sunset-yixing_1287284.htm) on Freepik — used as a demonstration asset for AI background removal examples.

## Core Processing Engine

| Component | Technology | Role |
| :--- | :--- | :--- |
| **Local AI** | [rembg](https://github.com/danielgatis/rembg) | Powered by the [U<sup>2</sup>-Net](https://github.com/xuebinqin/U-2-Net) model for offline background removal. |
| **Execution** | [onnxruntime](https://github.com/microsoft/onnxruntime) | High-performance inference engine for local AI model execution. |
| **Image Logic** | [Pillow](https://github.com/python-pillow/Pillow) | Standard Python library for image manipulation. |

## Frontend & Interface

| Component | Technology | Role |
| :--- | :--- | :--- |
| **Web Framework** | [Next.js](https://nextjs.org/) | Powers the responsive, high-performance user interface and dashboard. |
| **UI Components** | [shadcn/ui](https://ui.shadcn.com/) | Beautifully designed, accessible components built with Radix UI and Tailwind CSS. |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) | Provides the modern, utility-first styling for a clean and accessible UI. |
| **Icons** | [Lucide](https://lucide.dev/) | Beautifully crafted, consistent icons used throughout the application. |

## Infrastructure & Hosting

| Component | Technology | Role |
| :--- | :--- | :--- |
| **Containerization** | [Docker](https://www.docker.com/) | Ensures "works everywhere" portability and strict process isolation. |
| **Distribution** | [Docker Hub](https://hub.docker.com/r/karimz1/imgcompress) | Reliable hosting for the official [imgcompress](https://hub.docker.com/r/karimz1/imgcompress) container images. |
| **Documentation Hosting** | [GitHub Pages](https://pages.github.com/) | Static site hosting for this documentation portal. |
| **Documentation Site Generator** | [Zensical](https://zensical.org/) | Modern static site generator utilized for building and maintaining the project documentation of imgcompress. |
| **Networking** | [AWS Route 53](https://aws.amazon.com/route53/) | Highly available and scalable Cloud DNS for the project domain. |




## Privacy & Security

!!! success "Privacy Commitment"
    By utilizing these local-first libraries, **ImgCompress** guarantees that no images, metadata, or behavioral data ever leave your local network.

