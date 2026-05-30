from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from PIL import Image

from backend.image_converter.presentation.web import routes


FIXTURE_DIR = (
    Path(__file__).resolve().parents[2]
    / "frontend"
    / "tests"
    / "e2e"
    / "fixtures"
    / "sample-images"
)

def test_multiple_concurrent_psd_previews_all_succeed():
    psd_path = FIXTURE_DIR / "37443511_8499861.psd"
    raw_bytes = psd_path.read_bytes()

    service = routes.crop_preview_service

    def _decode_once(index: int):
        result = service.build_preview(
            psd_path.name,
            raw_bytes,
            request_id=f"concurrent-{index}",
        )
        assert result.is_successful, result.error
        buffer = result.value
        buffer.seek(0)
        with Image.open(buffer) as img:
            assert img.format == "PNG"
            return img.size

    parallelism = 6
    with ThreadPoolExecutor(max_workers=parallelism) as pool:
        sizes = list(pool.map(_decode_once, range(parallelism)))

    assert len(sizes) == parallelism
    assert len(set(sizes)) == 1, sizes


def test_concurrent_mix_of_supported_and_unsupported_does_not_cross_state():
    psd_path = FIXTURE_DIR / "37443511_8499861.psd"
    pdf_path = FIXTURE_DIR / "imgcompress_multipage_test.pdf"
    psd_bytes = psd_path.read_bytes()
    pdf_bytes = pdf_path.read_bytes()

    service = routes.crop_preview_service

    def _decode_psd(index: int):
        result = service.build_preview(
            psd_path.name,
            psd_bytes,
            request_id=f"mix-psd-{index}",
        )
        assert result.is_successful, result.error
        return "ok"

    def _decode_pdf(index: int):
        result = service.build_preview(
            pdf_path.name,
            pdf_bytes,
            request_id=f"mix-pdf-{index}",
        )
        assert not result.is_successful
        assert "not compatible" in result.error
        return "rejected"

    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = [
            pool.submit(_decode_psd, 0),
            pool.submit(_decode_pdf, 0),
            pool.submit(_decode_psd, 1),
            pool.submit(_decode_pdf, 1),
        ]
        results = [f.result() for f in futures]

    assert results.count("ok") == 2
    assert results.count("rejected") == 2
