 ![imgcompress Mascot Logo](https://raw.githubusercontent.com/karimz1/imgcompress/refs/heads/main/images/imgcompress_logo.jpg)
 
# imgcompress: The Ultimate Docker Image Compression Tool

[![Docker Pulls](https://img.shields.io/docker/pulls/karimz1/imgcompress)](https://hub.docker.com/r/karimz1/imgcompress)  
[![Docker Image Version](https://img.shields.io/docker/v/karimz1/imgcompress?sort=semver)](https://hub.docker.com/r/karimz1/imgcompress)  
[![Docker Image Size](https://img.shields.io/docker/image-size/karimz1/imgcompress/latest)](https://hub.docker.com/r/karimz1/imgcompress)  
[![Build and Test Docker Image](https://github.com/karimz1/imgcompress/actions/workflows/deploy.yml/badge.svg?branch=main)](https://github.com/karimz1/imgcompress/actions/workflows/deploy.yml)

---

## 🎬 See It In Action

Experience the power of imgcompress with our modern Web UI. Check out the quick demo below:

![Web UI in Action](https://raw.githubusercontent.com/karimz1/imgcompress/refs/heads/main/images/ezgif-12f4af43b7a59.gif)

---

## ❓Why imgcompress?

Ever been frustrated by juggling multiple programs just to convert or compress images? **I did too.**  
I'm **Karim Zouine** and I built **imgcompress** as a one-stop solution to effortlessly compress, convert, and resize your images—all inside a Docker container. No more complicated installations or worrying about privacy with online converters. Everything runs locally, secure and consistent across any system.

---

## Feature Overview

- **📱 Convert iPhone HEIC Photos to JPEG:**  
  Easily convert your iPhone's HEIC images to JPEG for smaller file sizes and universal compatibility.

- **🖼️ Universal Format Conversion & Resizing:**  
  Transform almost any photo format to JPEG and resize images effortlessly—ideal for creating thumbnails, web-optimized images, or custom sizes.

- **⚙️ Customizable Output Quality:**  
  Fine-tune the compression settings to balance image clarity and file size, ensuring your photos look great while saving space.

- **🗂️ Batch & Single File Processing:**  
  Whether you're processing one photo or an entire folder, imgcompress handles it all with ease.

- **🔄 Seamless Automation & Flexible Logging:**  
  Integrate imgcompress into your CI/CD pipelines and choose between human-readable logs or structured JSON for a smoother workflow.


---

## 🚀 Get Started in Seconds

### Step 1: Install via Docker

Pull the latest image:

```bash
docker pull karimz1/imgcompress:latest
```

### Step 2: Choose Your Workflow

#### A. Try the NEW Web User Interface (Highly Recommended!)

1. **Launch the Web UI:**

   ```  bash
   docker run --rm -p 5000:5000 karimz1/imgcompress:latest web
   ```

2. **Access the Web UI:**

   Open your browser and go to:
   **http://localhost:5000**

3. **Explore the Features:**

   - **Drag & Drop Uploads:** Simply drag your images into the browser.
   - **Batch Processing:** Compress multiple images simultaneously.
   - **Real-Time Progress:** Watch your images optimize live.
   - **Download Instantly:** Retrieve your optimized images directly from the browser.
   - **Customizable Settings:** Tweak quality and resize options effortlessly.

------

#### B. Use the Command-Line Interface (CLI) for Advanced Workflows

**Single File Processing:**

``` bash
docker run --rm \
  -v "$(pwd):/container/images" \
  -v "$(pwd)/converted:/container/converted" \
  karimz1/imgcompress:latest \
  /container/images/example.jpg /container/converted --quality 80 --width 1920
```

**Folder Processing:**

``` bash
docker run --rm \
  -v "$(pwd):/container/images" \
  -v "$(pwd)/converted:/container/converted" \
  karimz1/imgcompress:latest \
  /container/images /container/converted --quality 85 --width 800
```

------

## How It Works

1. 📁 Local Directory Mapping:

   Map your host machine’s directories into the Docker container:

   - **Input:** Your original images.
   - **Output:** Your optimized images.

2. ⚙️ Process Parameters:

   Customize your conversion with:

   - `--quality`: Set JPEG quality (1–100, default: 85).
   - `--width`: Resize images to a desired width (optional).
   - `--debug`: Enable detailed logging.
   - `--json-output`: Generate logs in JSON format for automation workflows.

------

## Detailed Example Logs

**Text Output:**

``` plain text
Starting image conversion process.
Processing directory: /container/input_folder/
Converted: /container/input_folder/photo1.jpg -> /container/output_folder/photo1.jpg (Q=80, W=800)
Converted: /container/input_folder/photo2.png -> /container/output_folder/photo2.jpg (Q=80, W=800)
Summary: 2 files processed, 0 errors.
```

**JSON Output:**

``` json
{
    "status": "complete",
    "conversion_results": {
        "files": [
            {
                "file": "photo1.jpg",
                "source": "/container/input_folder/photo1.jpg",
                "destination": "/container/output_folder/photo1.jpg",
                "original_width": 3648,
                "resized_width": 800,
                "is_successful": true,
                "error": null
            },
            {
                "file": "photo2.png",
                "source": "/container/input_folder/photo2.png",
                "destination": "/container/output_folder/photo2.jpg",
                "original_width": 6000,
                "resized_width": 800,
                "is_successful": true,
                "error": null
            }
        ],
        "file_processing_summary": {
            "total_files_count": 2,
            "successful_files_count": 2,
            "failed_files_count": 0
        }
    }
}
```

------

## Advanced Use Cases
- 🔧 **CI/CD Integration:**
  Use the `--json-output` flag to obtain structured results for automation, it acts as a mini API.

------

## Need Help?

Display all available options:

``` bash
docker run --rm karimz1/imgcompress --help
```

------

## 🔒 Privacy & Security

Your images remain private—**no uploads to third-party servers.**
Everything runs locally in Docker, ensuring your data stays secure and under your control.

------

## 🤝 Contribute & Support

Interested in contributing? Visit the [Source Code on GitHub](https://github.com/karimz1/imgcompress) and feel free to fork, branch, and submit a pull request.

If you find imgcompress valuable, consider supporting the project (totally optional), it would help investing in infrastructure and development tools:

🤗 **PayPal:** [mails.karimzouine@gmail.com](mailto:mails.karimzouine@gmail.com)

------

## License

This project is licensed under the MIT License. See the [LICENSE](https://raw.githubusercontent.com/karimz1/imgcompress/refs/heads/main/LICENSE) file for details.