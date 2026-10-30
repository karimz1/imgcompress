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
