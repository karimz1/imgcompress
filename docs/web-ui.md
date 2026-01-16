---
title: "Web UI: Local Image Optimizer"
description: Optimize images locally with ImgCompress Web UI. Features drag & drop, batch processing, and privacy-first compression. No cloud uploads.
---

# Using the Web UI

!!! important
    Before you begin, ensure you have [installed imgcompress](installation.md). A local installation is required to run the Web UI.

## 🚀 Quick Start Guide

| Step | Screenshot | Description |
|-----:|------------|-------------|
| **1** | [![Upload and configure compression settings](images/ui-example/1.jpg){ .glightbox width="240" }](images/ui-example/1.jpg) | **Upload & Configure**<br/>Drag & drop images or PDFs. Select your target format (AVIF, JPEG, PNG) and adjust your settings. |
| **2** | [![Processing images locally](images/ui-example/2.jpg){ .glightbox width="240" }](images/ui-example/2.jpg) | **Real-time Processing**<br/>Watch the progress as your files are optimized locally. No data ever leaves your computer. |
| **3** | [![Download optimized images](images/ui-example/3.jpg){ .glightbox width="240" }](images/ui-example/3.jpg) | **Download Results**<br/>Save your optimized files individually or all at once in a single ZIP archive. |

The Web UI provides a powerful, privacy-focused way to compress images without the need for cloud-based tools.

## ✨ Key Features

*   **Drag & Drop**: Easy file management for images and PDFs.
*   **Real-time Feedback**: Monitor batch progress with live indicators.
*   **Bulk Processing**: Efficiently handle hundreds of images in one go.
*   **ZIP Export**: Download all processed images in a organized archive.
*   **Privacy First**: All processing happens on your local machine.

## 📁 Choosing the Right Format

Select the format that best fits your project's needs:

| Format | Transparency | Best Use Case |
|:---:|:---:|---|
| **AVIF** | ✅ Yes | **Recommended.** Next-gen compression that keeps quality high while drastically reducing file size. |
| **PNG** | ✅ Yes | Perfect for graphics and logos where pixel-perfect, lossless quality is essential. |
| **JPEG** | ❌ No | Universal standard for photos where transparency is not required. |
| **ICO** | ✅ Yes | Specifically designed for web favicons and desktop application icons. |

## 🧠 Instant Background Removal

!!! note "Requires Transparency Support"
    To use this feature, ensure your output format is set to **AVIF** or **PNG**.

!!! success "Why use AVIF for Background Removal?"
    AVIF combines the transparency support of PNG with **superior compression**. It allows you to remove backgrounds and maintain a tiny footprint without compromising visual quality.

| Step | Screenshot | Description |
|-----:|------------|-------------|
| **1** | [![Enable remove background toggle](images/enable_rembg.png){ .glightbox width="240" }](images/enable_rembg.png) | **Toggle Removal**<br/>Select **AVIF** or **PNG** as the output, then simply flip the **Remove Background** switch. |


| Original Image | Background Removed (Local AI) |
|----------------|-------------------------------|
| ![Original image](images/image-remover-examples/landscape-with-sunset-yixing.jpg){ width="400" } | ![Background removed image](images/image-remover-examples/landscape-with-sunset-yixing.png){ width="400" } |

## 🎯 Target Specific File Sizes

If you need to meet a strict file size limit (e.g., for web uploads), ImgCompress can automatically calculate the optimal quality for you.

!!! tip "AVIF Support"
    The **Max Output Size** slider works for both **JPEG** and **AVIF**. Since AVIF compresses more efficiently, you can often achieve higher visual quality within the same size limit.

| Step | Screenshot | Description |
|-----:|------------|-------------|
| **1** | [![Select JPEG or AVIF format](images/tutorials/export_jgp_steeps_by_max_size/jpeg_imgcompress_steeps_by_max_size_5.jpg){ .glightbox width="240" }](images/tutorials/export_jgp_steeps_by_max_size/jpeg_imgcompress_steeps_by_max_size_5.jpg) | **Select Format**<br/>Choose **JPEG** or **AVIF** from the format dropdown. |
| **2** | [![Upload images for processing](images/tutorials/export_jgp_steeps_by_max_size/jpeg_imgcompress_steeps_by_max_size_4.jpg){ .glightbox width="240" }](images/tutorials/export_jgp_steeps_by_max_size/jpeg_imgcompress_steeps_by_max_size_4.jpg) | **Add Files**<br/>Drag your images into the interface to begin. |
| **3** | [![Configure maximum file size](images/tutorials/export_jgp_steeps_by_max_size/jpeg_imgcompress_steeps_by_max_size_3.jpg){ .glightbox width="240" }](images/tutorials/export_jgp_steeps_by_max_size/jpeg_imgcompress_steeps_by_max_size_3.jpg) | **Set Limit**<br/>Navigate to the **Set by File Size** tab and enter your desired maximum (e.g., 500 KB). |
| **4** | [![Start conversion process](images/tutorials/export_jgp_steeps_by_max_size/jpeg_imgcompress_steeps_by_max_size_2.jpg){ .glightbox width="240" }](images/tutorials/export_jgp_steeps_by_max_size/jpeg_imgcompress_steeps_by_max_size_2.jpg) | **Convert**<br/>Click **Start Converting** to let the AI find the best balance. |
| **5** | [![Download optimized image](images/tutorials/export_jgp_steeps_by_max_size/jpeg_imgcompress_steeps_by_max_size_1.jpg){ .glightbox width="240" }](images/tutorials/export_jgp_steeps_by_max_size/jpeg_imgcompress_steeps_by_max_size_1.jpg) | **Save**<br/>Once complete, download your perfectly-sized image. |

---

## ℹ️ Technical Credits & Background

> **Processing Engine**
>
> All AI-driven tasks are performed locally using [rembg](https://github.com/danielgatis/rembg) and the [U<sup>2</sup>-Net](https://github.com/xuebinqin/U-2-Net) model.  
> Privacy is guaranteed: **No data ever leaves your local network.**
>
> **Core Libraries**
>
> ImgCompress leverages [onnxruntime](https://github.com/microsoft/onnxruntime) for model execution and [Pillow](https://github.com/python-pillow/Pillow) for high-performance image processing.

> 📸 **Image Credits**
> 
> [Landscape with sunset in Yixing (Freepik)](https://www.freepik.com/free-photo/landscape-with-sunset-yixing_1287284.htm) used for demonstration.