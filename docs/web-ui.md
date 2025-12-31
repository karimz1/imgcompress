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
| **1** | <a href="images/ui-example/1.jpg" class="glightbox"><img src="images/ui-example/1.jpg" width="240"/></a> | **Upload & Configure**<br/>Drag & drop images or PDFs, choose format, configure options. |
| **2** | <a href="images/ui-example/2.jpg" class="glightbox"><img src="images/ui-example/2.jpg" width="240"/></a> | **Processing**<br/>Images are processed locally with live progress feedback. |
| **3** | <a href="images/ui-example/3.jpg" class="glightbox"><img src="images/ui-example/3.jpg" width="240"/></a> | **Download Results**<br/>Download files individually or as a ZIP archive. |

## 🧠 Local AI Background Removal

Remove backgrounds instantly without sending data to the cloud.

> **Note**: This feature is available when **PNG** is selected as the output format.

1.  Select **PNG** as the target format.
2.  Toggle the **Remove Background** switch.

<p align="center">
  <a href="images/enable_rembg.png" class="glightbox"><img src="images/enable_rembg.png" width="400" alt="Enable remove background toggle"></a>
</p>

### Example Results

| Original Image | Background Removed (Local AI) |
|----------------|-------------------------------|
| <a href="images/image-remover-examples/landscape-with-sunset-yixing.jpg" class="glightbox"><img src="images/image-remover-examples/landscape-with-sunset-yixing.jpg" width="400" alt="Original image"/></a> | <a href="images/image-remover-examples/landscape-with-sunset-yixing.png" class="glightbox"><img src="images/image-remover-examples/landscape-with-sunset-yixing.png" width="400" alt="Background removed image"/></a> |

> 📸 **Source of original image:** [Landscape with sunset in Yixing (Freepik)](https://www.freepik.com/free-photo/landscape-with-sunset-yixing_1287284.htm) — used for demonstration purposes.


## 🎯 Target Specific Filesize

Need your image to be exactly under 500KB or 1MB? ImgCompress can calculate the required quality setting for you.

1.  **Upload** your image.
2.  Select **JPEG** as the target output format.
3.  Click on the **"Set by Quality"** tab.
4.  Adjust the **Max file size** slider or enter the target size (e.g., `500KB`, `2MB`).
5.  Click the **Process** button.

The tool will automatically iterate through compression settings to find the best quality that stays under your requested limit.


<video src="images/target-filesize.webm" controls="controls" style="max-width: 100%; border-radius: 8px;"></video>
