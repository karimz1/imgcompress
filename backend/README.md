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

## AI upscaling

Two Real-ESRGAN models ship in the Docker image: `realesr-general-x4v3` (General, the default) and `realesr-animevideov3` (Anime, for drawn images). Both are built in the `upscale-model-stage` of the Dockerfile by `scripts/build_upscale_model.py` from the official `.pth` release files, which are SHA-256 checked before they are loaded. Only the `.onnx` files and their `.sha256` files end up in `IMGCOMPRESS_MODEL_HOME` (`/container/.models`). Nothing is downloaded at runtime; a missing or changed model file shows up as "not installed" in the UI.

Outside Docker, build them once (needs torch and onnx, see the script):

```bash
python scripts/build_upscale_model.py ~/.imgcompress/models
```

The model always enlarges by 4x in 256 px tiles on the CPU, so its working memory stays the same for any image size. Other targets resize that result with Lanczos. The finished image still has to fit in RAM.

Settings in `backend/image_converter/config/app.json`:

- `upscaling.threads`: `"auto"` (CPUs the container may use, at most 8) or a number.
- `upscaling.max_output_megapixels`: larger outputs are refused before any work starts. Default 144 (enough for 4K to 16K), at most 178 because Pillow refuses to reopen bigger images. Lower it on machines with little RAM: a 4K to 16K JPEG through the CLI peaked at about 1.1 GB (measured on an 8-core Xeon cloud VM).
