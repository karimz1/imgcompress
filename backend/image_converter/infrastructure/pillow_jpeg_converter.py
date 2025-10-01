from io import BytesIO

from PIL import Image, ImageOps, ImageFile

from backend.image_converter.core.internals.utls import Result

ImageFile.LOAD_TRUNCATED_IMAGES = True


class PillowJpegConverter:
    def __init__(self, quality: int, logger):
        self.quality = int(quality)
        self.logger = logger

    def encode(self, image_data: bytes) -> bytes:
        with Image.open(BytesIO(image_data)) as img:
            img = ImageOps.exif_transpose(img)
            img = img.convert("RGB")
            out = BytesIO()
            img.save(
                out,
                format="JPEG",
                quality=self.quality,
                optimize=True,
                progressive=True,
                subsampling="4:2:0",
            )
            return out.getvalue()

    def save(self, image_data: bytes, dest_path: str) -> Result[None]:
        try:
            data = self.encode(image_data)
            with open(dest_path, "wb") as f:
                f.write(data)
            return Result.success
        except Exception as e:
            self.logger.log(f"PillowJpegConverter.save error: {e}", "error")
            return Result.failure(str(e))

    def encode_bytes(self, image_data: bytes) -> bytes:
        return self.encode(image_data)

    def convert_to_path(self, image_data: bytes, dest_path: str) -> Result[None]:
        return self.save(image_data, dest_path)
