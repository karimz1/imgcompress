"""The option list: one place for names, defaults and limits of the conversion form."""

import pytest
from werkzeug.datastructures import MultiDict

from backend.image_converter.application import conversion_options as options
from backend.image_converter.core.enums.image_format import ImageFormat
from backend.image_converter.domain.pdf_presets import PDF_PRESETS
from backend.image_converter.domain.upscaling import UpscaleModel, UpscaleTarget


def strict(**fields):
    return options.strict_error(MultiDict(fields), options.CONVERSION_OPTIONS + (options.OUTPUT,))


def test_When_ValuesAreValidOrBlank_Expect_NoError():
    assert strict(quality="1", width="1", target_size_kb="5", remove_background="true",
                  pdf_margin_mm="30", output="zip", format="WEBP") is None
    assert strict(quality=" ", width="") is None


@pytest.mark.parametrize("fields, needle", [
    ({"quality": "0"}, "'quality' must be a whole number between 1 and 100"),
    ({"quality": "101"}, "'quality'"),
    ({"quality": "high"}, "'quality'"),
    ({"width": "0"}, "'width' must be a whole number >= 1"),
    ({"width": "1.5"}, "'width'"),
    ({"target_size_kb": "-1"}, "'target_size_kb'"),
    ({"remove_background": "maybe"}, "'remove_background' must be true or false"),
    ({"use_rembg": "maybe"}, "'remove_background'"),
    ({"pdf_margin_mm": "31"}, "'pdf_margin_mm' must be a number between 0 and 30"),
    ({"format": "gif"}, "'format' must be one of"),
    ({"output": "tar"}, "'output' must be one of: auto, zip"),
])
def test_When_ValueIsOutOfRange_Expect_ItsNameAndRule(fields, needle):
    assert needle in strict(**fields)


def test_When_AliasIsUsed_Expect_SameOption():
    assert options.REMOVE_BACKGROUND.raw(MultiDict({"use_rembg": "true"})) == "true"
    assert options.FILES.aliases == ("file",)


def test_Choices_Expect_TheDomainEnumsSoNothingIsListedTwice():
    assert options.FORMAT.choices == tuple(f.value.lower() for f in ImageFormat)
    assert options.UPSCALE.choices == tuple(t.value for t in UpscaleTarget)
    assert options.UPSCALE_MODEL.choices == tuple(m.value for m in UpscaleModel)
    assert options.PDF_PRESET.choices == tuple(PDF_PRESETS)


def test_Names_Expect_UniquePerList():
    for group in (options.CONVERSION_OPTIONS, options.EDITOR_OPTIONS):
        names = [o.name for o in group]
        assert len(names) == len(set(names))
    assert all(o.description for o in options.CONVERSION_OPTIONS + options.EDITOR_OPTIONS)
