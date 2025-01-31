# imgcompress: Image Compression Tool

![Docker Pulls](https://img.shields.io/docker/pulls/karimz1/imgcompress)
![Docker Image Version](https://img.shields.io/docker/v/karimz1/imgcompress?sort=semver)
![Docker Image Size](https://img.shields.io/docker/image-size/karimz1/imgcompress/latest)
[![Build and Test Docker Image](https://github.com/karimz1/imgcompress/actions/workflows/deploy.yml/badge.svg?branch=main)](https://github.com/karimz1/imgcompress/actions/workflows/deploy.yml)

![imgcompress Logo](https://raw.githubusercontent.com/karimz1/imgcompress/refs/heads/main/images/imgcompress_logo.jpg)


## Why would someone develop a tool like that ?!

Hello, I am Karim Zouine, and I created this Docker-based tool called **imgcompress** because I got tired of relying on multiple programs whenever I needed to convert or compress images. Dealing with HEIC files was especially frustrating, since they often need specific DLLs that can be complicated to install. Although there are online conversion services out there, I have always been cautious about uploading personal photos to random websites. Privacy matters to me, so I wanted a reliable way to handle everything locally on my own computer.

By packaging imgcompress in a Docker container, I eliminated the need to install extra dependencies or spend time on complicated setup. Docker guarantees that imgcompress operates the same way on any machine, removing the guesswork. With just a few commands, it can also convert entire folders of images in one go.


## **Features of imgcompress?**

`imgcompress` is a lightweight, fully Dockerized tool for compressing, resizing, and converting images. It’s designed to simplify image optimization with:

- **HEIC to JPG Conversion**: Automatically convert HEIC files to JPG.
- **Batch & Single File Processing**: Process entire directories or individual images effortlessly.
- **Logging Options**: Choose between human-readable text or structured JSON output.
- **Seamless Automation**: Perfect for use in CI/CD pipelines or standalone workflows.
- **NEW Modern Web UI**: An intuitive web interface for easy image compression without the command line.

![Web UI Gif](https://raw.githubusercontent.com/karimz1/imgcompress/refs/heads/main/images/ezgif-12f4af43b7a59.gif)

------

## **Installation**

Pull the latest image with:

```bash
docker pull karimz1/imgcompress:latest
```

------

## Usage

`imgcompress` provides both a Command-Line Interface (CLI) for advanced users and a Web User Interface (Web UI) for an intuitive, no-code experience.



### NEW: Web User Interface (Web UI) - Workflow

> This is the recommended approach because providing a user interface for image compression can be highly beneficial.

For users who prefer a graphical interface, `imgcompress` offers a modern Web UI.

#### **Starting the Web UI**

Run the following command to launch the Web UI:

```
docker run --rm -p 5000:5000 karimz1/imgcompress:latest web
```

- Port Mapping:
  - `-p 5000:5000`: Maps port `5000` of the container to port `5000` on the host machine.

#### **Accessing the Web UI**

Once the container is running, open your browser and navigate to:

```
http://localhost:5000
```

#### **Features**

- **Drag & Drop**: Easily upload images for compression.
- **Batch Processing**: Handle multiple images simultaneously.
- **Real-Time Progress**: Monitor the compression status.
- **Download Optimized Images**: Retrieve compressed images directly from the Web interface.
- **Settings Panel**: Adjust compression quality and resizing options.
- **Multi Images Support**: Easily upload and process multiple images simultaneously, streamlining your workflow with the ability to drag and drop entire image folders.



#### Screenshoots
> The user interface may differ slightly from the screenshot, as I continuously develop and implement minor enhancements.

##### Web UI
![Web UI GIF](https://raw.githubusercontent.com/karimz1/imgcompress/refs/heads/main/images/ezgif-12f4af43b7a59.gif)


### Command-Line Interface (CLI) - Workflow

> This approach is designed for advanced workflows and automation, allowing you to integrate it seamlessly into pipelines or other automated processes.

Navigate to your image directory and run:

#### Single File Processing:

```bash
docker run --rm \
  -v "$(pwd):/container/images" \
  -v "$(pwd)/converted:/container/converted" \
  karimz1/imgcompress:latest \
  /container/images/example.jpg /container/converted --quality 80 --width 1920
```

#### Folder Processing:

```bash
docker run --rm \
  -v "$(pwd):/container/images" \
  -v "$(pwd)/converted:/container/converted" \
  karimz1/imgcompress:latest \
  /container/images /container/converted --quality 85 --width 800
```

### **What It Does**

1. **Maps local directories:**
   - `$(pwd)`: Refers to the current working directory on your host machine.
   - `images/`: The input folder or file for uncompressed images.
   - `converted/`: The output folder for compressed images.
2. **Processes images:**
   - `--quality`: Sets JPEG quality (e.g., `80` for single file, `85` for folders).
   - `--width`: Resizes images to a specific width while maintaining aspect ratio.

------

### **Parameters**

| Parameter       | Description                                          |
| --------------- | ---------------------------------------------------- |
| `--quality`     | Compression quality (1–100, default: `85`).          |
| `--width`       | Resize images to the specified width (optional).     |
| `--debug`       | Enable detailed logs for troubleshooting.            |
| `--json-output` | Output logs in JSON format for automation workflows. |

------

### **Example Logs**

#### **Text Logs**:

```plaintext
Starting image conversion process.
Processing directory: /container/input_folder/
Converted: /container/input_folder/pexels-willianjusten-29944187.jpg -> /container/output_folder/pexels-willianjusten-29944187.jpg (Q=80, W=800)
Converted: /container/input_folder/test_image.png -> /container/output_folder/test_image.jpg (Q=80, W=800)
Converted: /container/input_folder/pexels-pealdesign-28594392.jpg -> /container/output_folder/pexels-pealdesign-28594392.jpg (Q=80, W=800)
Summary: 3 file(s) processed, 0 error(s).
```

#### **JSON Logs**:

```json
{
    "status": "complete",
    "conversion_results": {
        "files": [
            {
                "file": "pexels-willianjusten-29944187.jpg",
                "source": "/container/input_folder/pexels-willianjusten-29944187.jpg",
                "destination": "/container/output_folder/pexels-willianjusten-29944187.jpg",
                "original_width": 3648,
                "resized_width": 800,
                "is_successful": true,
                "error": null
            },
            {
                "file": "test_image.png",
                "source": "/container/input_folder/test_image.png",
                "destination": "/container/output_folder/test_image.jpg",
                "original_width": 6000,
                "resized_width": 800,
                "is_successful": true,
                "error": null
            },
            {
                "file": "pexels-pealdesign-28594392.jpg",
                "source": "/container/input_folder/pexels-pealdesign-28594392.jpg",
                "destination": "/container/output_folder/pexels-pealdesign-28594392.jpg",
                "original_width": 3486,
                "resized_width": 800,
                "is_successful": true,
                "error": null
            }
        ],
        "file_processing_summary": {
            "total_files_count": 3,
            "successful_files_count": 3,
            "failed_files_count": 0
        }
    }
}
```

------

## **Advanced Use Cases**

- **HEIC Conversion**: Just include HEIC files in your input directory, and they’ll automatically convert to JPG.
- **CI/CD Integration**: Use `--json-output` for structured results in automated workflows.

------

## **Help Menu**

For all options, run:

```bash
docker run --rm karimz1/imgcompress --help
```

------

## Privacy And Security
One of my main motivations was maintaining full control over my images. Because imgcompress runs in Docker on your local environment, there is no need to upload your images to a third-party website. This approach not only preserves your privacy but also avoids potential security risks that come with web-based tools.


------

## **Contribution**

[Source Code](https://github.com/karimz1/imgcompress)

I welcome contributions! Fork the repo, create a branch, and submit a pull request.

------


## ❤️ If You Find This Useful ❤️

I am thrilled to offer this tool for free, and I truly value open source. If imgcompress saves you time or simplifies your workflow, you are welcome to support the project with a small donation. It is totally optional, and I appreciate your interest regardless.

**PayPal:** [mails.karimzouine@gmail.com](mailto:mails.karimzouine@gmail.com)


Thank you for taking the time to learn about imgcompress. I hope it makes your image conversion tasks easier and more secure. Give it a try, and feel free to share your experience or contribute your ideas to help improve it for everyone. ❤️

------

## License

This project is licensed under the MIT License. See the [LICENSE](https://raw.githubusercontent.com/karimz1/imgcompress/refs/heads/main/LICENSE) file for details.