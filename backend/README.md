# ImgCompress backend

The Python backend for [ImgCompress](../ReadMe.md). It handles image conversion, compression, resizing, cropping, PDF processing, background removal, file storage, and the web API used by the frontend.

For the full local setup, testing workflow, and Dev Container instructions, see the [developer guide](https://imgcompress.karimzouine.com/docs/developers).

## Backend development

After setting up the project environment, start the backend from the repository root:

```bash
./scripts/runStartLocalBackend.sh
```

The server runs at <http://localhost:5000>.

Useful checks:

```bash
make lint          # Run the Python linter
make unit          # Run unit tests
make integration   # Run integration tests
```

## SVG import

SVGs are rasterized with CairoSVG at the requested width, upscale target, or fit dimensions before entering the Pillow conversion pipeline. SVGs bypass bitmap resizing and AI upscaling; the original viewport dimensions remain available in CLI results. CairoSVG handles alpha transparency, CSS styling, and gradients; embedded resources are supported, and external files and URLs are rejected.

The crop editor uses a PNG preview with a longest side of 2048 pixels while keeping crop coordinates in the original SVG viewport. Saved crops embed and clip the original SVG, preserving its vectors until final conversion. Fit previews and fitted exports render the selected vectors at their output resolution. Embedded bitmap images cannot gain vector detail through this process.

Docker and Dev Containers include the Cairo runtime. For a native installation, install Cairo as well as the Python requirements (for example, `libcairo2` on Debian/Ubuntu, `brew install cairo` on macOS, or a Cairo/GTK runtime on Windows). CairoSVG brings its XML and CSS dependencies automatically; no separate SVG package is needed.

## PDF workspace

Select **PDF** and import files to enable the PDF workspace. The **Convert** tab uses the existing page format, margins, scale, quality and pagination settings; its workspace previews the resulting output pages so individual pages or image slices can be excluded. The **Merge only** tab retains the original page sizes and does not apply the conversion tab's layout settings. Files already selected in the main form are added when you open the workspace; more files can be added there directly. Drag any preview to reorder pages, use the arrow buttons, uncheck pages to exclude them, or rotate them. Each thumbnail has visible enlarge and delete buttons; **Undo removal** restores deleted pages. Mouse dragging animates the surrounding pages, touch dragging starts after a brief hold, and Escape cancels a drag.

Every exported page is rebuilt from rasterized pixels in a newly generated PDF. Source scripts, annotations, attachments and interactive objects are not copied; original selectable text is removed too. In merge mode PDF page dimensions remain unchanged, while PNG, JPEG, WebP, AVIF, GIF, BMP, TIFF and HEIC images become pages at 96 DPI with transparency on white. Merge uses the High document quality; the Convert tab uses the selected DPI and JPEG quality. Animated and multipage image files use their first frame. The workspace supports up to 500 output pages and the configured upload size limit. Password-protected PDFs must be unlocked first. Saved crops and the main image editor's other effects are not applied by this workspace.

**Recognize text (OCR)** optionally adds a fresh searchable text layer from the rendered page images using local Tesseract. Docker and Dev Container builds include English and German language data. Native installations need Tesseract plus language data; the checkbox stays disabled when the engine or models are unavailable. Tesseract is found on `PATH`, in its usual Windows installation directory, or through `IMGCOMPRESS_TESSERACT` (an executable path). `TESSDATA_PREFIX` can point to additional local language data. No OCR models or files are downloaded at runtime. For Debian/Ubuntu, install `tesseract-ocr tesseract-ocr-eng tesseract-ocr-deu`; on Windows follow the [Tesseract installation guide](https://tesseract-ocr.github.io/tessdoc/Installation.html). Recognition quality depends on the image and selected language.

`POST /api/pdf/preview` accepts one multipart `file` and optionally a zero-based `page` for a larger preview. `POST /api/pdf/merge` accepts multipart `files` and a JSON `pages` array of `{source, page, rotation}` objects. Page indices address the prepared output pages, including pagination; rotation is an additional 0, 90, 180 or 270 degrees clockwise. Both endpoints accept `apply_layout=true` and the existing `pdf_preset`, `pdf_scale`, `pdf_margin_mm`, `pdf_paginate`, and `pdf_quality` fields. Otherwise merge defaults apply. Merge also accepts `ocr=true` and `ocr_language` from the installed languages returned by `GET /api/pdf/ocr`. Only selected pages are included, in their listed order. Requests use temporary upload streams and intermediate converter files that are removed after use; workspace and result files are not persisted by these endpoints. Edits remain while the page is open and are lost on reload. PDFium operations share a process lock with the existing PDF image converter.

## AI upscaling

Two Real-ESRGAN models ship in the Docker image: `realesr-general-x4v3` (General, the default) and `realesr-animevideov3` (Anime, for drawn images). General also comes in two noise-reduction presets, `realesr-general-x4v3-denoise-medium` and `-denoise-low` (`--upscale-model general-denoise-medium|general-denoise-low`). They blend General with the official `realesr-general-wdn-x4v3` weights (strength 0.5 and 0.25, like `--denoise_strength` in upstream `inference_realesrgan.py`), so they keep more fine detail and more noise at the same speed. All are built in the `upscale-model-stage` of the Dockerfile by `scripts/build_upscale_model.py` from the official `.pth` release files, which are SHA-256 checked before they are loaded. Only the `.onnx` files and their `.sha256` files end up in `IMGCOMPRESS_MODEL_HOME` (`/container/.models`). Nothing is downloaded at runtime; a missing or changed model file shows up as "not installed" in the UI.

Outside Docker, build them once (needs torch and onnx, see the script):

```bash
python scripts/build_upscale_model.py ~/.imgcompress/models
```

The model always enlarges by 4x in 512 px tiles on the CPU, so its working memory stays the same for any image size. Other targets resize that result with Lanczos. The finished image still has to fit in RAM.

Settings in `backend/image_converter/config/app.json`:

- `upscaling.threads`: `"auto"` (CPUs the container may use, at most 8) or a number.
- `upscaling.max_output_megapixels`: larger outputs are refused before any work starts. Default 144 (enough for 4K to 16K), at most 178 because Pillow refuses to reopen bigger images. Lower it on machines with little RAM: a 4K to 16K JPEG through the CLI peaked at about 1.1 GB (measured on an 8-core Xeon cloud VM).
