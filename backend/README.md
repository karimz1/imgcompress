# ImgCompress backend

The Python backend for [ImgCompress](../ReadMe.md). It handles image conversion, compression, resizing, cropping, PDF processing, background removal, file storage, and the web API used by the frontend.

For the full local setup, testing workflow, and Dev Container instructions, see the [developer guide](https://imgcompress.karimzouine.com/docs/developers).

## Backend development

After setting up the project environment, start the backend from the repository root:

```bash
./scripts/runStartLocalBackend.sh
```

The server runs at <http://localhost:5000>.

AI upscaling offers two small Real-ESRGAN models with tiled CPU inference:
`realesr-general-x4v3` (General, the default for photos) and
`realesr-animevideov3` (Anime, for drawn images). Both ship in the Docker image;
no GPU or internet connection is required at runtime. The web form selects a
model for the batch; the CLI uses `--upscale-model general|anime` alongside
`--upscale`. Outside Docker, `scripts/build_upscale_model.py` builds both models
by default, or one with `--model general|anime`.
Resolution targets fit the image inside a frame without
stretching or cropping, and switch orientation for portrait images. The 6K
frame is 5760 × 3240, the 8K frame is 7680 × 4320, and the 16K frame is
15360 × 8640. Frame targets never shrink images that already meet the target.
The model upscales by 4×; larger enlargements, including 8×, resize that result
with Lanczos in a single AI pass.

`upscaling.max_output_megapixels` in `backend/image_converter/config/app.json`
defaults to 144 MP, allowing a 4K image enlarged 4× to 16K UHD (15360 × 8640).
One megapixel is 1,000,000 pixels. Tiling bounds the model's working memory.
Source pixels are converted per tile and pasted directly into one Pillow output
image, avoiding a duplicate full-size NumPy buffer. Resized RGB pieces are
bounded to 1024 × 1024, including when a tiny source fills a large target.
JPEG normalization also avoids a redundant EXIF copy and composites alpha
directly, without separate full-size RGB and alpha copies.
The final image and encoding still occupy RAM; lower this setting on
memory-constrained machines. Decoding through TIFF encoding is serialized across
workers; final format conversion can still overlap between requests. Automatic
CPU threads respect container limits. Large inputs can take a long time on small
CPUs. A container memory limit is needed to enforce a total RAM ceiling.

The [upstream model list](https://github.com/xinntao/Real-ESRGAN/blob/master/docs/model_zoo.md)
includes larger general-purpose and anime-specific models. This app keeps the
compact general and anime models for CPU-only machines. AI predicts missing detail, so
small facial features may look artificial. Upstream also supports
[adjustable denoising and optional face enhancement](https://github.com/xinntao/Real-ESRGAN/blob/master/inference_realesrgan.py);
these are not enabled here and would need photo comparisons and CPU benchmarks
before changing the bundled model.

The [anime model](https://github.com/xinntao/Real-ESRGAN/blob/master/docs/anime_video_model.md)
is specialized for anime frames. It uses 16 hidden convolution layers versus
32 for General. In a local check with two CPU threads, a generated 640 × 360
illustration enlarged 4× took about 2.0 seconds with Anime versus 3.6 seconds
with General (three runs after warm-up, including TIFF encoding). This shows
a CPU speed benefit for that workload; quality and timing vary with the image
and hardware. General stays the default for photos.

`realesr-general-wdn-x4v3` remains a candidate for separate photo comparisons.
It is the weak-denoise companion used by upstream's denoising control and has
the same network as General. Lower denoising preserves more noise and may
avoid overly smooth texture; it does not guarantee more accurate faces.

The tooltip identifies the selected model by name without external links.
The Qualcomm AI Hub listing is an
official Qualcomm distribution of the same checkpoint with deployment options
for Qualcomm hardware, rather than the original model source or evidence of
an improvement on Intel CPUs.

Useful checks:

```bash
make lint          # Run the Python linter
make unit          # Run unit tests
make integration   # Run integration tests
```
