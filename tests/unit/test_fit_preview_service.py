from io import BytesIO

import numpy as np
import pytest
from PIL import Image
from werkzeug.datastructures import FileStorage

from backend.image_converter.presentation.web.services.fit_preview_service import (
    FitPreviewService,
)


def render(image, **fields):
    bitmap = BytesIO()
    image.save(bitmap, format="JPEG" if image.mode == "CMYK" else "PNG")
    bitmap.seek(0)
    return FitPreviewService().build(
        FileStorage(stream=bitmap),
        {
            "fit_width": "400",
            "fit_height": "200",
            **fields,
        },
    )


def test_automatic_selection_is_visible_and_explicit_replay_keeps_the_same_pixels():
    pixels = np.full((400, 600, 3), 200, dtype=np.uint8)
    for y in range(320, 380):
        pixels[y] = np.where((np.arange(600) // 5 + y // 5)[:, None] % 2, 20, 235)
    image = Image.fromarray(pixels)
    result = render(image)
    assert result.is_successful
    crop, preview = result.value
    assert crop["y"] > 0
    assert crop["y"] <= 320 and crop["y"] + crop["height"] >= 380
    replay = render(
        image,
        **{f"crop_{key}": str(crop[key]) for key in ("x", "y", "width", "height")},
    )
    assert replay.is_successful
    assert replay.value[1] == preview
    assert Image.open(BytesIO(preview)).size == (400, 200)


def test_manual_adjustment_is_used_without_another_automatic_crop():
    image = Image.new("RGB", (600, 400), "blue")
    image.paste("red", (0, 300, 600, 400))
    result = render(image, crop_x="0", crop_y="0", crop_width="600", crop_height="300")
    assert result.is_successful
    _, png = result.value
    output = Image.open(BytesIO(png))
    assert output.size == (400, 200)
    assert output.getpixel((200, 199)) == (0, 0, 255)


@pytest.mark.parametrize(
    "fields",
    [
        {"crop_x": "0"},
        {"crop_x": "-1", "crop_y": "0", "crop_width": "20", "crop_height": "20"},
        {"crop_x": "0", "crop_y": "0", "crop_width": "601", "crop_height": "20"},
        {"crop_x": "0.5", "crop_y": "0", "crop_width": "20", "crop_height": "20"},
        {"fit_width": "0"},
        {"fit_height": "8193"},
        {"fit_mode": "unknown"},
    ],
)
def test_invalid_fit_and_selection_are_rejected(fields):
    assert not render(Image.new("RGB", (600, 400)), **fields).is_successful


def test_crop_keeps_alpha_and_blur_keeps_the_whole_image_on_an_opaque_canvas():
    image = Image.new("RGBA", (120, 300), (255, 0, 0, 120))
    crop = render(image)
    assert crop.is_successful
    assert Image.open(BytesIO(crop.value[1])).getextrema()[-1] == (120, 120)
    blur = render(image, fit_mode="blur")
    assert blur.is_successful
    selection, png = blur.value
    assert (
        selection["x"],
        selection["y"],
        selection["width"],
        selection["height"],
    ) == (0, 0, 120, 300)
    assert Image.open(BytesIO(png)).mode == "RGB"


def test_cmyk_editor_bitmap_is_normalized():
    assert render(Image.new("CMYK", (100, 100))).is_successful


def test_missing_and_unreadable_bitmap_are_rejected():
    service = FitPreviewService()
    fields = {"fit_width": "400", "fit_height": "200"}
    assert not service.build(None, fields).is_successful
    assert not service.build(
        FileStorage(stream=BytesIO(b"not an image")), fields
    ).is_successful


def test_preview_and_render_api_use_the_same_saved_selection():
    from backend.image_converter.presentation.web.server import app

    bitmap = BytesIO()
    Image.new("RGBA", (300, 450), (50, 150, 200, 100)).save(bitmap, format="PNG")
    fields = {"fit_width": "400", "fit_height": "200", "fit_mode": "blur"}
    client = app.test_client()
    preview = client.post(
        "/api/crop/fit",
        data={**fields, "file": (BytesIO(bitmap.getvalue()), "image.png")},
    )
    assert preview.status_code == 200
    crop = preview.json["crop"]
    rendered = client.post(
        "/api/crop/fit",
        data={
            **fields,
            "render": "true",
            "file": (BytesIO(bitmap.getvalue()), "image.png"),
            **{f"crop_{key}": str(crop[key]) for key in ("x", "y", "width", "height")},
        },
    )
    assert rendered.status_code == 200
    assert rendered.mimetype == "image/png"
    import base64

    assert rendered.data == base64.b64decode(preview.json["preview"].split(",", 1)[1])


def test_large_custom_size_gets_a_scaled_preview_but_renders_at_full_size():
    image = Image.new("RGB", (600, 400), "green")
    fields = {"fit_width": "4000", "fit_height": "3000", "fit_mode": "blur"}
    preview = render(image, **fields)
    assert preview.is_successful
    assert Image.open(BytesIO(preview.value[1])).size == (2048, 1536)

    bitmap = BytesIO()
    image.save(bitmap, format="PNG")
    bitmap.seek(0)
    full = FitPreviewService().build(FileStorage(stream=bitmap), fields, full_size=True)
    assert full.is_successful
    assert Image.open(BytesIO(full.value[1])).size == (4000, 3000)


@pytest.mark.parametrize("mode", ["crop", "blur"])
def test_large_preview_never_allocates_the_export_canvas(monkeypatch, mode):
    sizes = []
    original_resize = Image.Image.resize

    def record_resize(image, size, *args, **kwargs):
        sizes.append(size)
        return original_resize(image, size, *args, **kwargs)

    monkeypatch.setattr(Image.Image, "resize", record_resize)
    result = render(
        Image.new("RGB", (600, 400), "green"),
        fit_width="8192", fit_height="8192", fit_mode=mode,
    )

    assert result.is_successful
    assert Image.open(BytesIO(result.value[1])).size == (2048, 2048)
    assert sizes and all(max(size) <= 2048 for size in sizes)
    assert result.value[0]["fit"] == {"width": 8192, "height": 8192, "mode": mode}


def test_colour_profile_is_kept_for_rgb_and_dropped_after_cmyk_conversion():
    from PIL import ImageCms

    srgb = ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes()
    for mode, expected in (("RGB", srgb), ("CMYK", None)):
        bitmap = BytesIO()
        Image.new(mode, (300, 200)).save(bitmap, format="JPEG", icc_profile=srgb)
        bitmap.seek(0)
        result = FitPreviewService().build(
            FileStorage(stream=bitmap), {"fit_width": "400", "fit_height": "200"}
        )
        assert result.is_successful
        assert Image.open(BytesIO(result.value[1])).info.get("icc_profile") == expected


def test_selection_only_request_skips_the_preview():
    from backend.image_converter.presentation.web.server import app

    bitmap = BytesIO()
    Image.new("RGB", (600, 400), "white").save(bitmap, format="PNG")
    response = app.test_client().post(
        "/api/crop/fit",
        data={
            "fit_width": "400",
            "fit_height": "200",
            "preview": "false",
            "file": (BytesIO(bitmap.getvalue()), "image.png"),
        },
    )
    assert response.status_code == 200
    assert "preview" not in response.json
    assert (response.json["crop"]["width"], response.json["crop"]["height"]) == (600, 300)


def test_exif_rotated_bitmap_is_measured_and_fitted_upright():
    # Stored landscape, EXIF orientation 6: the browser shows it 300 x 600.
    stored = Image.new("RGB", (600, 300), "blue")
    stored.paste("red", (0, 0, 300, 300))
    exif = Image.Exif()
    exif[0x0112] = 6
    bitmap = BytesIO()
    stored.save(bitmap, format="JPEG", exif=exif, quality=95)
    bitmap.seek(0)

    result = FitPreviewService().build(
        FileStorage(stream=bitmap),
        {"fit_width": "200", "fit_height": "400", "fit_mode": "blur"},
    )

    assert result.is_successful
    selection, png = result.value
    assert (selection["originalWidth"], selection["originalHeight"]) == (300, 600)
    output = Image.open(BytesIO(png)).convert("RGB")
    assert output.getpixel((100, 50))[0] > 200
    assert output.getpixel((100, 350))[2] > 200
