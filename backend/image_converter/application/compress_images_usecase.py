from .dtos import CompressRequest, CompressResult
from backend.image_converter.domain.size_targeting import find_best_quality_under_target
from backend.image_converter.domain.units import TargetSize
from backend.image_converter.core.enums.image_format import ImageFormat

class CompressImagesUseCase:
    def __init__(self, logger, resizer, converter_factory, storage):
        self.logger = logger
        self.resizer = resizer
        self.converter_factory = converter_factory
        self.storage = storage

    def execute(self, req: CompressRequest) -> CompressResult:
        processed, errors = [], []
        new_ext = req.image_format.get_file_extension()

        for item in self.storage.iter_files(req.source_folder):
            try:
                original = self.storage.read_bytes(item.path)
                data = (self.resizer.resize_image(original, req.width)
                        if req.width and req.width > 0 else original)

                dest_path = self.storage.build_dest_path(req.dest_folder, item.stem + new_ext)

                if req.target_size and req.image_format == ImageFormat.JPEG:
                    target = TargetSize(req.target_size.bytes)
                    target_bytes = target.soft_limit

                    def encoder(q: int, d: bytes) -> bytes:
                        converter = self.converter_factory.create_converter(ImageFormat.JPEG, q, self.logger)
                        return converter.encode_bytes(d)

                    q, out, size = find_best_quality_under_target(encoder, data, target_bytes)

                    if not target.within_tolerance(len(out)):
                        self.logger.log(
                            f"{item.name}: best={q} still {len(out)} bytes over tolerance for {target.bytes}.",
                            "warn"
                        )

                    self.storage.write_bytes(dest_path, out)
                    processed.append(item.name)
                else:
                    converter = self.converter_factory.create_converter(req.image_format, req.quality, self.logger)
                    result = converter.convert(
                        image_data=data,
                        source_path=item.path,
                        dest_path=dest_path
                    )
                    if not result.is_successful:
                        errors.append(f"{item.name}: {result.error}")
                    else:
                        processed.append(item.name)
            except Exception as e:
                errors.append(f"{item.name}: {e}")

        return CompressResult(processed_files=processed, errors=errors)
