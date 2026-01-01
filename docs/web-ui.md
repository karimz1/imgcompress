# How to Use the Web UI

!!! important
    Before you begin, make sure you have [installed imgcompress](installation.md). This setup is required to access the Web UI.

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

Remove backgrounds instantly using the local AI model in imgcompress (powered using [rembg](https://github.com/danielgatis/rembg)).

!!! note
    This feature is available when **PNG** is selected as the output format.

| Step | Screenshot | Description |
|-----:|------------|-------------|
| **1** | <a href="images/enable_rembg.png" class="glightbox"><img src="images/enable_rembg.png" width="240" alt="Enable remove background toggle"></a> | **Toggle Background Removal**<br/>Select **PNG** as the target format and toggle the **Remove Background** switch. |


| Original Image | Background Removed (Local AI) |
|----------------|-------------------------------|
| <img src="images/image-remover-examples/landscape-with-sunset-yixing.jpg" width="400" alt="Original image"/> | <img src="images/image-remover-examples/landscape-with-sunset-yixing.png" width="400" alt="Background removed image"/> |

> Processed locally using AI models. No data ever leaves your network.
>
> 📸 **Source of original image:** [Landscape with sunset in Yixing (Freepik)](https://www.freepik.com/free-photo/landscape-with-sunset-yixing_1287284.htm) used for demonstration purposes.


## 🎯 Export Image by Target Specific Max Filesize

Need your image to be exactly under 500KB or 1MB? ImgCompress can calculate the required quality setting for you.

| Step | Screenshot | Description |
|-----:|------------|-------------|
| **1** | <a href="images/tutorials/export_jgp_steeps_by_max_size/jpeg_imgcompress_steeps_by_max_size_5.jpg" class="glightbox"><img src="images/tutorials/export_jgp_steeps_by_max_size/jpeg_imgcompress_steeps_by_max_size_5.jpg" width="240"/></a> | **Select Format**<br/>Choose **JPEG** as the output format from the dropdown menu. |
| **2** | <a href="images/tutorials/export_jgp_steeps_by_max_size/jpeg_imgcompress_steeps_by_max_size_4.jpg" class="glightbox"><img src="images/tutorials/export_jgp_steeps_by_max_size/jpeg_imgcompress_steeps_by_max_size_4.jpg" width="240"/></a> | **Upload Images**<br/>Drag and drop your images into the processing area or click to select them. |
| **3** | <a href="images/tutorials/export_jgp_steeps_by_max_size/jpeg_imgcompress_steeps_by_max_size_3.jpg" class="glightbox"><img src="images/tutorials/export_jgp_steeps_by_max_size/jpeg_imgcompress_steeps_by_max_size_3.jpg" width="240"/></a> | **Configure Size**<br/>Switch to the **Set by File Size** tab and enter your desired maximum size (e.g., 0.5 MB). |
| **4** | <a href="images/tutorials/export_jgp_steeps_by_max_size/jpeg_imgcompress_steeps_by_max_size_2.jpg" class="glightbox"><img src="images/tutorials/export_jgp_steeps_by_max_size/jpeg_imgcompress_steeps_by_max_size_2.jpg" width="240"/></a> | **Process**<br/>Click the **Start Converting** button to begin the compression process. |
| **5** | <a href="images/tutorials/export_jgp_steeps_by_max_size/jpeg_imgcompress_steeps_by_max_size_1.jpg" class="glightbox"><img src="images/tutorials/export_jgp_steeps_by_max_size/jpeg_imgcompress_steeps_by_max_size_1.jpg" width="240"/></a> | **Download**<br/>Once finished, click the download link to save your optimized image. |
