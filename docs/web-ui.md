# Web UI Guide

The Web UI is the primary way to interact with imgcompress. It provides a user-friendly interface for uploading, configuring, and processing images.

## ✨ Features

- **Drag & Drop**: Upload images or PDF files directly.
- **Live Progress**: Watch the compression in real-time.
- **Bulk Processing**: Handle hundreds of images at once.
- **ZIP Download**: Get all your optimized images in a single archive.

## 🚀 Usage Steps

| Step | Screenshot | Description |
|-----:|------------|-------------|
| **1** | <img src="../images/ui-example/1.jpg" width="240"/> | **Upload & Configure**<br/>Drag & drop images or PDFs, choose format, configure options. |
| **2** | <img src="../images/ui-example/2.jpg" width="240"/> | **Processing**<br/>Images are processed locally with live progress feedback. |
| **3** | <img src="../images/ui-example/3.jpg" width="240"/> | **Download Results**<br/>Download files individually or as a ZIP archive. |

## 🧠 Local AI Background Removal

Remove backgrounds instantly without sending data to the cloud.

> **Note**: This feature is available when **PNG** is selected as the output format.

1.  Select **PNG** as the target format.
2.  Toggle the **Remove Background** switch.

<p align="center">
  <img src="../images/enable_rembg.png" width="400" alt="Enable remove background toggle">
</p>

### Example Results

| Original Image | Background Removed (Local AI) |
|----------------|-------------------------------|
| <img src="../images/image-remover-examples/landscape-with-sunset-yixing.jpg" width="360" alt="Original image"/> | <img src="../images/image-remover-examples/landscape-with-sunset-yixing.png" width="360" alt="Background removed image"/> |

## 🎯 Target Specific Filesize

Need your image to be exactly under 500KB or 1MB? ImgCompress can calculate the required quality setting for you.

1.  Upload your image.
2.  In the options, look for **Target Size**.
3.  Enter your desired size (e.g. `500KB`, `2MB`).
4.  The tool will auto-adjust compression to meet your target.

<video src="../images/target-filesize.webm" controls="controls" style="max-width: 100%; border-radius: 8px;"></video>
