"""Tests for AI upscaling: size planning, the bundled model file, tiling, and wiring.

Everything except the last section uses a fake model, so the suite runs without
the model file and without onnxruntime doing any work. The real-model tests run
when the model is installed (it is in the Docker image) and are skipped otherwise.
"""

import hashlib
import importlib.util
import json
import threading
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from pathlib import Path
from io import BytesIO
from types import SimpleNamespace

import numpy as np
import pytest
from PIL import Image, ImageDraw, ImageFilter

from backend.image_converter.application.compress_images_usecase import CompressImagesUseCase
from backend.image_converter.application.dtos import CompressionFormData
from backend.image_converter.config import settings
from backend.image_converter.core.enums.image_format import ImageFormat
from backend.image_converter.core.image_conversion_processor import ImageConversionProcessor
from backend.image_converter.domain.upscaling import UpscaleModel, UpscalePlan, UpscaleTarget, plan_upscale
from backend.image_converter.infrastructure import ai_upscaler, upscale_model
from backend.image_converter.infrastructure.ai_upscaler import (
    AiUpscaler,
    cgroup_cpu_limit,
    resolve_thread_count,
)
from backend.image_converter.infrastructure.upscale_model import (
    CHECKSUM_SUFFIX,
    MODEL_FILENAME,
    MODEL_HOME_ENV,
    locate_model,
)
from backend.image_converter.presentation.web.services.compression_service import CompressionService
from backend.image_converter.presentation.web.services.configuration_service import ConfigurationService
from backend.image_converter.core.internals.utilities import Result
from tests.unit.dummy_logger import DummyLogger


class _Logger:
    def __init__(self):
        self.messages = []

    def log(self, message, level="info"):
        self.messages.append((level, message))


def _nearest_4x(tile: np.ndarray) -> np.ndarray:
    """Stand-in for the model: 4x nearest neighbour, same NCHW float layout."""
    return tile.repeat(4, axis=2).repeat(4, axis=3)


def _encode(img: Image.Image, fmt: str = "PNG", **kwargs) -> bytes:
    buffer = BytesIO()
    img.save(buffer, format=fmt, **kwargs)
    return buffer.getvalue()


def _decode(data: bytes) -> Image.Image:
    img = Image.open(BytesIO(data))
    img.load()
    return img


def _random_rgb(width: int, height: int, seed: int = 0) -> Image.Image:
    rng = np.random.default_rng(seed)
    return Image.fromarray(rng.integers(0, 256, (height, width, 3), dtype=np.uint8), "RGB")


# --- Size planning ----------------------------------------------------------------------


@pytest.mark.parametrize(
    ("size", "target", "expected"),
    [
        ((640, 360), UpscaleTarget.X2, (1280, 720)),
        ((640, 360), UpscaleTarget.X4, (2560, 1440)),
        ((640, 360), UpscaleTarget.X8, (5120, 2880)),
        ((1280, 720), UpscaleTarget.UHD_4K, (3840, 2160)),
        ((1280, 720), UpscaleTarget.FULL_HD, (1920, 1080)),
        ((720, 1280), UpscaleTarget.UHD_4K, (2160, 3840)),
        ((1000, 1000), UpscaleTarget.UHD_4K, (2160, 2160)),
        ((800, 200), UpscaleTarget.FULL_HD, (1920, 480)),
        ((1280, 720), UpscaleTarget.UHD_6K, (5760, 3240)),
        ((1280, 720), UpscaleTarget.UHD_8K, (7680, 4320)),
        ((3840, 2160), UpscaleTarget.UHD_16K, (15360, 8640)),
        ((3840, 2160), UpscaleTarget.X4, (15360, 8640)),
        ((1920, 1080), UpscaleTarget.X8, (15360, 8640)),
        ((2160, 3840), UpscaleTarget.UHD_16K, (8640, 15360)),
    ],
)
def test_When_PlanningUpscale_Expect_OutputSizeForTarget(size, target, expected):
    upscaler = AiUpscaler(_Logger())
    plan = plan_upscale(*size, target, max_output_pixels=upscaler.max_output_pixels)

    assert plan.is_successful
    assert plan.value == UpscalePlan(size, expected)
    assert not plan.value.is_noop


@pytest.mark.parametrize(
    ("size", "target"),
    [
        ((3840, 2160), UpscaleTarget.UHD_4K),
        ((2000, 1200), UpscaleTarget.FULL_HD),
        ((5760, 3240), UpscaleTarget.UHD_6K),
        ((4320, 7680), UpscaleTarget.UHD_8K),
        ((15360, 8640), UpscaleTarget.UHD_16K),
        ((16000, 9000), UpscaleTarget.UHD_16K),
    ],
)
def test_When_ImageAlreadyMeetsFrame_Expect_NoopNotShrunk(size, target):
    plan = plan_upscale(*size, target, max_output_pixels=36_000_000)

    assert plan.value.is_noop
    assert plan.value.output_size == size


@pytest.mark.parametrize(
    ("target", "frame"),
    [
        (UpscaleTarget.FULL_HD, (1920, 1080)),
        (UpscaleTarget.UHD_4K, (3840, 2160)),
        (UpscaleTarget.UHD_6K, (5760, 3240)),
        (UpscaleTarget.UHD_8K, (7680, 4320)),
        (UpscaleTarget.UHD_16K, (15360, 8640)),
    ],
)
@pytest.mark.parametrize("size", [(640, 480), (480, 640), (100, 100), (800, 200), (200, 800), (321, 227)])
def test_When_FittingFrame_Expect_NoStretchOrCrop(size, target, frame):
    plan = plan_upscale(*size, target, max_output_pixels=144_000_000)

    assert plan.is_successful
    width, height = plan.value.output_size
    assert max(width, height) <= frame[0]
    assert min(width, height) <= frame[1]
    assert max(width, height) == frame[0] or min(width, height) == frame[1]
    # A single scale factor, allowing only half-pixel rounding on either side.
    assert abs(width * size[1] - height * size[0]) <= max(size) / 2


def test_When_OutputWouldExceedLimit_Expect_FailureWithSizes():
    plan = plan_upscale(4000, 3000, UpscaleTarget.X4, max_output_pixels=36_000_000)

    assert not plan.is_successful
    assert "16000x12000" in plan.error
    assert "36 MP limit" in plan.error


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("", None),
        ("  ", None),
        (None, None),
        ("4X", UpscaleTarget.X4),
        ("4k", UpscaleTarget.UHD_4K),
        ("8X", UpscaleTarget.X8),
        ("6K", UpscaleTarget.UHD_6K),
        (" 8k ", UpscaleTarget.UHD_8K),
        ("16k", UpscaleTarget.UHD_16K),
    ],
)
def test_When_ParsingUpscaleOption_Expect_TargetOrOff(raw, expected):
    result = UpscaleTarget.from_string_result(raw)

    assert result.is_successful
    assert result.value == expected


def test_When_UpscaleOptionUnknown_Expect_FailureListingOptions():
    result = UpscaleTarget.from_string_result("16x")

    assert not result.is_successful
    assert "'16x'" in result.error
    assert "2x, 4x, 8x, 1080p, 4k, 6k, 8k, 16k" in result.error


# --- Bundled model file -----------------------------------------------------------------


@pytest.mark.parametrize(("raw", "expected"), [(None, UpscaleModel.GENERAL), ("", UpscaleModel.GENERAL),
                                               ("general", UpscaleModel.GENERAL), (" ANIME ", UpscaleModel.ANIME)])
def test_When_ParsingUpscaleModel_Expect_DefaultOrSelectedModel(raw, expected):
    result = UpscaleModel.from_string_result(raw)
    assert result.is_successful
    assert result.value == expected


def test_When_UpscaleModelUnknown_Expect_Rejected():
    result = UpscaleModel.from_string_result("../custom")
    assert not result.is_successful
    assert "Unsupported upscale model" in result.error


def _install(directory: Path, content: bytes, checksum_of: bytes | None = None) -> Path:
    path = directory / MODEL_FILENAME
    path.write_bytes(content)
    digest = hashlib.sha256(content if checksum_of is None else checksum_of).hexdigest()
    (directory / (MODEL_FILENAME + CHECKSUM_SUFFIX)).write_text(f"{digest}  {MODEL_FILENAME}\n")
    return path


def test_When_ModelFileMissing_Expect_FailureWithBuildHint(tmp_path, monkeypatch):
    monkeypatch.setenv(MODEL_HOME_ENV, str(tmp_path))

    result = locate_model()

    assert not result.is_successful
    assert str(tmp_path) in result.error
    assert "build_upscale_model.py" in result.error


def test_When_ModelFileMatchesChecksum_Expect_Path(tmp_path, monkeypatch):
    monkeypatch.setenv(MODEL_HOME_ENV, str(tmp_path))
    path = _install(tmp_path, b"graph")

    result = locate_model()

    assert result.is_successful
    assert result.value == path


def test_When_ModelFileIsCorrupt_Expect_FailureNotUsed(tmp_path, monkeypatch):
    monkeypatch.setenv(MODEL_HOME_ENV, str(tmp_path))
    _install(tmp_path, b"truncated", checksum_of=b"graph")

    result = locate_model()

    assert not result.is_successful
    assert "checksum" in result.error


def test_When_ChecksumFileMissing_Expect_FailureNotUsed(tmp_path, monkeypatch):
    monkeypatch.setenv(MODEL_HOME_ENV, str(tmp_path))
    (tmp_path / MODEL_FILENAME).write_bytes(b"graph")

    result = locate_model()

    assert not result.is_successful
    assert "no checksum file" in result.error


def test_When_RuntimeModelModuleLoaded_Expect_NoNetworkCode():
    source = Path(upscale_model.__file__).read_text(encoding="utf-8")

    assert "urllib" not in source
    assert "requests" not in source
    assert "http" not in source


# --- Model build script (runs in its own Docker build stage) ------------------------------

_BUILD_SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "build_upscale_model.py"


@pytest.fixture(scope="module")
def build_script():
    spec = importlib.util.spec_from_file_location("build_upscale_model", _BUILD_SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class _FakeResponse(BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()


def test_When_BuildScriptAndAppNameFiles_Expect_SameNames(build_script):
    assert build_script.ONNX_FILENAME == MODEL_FILENAME
    assert build_script.CHECKSUM_SUFFIX == CHECKSUM_SUFFIX
    assert build_script.WEIGHTS_URL.startswith("https://github.com/xinntao/Real-ESRGAN/releases/download/")
    for model in UpscaleModel:
        assert build_script.MODEL_SPECS[model.value]["name"] == model.model_name
    assert build_script.MODEL_SPECS["anime"]["num_conv"] == 16


def test_When_WeightsMatchPinnedChecksum_Expect_FileKept(build_script, tmp_path, monkeypatch):
    monkeypatch.setattr(build_script.urllib.request, "urlopen", lambda url, timeout: _FakeResponse(b"weights"))

    path = build_script.fetch_verified_weights(tmp_path, sha256=hashlib.sha256(b"weights").hexdigest())

    assert path.read_bytes() == b"weights"
    assert [p.name for p in tmp_path.iterdir()] == [build_script.WEIGHTS_FILENAME]


@pytest.mark.parametrize("model", list(UpscaleModel))
def test_When_WeightsChecksumWrong_Expect_ErrorAndNothingLeftToLoad(build_script, tmp_path, monkeypatch, model):
    monkeypatch.setattr(build_script.urllib.request, "urlopen", lambda url, timeout: _FakeResponse(b"tampered"))
    monkeypatch.setattr(
        build_script, "build_reference_model", lambda weights: pytest.fail("must not load unverified weights")
    )

    with pytest.raises(RuntimeError, match="Checksum mismatch"):
        build_script.build(tmp_path / "out", tmp_path / "cache", model.value)

    assert list((tmp_path / "cache").iterdir()) == []
    assert not (tmp_path / "out").exists()


def test_When_VerifiedWeightsCached_Expect_NoSecondDownload(build_script, tmp_path, monkeypatch):
    (tmp_path / build_script.WEIGHTS_FILENAME).write_bytes(b"weights")
    monkeypatch.setattr(
        build_script.urllib.request, "urlopen", lambda *args, **kwargs: pytest.fail("verified copy must be reused")
    )

    path = build_script.fetch_verified_weights(tmp_path, sha256=hashlib.sha256(b"weights").hexdigest())

    assert path.read_bytes() == b"weights"


def test_When_CachedWeightsTampered_Expect_DownloadedAgainAndChecked(build_script, tmp_path, monkeypatch):
    (tmp_path / build_script.WEIGHTS_FILENAME).write_bytes(b"tampered")
    monkeypatch.setattr(build_script.urllib.request, "urlopen", lambda url, timeout: _FakeResponse(b"weights"))

    path = build_script.fetch_verified_weights(tmp_path, sha256=hashlib.sha256(b"weights").hexdigest())

    assert path.read_bytes() == b"weights"


def _onnx_model(op_type: str, domain: str = ""):
    onnx = pytest.importorskip("onnx")
    from onnx import TensorProto, helper

    node = helper.make_node(op_type, ["x", "x"], ["y"], domain=domain)
    graph = helper.make_graph(
        [node],
        "g",
        [helper.make_tensor_value_info("x", TensorProto.FLOAT, [1])],
        [helper.make_tensor_value_info("y", TensorProto.FLOAT, [1])],
    )
    opsets = [helper.make_opsetid("", 17)] + ([helper.make_opsetid(domain, 1)] if domain else [])
    return onnx, helper.make_model(graph, opset_imports=opsets)


def test_When_GraphUsesOnlyAllowedOps_Expect_Accepted(build_script):
    _, model = _onnx_model("Add")

    build_script.check_graph(model)


@pytest.mark.parametrize(("op_type", "domain"), [("Mul", ""), ("Run", "com.example")])
def test_When_GraphHasUnexpectedOp_Expect_Rejected(build_script, op_type, domain):
    _, model = _onnx_model(op_type, domain)

    with pytest.raises(Exception):
        build_script.check_graph(model)


def test_When_AskingForModelStatus_Expect_NameAndAvailability():
    available = ConfigurationService("u2net", locate_upscale_model=lambda filename: Result.success(filename))
    missing = ConfigurationService("u2net", locate_upscale_model=lambda filename: Result.failure("missing"))

    assert available.get_upscale_model_status() == {
        "model_name": "realesr-general-x4v3", "available": True,
        "models": [{"id": model.value, "model_name": model.model_name, "available": True} for model in UpscaleModel],
    }
    assert missing.get_upscale_model_status()["available"] is False
    assert all(not model["available"] for model in missing.get_upscale_model_status()["models"])


def test_When_OnlyGeneralInstalled_Expect_AnimeUnavailable():
    service = ConfigurationService("u2net", locate_upscale_model=lambda filename:
                                   Result.success(filename) if filename == UpscaleModel.GENERAL.filename
                                   else Result.failure("missing"))
    assert [model["available"] for model in service.get_upscale_model_status()["models"]] == [True, False]


def test_When_SelectingModel_Expect_OnlyThatCheckpointLoaded(monkeypatch):
    selected = []
    monkeypatch.setattr(ai_upscaler, "locate_model", lambda filename: selected.append(filename) or Result.success(Path(filename)))
    monkeypatch.setattr(ai_upscaler._OrtSession, "get", lambda *args: SimpleNamespace(run=_nearest_4x))
    upscaler = AiUpscaler(_Logger())
    for model in [UpscaleModel.GENERAL, UpscaleModel.ANIME, UpscaleModel.GENERAL]:
        result = _decode(upscaler.upscale(_encode(_random_rgb(8, 6)), UpscaleTarget.X4, model))
        assert result.size == (32, 24)
    assert selected == [UpscaleModel.GENERAL.filename, UpscaleModel.ANIME.filename, UpscaleModel.GENERAL.filename]


# --- Upscaler with a fake model -----------------------------------------------------------


@pytest.mark.parametrize("size", [(37, 23), (256, 256), (300, 517), (700, 260)])
def test_When_UpscalingBy4InTiles_Expect_SameAsWholeImage(size):
    img = _random_rgb(*size)
    upscaler = AiUpscaler(_Logger(), run_model=_nearest_4x)

    result = upscaler.upscale_image(img, UpscalePlan(size, (size[0] * 4, size[1] * 4)))

    expected = np.asarray(img).repeat(4, axis=0).repeat(4, axis=1)
    assert np.array_equal(np.asarray(result), expected)


@pytest.mark.parametrize("output", [(1200, 1034), (600, 517), (1777, 3000)])
def test_When_UpscalingToOtherSize_Expect_TilesMatchSinglePass(output):
    img = _random_rgb(300, 517, seed=3).filter(ImageFilter.GaussianBlur(2))
    upscaler = AiUpscaler(_Logger(), run_model=_nearest_4x)

    result = np.asarray(upscaler.upscale_image(img, UpscalePlan(img.size, output))).astype(int)

    whole = Image.fromarray(np.asarray(img).repeat(4, axis=0).repeat(4, axis=1)).resize(output, Image.Resampling.LANCZOS)
    diff = np.abs(result - np.asarray(whole).astype(int))
    assert result.shape == (output[1], output[0], 3)
    # Float box edges round slightly differently per tile; invisible, but not bit-exact.
    assert diff.max() <= 2
    assert diff.mean() < 0.05


def test_When_Upscaling8x_Expect_OneModelPassPerTileAndNoSeams(monkeypatch):
    monkeypatch.setattr(ai_upscaler, "_TILE", 32)
    source = _random_rgb(63, 37).filter(ImageFilter.GaussianBlur(2))
    calls = []

    def _model(tile):
        calls.append(tile.shape)
        return _nearest_4x(tile)

    upscaler = AiUpscaler(_Logger(), run_model=_model)
    result = _decode(upscaler.upscale(_encode(source), UpscaleTarget.X8))
    whole = Image.fromarray(np.asarray(source).repeat(4, axis=0).repeat(4, axis=1))
    expected = whole.resize((504, 296), Image.Resampling.LANCZOS)

    assert result.size == (504, 296)
    assert len(calls) == 4
    assert np.abs(np.asarray(result).astype(int) - np.asarray(expected).astype(int)).max() <= 2


def test_When_TinyImageFillsLargeOutput_Expect_BoundedResizingWithoutSeams(monkeypatch):
    monkeypatch.setattr(ai_upscaler, "_OUTPUT_TILE", 128)
    source = _random_rgb(17, 11).filter(ImageFilter.GaussianBlur(2))
    output_size = (1501, 971)
    sizes = []
    original_resize = Image.Image.resize

    def _resize(image, size, *args, **kwargs):
        sizes.append(size)
        return original_resize(image, size, *args, **kwargs)

    monkeypatch.setattr(Image.Image, "resize", _resize)
    result = AiUpscaler(_Logger(), run_model=_nearest_4x).upscale_image(source, UpscalePlan(source.size, output_size))
    whole = Image.fromarray(np.asarray(source).repeat(4, axis=0).repeat(4, axis=1))
    expected = original_resize(whole, output_size, Image.Resampling.LANCZOS)

    assert len(sizes) > 1
    assert all(max(size) <= 128 for size in sizes)
    diff = np.abs(np.asarray(result).astype(int) - np.asarray(expected).astype(int))
    assert diff.max() <= 2
    assert diff.mean() < 0.05


def test_When_ConcurrentUpscales_Expect_DecodeWaitsUntilPreviousEncodingFinishes(monkeypatch):
    image_data = _encode(_random_rgb(20, 10))
    upscaler = AiUpscaler(_Logger(), run_model=_nearest_4x)
    encoding = threading.Event()
    second_waiting = threading.Event()
    release = threading.Event()
    decoded = []
    original_open = Image.open
    original_save = Image.Image.save
    original_exclusive = ai_upscaler._exclusive_inference

    def _open(*args, **kwargs):
        decoded.append(threading.current_thread().name)
        return original_open(*args, **kwargs)

    def _save(image, *args, **kwargs):
        if threading.current_thread().name == "first" and kwargs.get("format") == "TIFF":
            encoding.set()
            assert release.wait(5), "test did not release encoding"
        return original_save(image, *args, **kwargs)

    @contextmanager
    def _exclusive():
        if threading.current_thread().name == "second":
            second_waiting.set()
        with original_exclusive():
            yield

    def _run(name):
        threading.current_thread().name = name
        return upscaler.upscale(image_data, UpscaleTarget.X4)

    monkeypatch.setattr(Image, "open", _open)
    monkeypatch.setattr(Image.Image, "save", _save)
    monkeypatch.setattr(ai_upscaler, "_exclusive_inference", _exclusive)
    with ThreadPoolExecutor(max_workers=2) as pool:
        try:
            first = pool.submit(_run, "first")
            assert encoding.wait(5)
            second = pool.submit(_run, "second")
            assert second_waiting.wait(5)
            assert decoded == ["first"]
        finally:
            release.set()
        assert first.result(timeout=5)
        assert second.result(timeout=5)
    assert decoded == ["first", "second"]


def test_When_UpscalingImageWithColourProfile_Expect_ProfilePreserved():
    profile = b"sample ICC profile"
    image_data = _encode(_random_rgb(20, 10), icc_profile=profile)

    result = _decode(AiUpscaler(_Logger(), run_model=_nearest_4x).upscale(image_data, UpscaleTarget.X4))

    assert result.info["icc_profile"] == profile


@pytest.mark.parametrize(("mode", "colour"), [("L", 128), ("LA", (128, 255)), ("CMYK", (0, 200, 0, 0))])
def test_When_SourceProfileIsNotRgb_Expect_ProfileNotAttachedToRgbOutput(mode, colour):
    # Random bytes can't be parsed as a CMYK profile, so this also covers the fallback.
    image_data = _encode(Image.new(mode, (20, 10), colour), "TIFF", icc_profile=b"not an RGB profile")

    result = _decode(AiUpscaler(_Logger(), run_model=_nearest_4x).upscale(image_data, UpscaleTarget.X2))

    assert result.mode in ("RGB", "RGBA")
    assert result.size == (40, 20)
    assert "icc_profile" not in result.info


def test_When_CmykSourceHasProfile_Expect_ColourManagedToSrgb(monkeypatch):
    calls = []

    def _profile_to_profile(img, source, target, outputMode):
        calls.append((img.mode, outputMode))
        return Image.new("RGB", img.size, (1, 2, 3))

    monkeypatch.setattr(ai_upscaler.ImageCms, "ImageCmsProfile", lambda profile: object())
    monkeypatch.setattr(ai_upscaler.ImageCms, "profileToProfile", _profile_to_profile)
    image_data = _encode(Image.new("CMYK", (20, 10), (0, 200, 0, 0)), "JPEG", icc_profile=b"cmyk profile")

    result = _decode(AiUpscaler(_Logger(), run_model=_nearest_4x).upscale(image_data, UpscaleTarget.X2))

    assert calls == [("CMYK", "RGB")]
    assert result.getpixel((0, 0)) == (1, 2, 3)
    assert "icc_profile" not in result.info


_SYSTEM_CMYK_PROFILE = Path("/usr/share/color/icc/ghostscript/default_cmyk.icc")


@pytest.mark.skipif(not _SYSTEM_CMYK_PROFILE.is_file(), reason="no CMYK ICC profile on this machine")
def test_When_CmykSourceHasRealProfile_Expect_SrgbColours():
    profile = _SYSTEM_CMYK_PROFILE.read_bytes()
    # Pure magenta ink: naive conversion gives (255, 0, 255), a real profile a duller pink.
    image_data = _encode(Image.new("CMYK", (20, 10), (0, 255, 0, 0)), "JPEG", icc_profile=profile, quality=100)

    result = _decode(AiUpscaler(_Logger(), run_model=_nearest_4x).upscale(image_data, UpscaleTarget.X2))

    red, green, blue = result.convert("RGB").getpixel((20, 10))
    assert "icc_profile" not in result.info
    assert red > 180 and blue > 80 and green < 90
    assert (red, green, blue) != (255, 0, 255)


def test_When_ModelOutputLeavesRange_Expect_Clamped():
    upscaler = AiUpscaler(_Logger(), run_model=lambda tile: _nearest_4x(tile) * 3.0 - 1.0)
    img = Image.new("RGB", (10, 10), (20, 200, 240))

    result = np.asarray(upscaler.upscale_image(img, UpscalePlan((10, 10), (40, 40))))

    assert result[0, 0].tolist() == [0, 255, 255]


def test_When_UpscalingEncodedImage_Expect_TiffAtPlannedSize():
    upscaler = AiUpscaler(_Logger(), run_model=_nearest_4x)

    out = upscaler.upscale(_encode(_random_rgb(320, 180)), UpscaleTarget.UHD_4K)

    img = _decode(out)
    assert img.format == "TIFF"
    assert img.size == (3840, 2160)


def test_When_ImageAlreadyLargeEnough_Expect_NoneAndModelNotRun():
    def _fail(tile):
        raise AssertionError("model must not run")

    logger = _Logger()
    upscaler = AiUpscaler(logger, run_model=_fail)

    assert upscaler.upscale(_encode(_random_rgb(2000, 1100)), UpscaleTarget.FULL_HD) is None
    assert "left unchanged" in logger.messages[-1][1]


def test_When_OutputAboveConfiguredLimit_Expect_ValueErrorBeforeModelRuns():
    def _fail(tile):
        raise AssertionError("model must not run")

    upscaler = AiUpscaler(_Logger(), max_output_megapixels=1, run_model=_fail)

    with pytest.raises(ValueError, match="1 MP limit"):
        upscaler.upscale(_encode(_random_rgb(400, 300)), UpscaleTarget.X4)


def test_When_OutputAboveDefaultLimit_Expect_FailureBeforeModelLoads(monkeypatch):
    upscaler = AiUpscaler(_Logger())
    monkeypatch.setattr(upscaler, "_load_model", lambda: pytest.fail("must refuse before loading model"))

    # 16K by 9K = 144 MP is the default ceiling; 16004x9000 is just above it.
    with pytest.raises(ValueError, match="144 MP limit"):
        upscaler.upscale(_encode(Image.new("RGB", (4001, 2250))), UpscaleTarget.X4)


def test_When_OutputAtConfiguredLimit_Expect_UpscaleAllowed():
    upscaler = AiUpscaler(_Logger(), max_output_megapixels=1, run_model=_nearest_4x)

    result = _decode(upscaler.upscale(_encode(Image.new("RGB", (500, 500))), UpscaleTarget.X2))

    assert result.size == (1000, 1000)


def test_When_ModelNotInstalled_Expect_ValueErrorWithReason(tmp_path, monkeypatch):
    monkeypatch.setenv(MODEL_HOME_ENV, str(tmp_path))
    upscaler = AiUpscaler(_Logger())

    with pytest.raises(ValueError, match="not installed"):
        upscaler.upscale(_encode(_random_rgb(40, 30)), UpscaleTarget.X2)


def test_When_ImageHasAlpha_Expect_AlphaKeptAtNewSize():
    img = Image.new("RGBA", (40, 20), (200, 30, 30, 0))
    ImageDraw.Draw(img).rectangle((10, 5, 29, 14), fill=(200, 30, 30, 255))
    upscaler = AiUpscaler(_Logger(), run_model=_nearest_4x)

    out = _decode(upscaler.upscale(_encode(img), UpscaleTarget.X2))

    assert out.mode == "RGBA"
    assert out.size == (80, 40)
    alpha = np.asarray(out.getchannel("A"))
    assert alpha[0, 0] == 0
    assert alpha[20, 40] == 255


def test_When_SourceHasExifRotation_Expect_UprightOutput():
    img = _random_rgb(60, 20)
    exif = Image.Exif()
    exif[0x0112] = 6  # rotate 90 degrees clockwise when displayed
    upscaler = AiUpscaler(_Logger(), run_model=_nearest_4x)

    out = _decode(upscaler.upscale(_encode(img, "JPEG", exif=exif), UpscaleTarget.X2))

    assert out.size == (40, 120)


def test_When_Upscaling16BitGreyscale_Expect_GreyNotWhite():
    img = Image.new("I;16", (16, 16), 32768)
    upscaler = AiUpscaler(_Logger(), run_model=_nearest_4x)

    out = _decode(upscaler.upscale(_encode(img), UpscaleTarget.X2))

    assert 120 <= np.asarray(out.convert("L")).mean() <= 136


def test_When_ManyTiles_Expect_ProgressLogged():
    logger = _Logger()
    upscaler = AiUpscaler(logger, run_model=_nearest_4x)

    upscaler.upscale_image(_random_rgb(1100, 600), UpscalePlan((1100, 600), (4400, 2400)))

    progress = [message for _, message in logger.messages if "tiles" in message]
    assert progress[-1] == "AI upscaling: 15/15 tiles"


# --- Threads and execution providers ------------------------------------------------------


@pytest.mark.parametrize(("cpu_max", "expected"), [("max 100000", None), ("200000 100000", 2), ("50000 100000", 1), ("350000 100000", 3), ("garbage", None)])
def test_When_ReadingCgroupQuota_Expect_WholeCpus(cpu_max, expected):
    assert cgroup_cpu_limit(cpu_max) == expected


def test_When_ThreadsConfigured_Expect_ThatCount():
    assert resolve_thread_count(3) == 3


def test_When_ThreadsAuto_Expect_AvailableCpusCappedAt8(monkeypatch):
    monkeypatch.setattr(ai_upscaler, "available_cpu_count", lambda: 64)
    assert resolve_thread_count(None) == 8

    monkeypatch.setattr(ai_upscaler, "available_cpu_count", lambda: 2)
    assert resolve_thread_count(None) == 2


class _FakeSession:
    def __init__(self, providers, fail_run=False):
        self._providers = providers
        self._fail_run = fail_run

    def get_providers(self):
        return self._providers

    def get_inputs(self):
        return [SimpleNamespace(name="input")]

    def run(self, outputs, feeds):
        if self._fail_run:
            raise RuntimeError("device lost")
        return [_nearest_4x(feeds["input"])]


def _fake_ort(available, create):
    return SimpleNamespace(
        get_available_providers=lambda: available,
        SessionOptions=lambda: SimpleNamespace(),
        ExecutionMode=SimpleNamespace(ORT_SEQUENTIAL="sequential"),
        InferenceSession=create,
    )


def test_When_OnlyCpuAvailable_Expect_CpuSession(monkeypatch, tmp_path):
    created = []

    def _create(path, options, providers):
        created.append(providers)
        return _FakeSession(providers)

    monkeypatch.setitem(__import__("sys").modules, "onnxruntime", _fake_ort(["CPUExecutionProvider"], _create))

    session = ai_upscaler._OrtSession(tmp_path / "m.onnx", 2, _Logger())

    assert created == [["CPUExecutionProvider"]]
    assert session.providers == ["CPUExecutionProvider"]


def test_When_SwitchingCachedModels_Expect_SessionUsesSelectedCheckpoint(monkeypatch, tmp_path):
    created = []
    def _create(path, options, providers):
        created.append(Path(path).name)
        return _FakeSession(providers)
    monkeypatch.setitem(__import__("sys").modules, "onnxruntime", _fake_ort(["CPUExecutionProvider"], _create))
    monkeypatch.setattr(ai_upscaler._OrtSession, "_instance", None)
    general = tmp_path / UpscaleModel.GENERAL.filename
    anime = tmp_path / UpscaleModel.ANIME.filename
    first = ai_upscaler._OrtSession.get(general, 2, _Logger())
    assert ai_upscaler._OrtSession.get(general, 2, _Logger()) is first
    ai_upscaler._OrtSession.get(anime, 2, _Logger())
    final = ai_upscaler._OrtSession.get(general, 2, _Logger())
    assert final is not first
    assert created == [general.name, anime.name, general.name]


def test_When_GpuSessionCannotBeCreated_Expect_CpuFallback(monkeypatch, tmp_path):
    def _create(path, options, providers):
        if "CUDAExecutionProvider" in providers:
            raise RuntimeError("libcudart.so not found")
        return _FakeSession(providers)

    logger = _Logger()
    monkeypatch.setitem(
        __import__("sys").modules, "onnxruntime", _fake_ort(["CUDAExecutionProvider", "CPUExecutionProvider"], _create)
    )

    session = ai_upscaler._OrtSession(tmp_path / "m.onnx", 2, logger)

    assert session.providers == ["CPUExecutionProvider"]
    assert any(level == "warning" and "using CPU" in message for level, message in logger.messages)


def test_When_GpuRunFails_Expect_SwitchToCpuAndResult(monkeypatch, tmp_path):
    def _create(path, options, providers):
        return _FakeSession(providers, fail_run="DmlExecutionProvider" in providers)

    monkeypatch.setitem(
        __import__("sys").modules, "onnxruntime", _fake_ort(["DmlExecutionProvider", "CPUExecutionProvider"], _create)
    )
    session = ai_upscaler._OrtSession(tmp_path / "m.onnx", 2, _Logger())
    tile = np.zeros((1, 3, 4, 4), dtype=np.float32)

    assert session.run(tile).shape == (1, 3, 16, 16)
    assert session.providers == ["CPUExecutionProvider"]


# --- Config ---------------------------------------------------------------------------------


def _load_config(tmp_path, upscaling=None):
    from backend.image_converter.config.loader import load_from_file

    data = json.loads((settings._DEFAULT_CONFIG_PATH).read_text(encoding="utf-8"))
    data.pop("upscaling", None)
    if upscaling is not None:
        data["upscaling"] = upscaling
    path = tmp_path / "app.json"
    path.write_text(json.dumps(data), encoding="utf-8")
    return load_from_file(path)


def test_When_UpscalingBlockMissing_Expect_AutoThreadsAnd144Megapixels(tmp_path):
    config = _load_config(tmp_path)

    assert config.upscaling.threads is None
    assert config.upscaling.max_output_megapixels == 144


def test_When_DefaultConfigLoaded_Expect_16KUpscaleAllowed():
    config = settings.get()
    upscaler = AiUpscaler(_Logger(), max_output_megapixels=config.upscaling.max_output_megapixels)

    plan = plan_upscale(3840, 2160, UpscaleTarget.UHD_16K, upscaler.max_output_pixels)

    assert plan.is_successful
    assert plan.value.output_size == (15360, 8640)
    assert upscaler.max_output_pixels == 144_000_000


def test_When_UpscalingConfigured_Expect_Values(tmp_path):
    config = _load_config(tmp_path, {"threads": 2, "max_output_megapixels": 20})

    assert config.upscaling.threads == 2
    assert config.upscaling.max_output_megapixels == 20


@pytest.mark.parametrize("upscaling", [{"threads": 0}, {"threads": "many"}, {"max_output_megapixels": 0}])
def test_When_UpscalingConfigInvalid_Expect_ConfigError(tmp_path, upscaling):
    from backend.image_converter.config.loader import ConfigError

    with pytest.raises(ConfigError, match="upscaling"):
        _load_config(tmp_path, upscaling)


# --- Service, use case and CLI wiring ------------------------------------------------------


def _form_data(image_format: ImageFormat, **overrides) -> CompressionFormData:
    values = dict(
        uploaded_files=(),
        quality=85,
        width=800,
        image_format=image_format,
        target_size_kb=None,
        use_rembg=False,
        pdf_preset="",
        pdf_scale="",
        pdf_margin_mm=10.0,
        pdf_paginate=False,
    )
    values.update(overrides)
    return CompressionFormData(**values)


class _CapturingUseCase:
    def __init__(self):
        self.request = None

    def execute(self, req):
        from backend.image_converter.application.dtos import CompressResult

        self.request = req
        return CompressResult(processed_files=[], errors=["captured"])


class _TempFolders:
    def __init__(self, root):
        self.root = root
        self.count = 0

    def create_temp_dir(self, prefix: str) -> str:
        self.count += 1
        path = self.root / f"{prefix}{self.count}"
        path.mkdir()
        return str(path)


def test_When_CompressingPdfWithUpscale_Expect_Rejected():
    service = CompressionService(DummyLogger(), use_case=None, temp_folder_service=None)

    result = service.compress(_form_data(ImageFormat.PDF, upscale="4x"))

    assert not result.is_successful
    assert "PDF" in result.error


def test_When_CompressingWithUnknownUpscale_Expect_Rejected():
    service = CompressionService(DummyLogger(), use_case=None, temp_folder_service=None)

    result = service.compress(_form_data(ImageFormat.JPEG, upscale="16x"))

    assert not result.is_successful
    assert "Unsupported upscale option" in result.error


def test_When_CompressingWithUnknownModel_Expect_RejectedBeforeProcessing():
    service = CompressionService(DummyLogger(), use_case=None, temp_folder_service=None)
    result = service.compress(_form_data(ImageFormat.JPEG, upscale="4x", upscale_model="unknown"))
    assert not result.is_successful
    assert "Unsupported upscale model" in result.error


@pytest.mark.parametrize("model", list(UpscaleModel))
def test_When_CompressingWithSelectedModel_Expect_ModelPassed(tmp_path, model):
    use_case = _CapturingUseCase()
    service = CompressionService(DummyLogger(), use_case=use_case, temp_folder_service=_TempFolders(tmp_path))
    service.compress(_form_data(ImageFormat.JPEG, upscale="4x", upscale_model=model.value))
    assert use_case.request.upscale_model == model


@pytest.mark.parametrize("target", list(UpscaleTarget))
def test_When_CompressingWithUpscale_Expect_TargetPassedAndWidthDropped(tmp_path, target):
    use_case = _CapturingUseCase()
    service = CompressionService(DummyLogger(), use_case=use_case, temp_folder_service=_TempFolders(tmp_path))

    service.compress(_form_data(ImageFormat.PNG, upscale=target.value))

    assert use_case.request.upscale == target
    assert use_case.request.width is None


def test_When_CompressingWithoutUpscale_Expect_WidthKept(tmp_path):
    use_case = _CapturingUseCase()
    service = CompressionService(DummyLogger(), use_case=use_case, temp_folder_service=_TempFolders(tmp_path))

    service.compress(_form_data(ImageFormat.JPEG))

    assert use_case.request.upscale is None
    assert use_case.request.width == 800


@pytest.mark.parametrize(
    ("upscaled", "background_removed", "page", "expected"),
    [
        (True, False, None, "photo_ai-upscaled.png"),
        (True, True, None, "photo_ai-upscaled_ai-bg-removed.png"),
        (True, False, 2, "photo_ai-upscaled_page-2.png"),
        (False, False, None, "photo.png"),
    ],
)
def test_When_BuildingOutputName_Expect_UpscaledSuffix(upscaled, background_removed, page, expected):
    name = CompressImagesUseCase._build_dest_name("photo", ".png", page, background_removed, upscaled=upscaled)

    assert name == expected


def test_When_CliProcessorUpscales_Expect_OutputAtPlannedSize(tmp_path, monkeypatch):
    source = tmp_path / "frame.png"
    _random_rgb(64, 36).save(source)
    destination = tmp_path / "out"
    processor = ImageConversionProcessor(
        source=str(source),
        destination=str(destination),
        image_format=ImageFormat.JPEG,
        upscale=UpscaleTarget.X4,
    )
    monkeypatch.setattr(processor, "_get_upscaler", lambda: AiUpscaler(_Logger(), run_model=_nearest_4x))

    processor.run()

    with Image.open(destination / "frame.jpg") as out:
        assert out.size == (256, 144)
    assert processor.results[0].resized_width == 256


@pytest.mark.parametrize("target", list(UpscaleTarget))
def test_When_CliGetsUpscale_Expect_ProcessorReceivesTargetAndNoWidth(monkeypatch, target):
    from backend.image_converter.presentation.cli import app

    captured = {}

    class _Processor:
        def __init__(self, **kwargs):
            captured.update(kwargs)

        def run(self):
            pass

    monkeypatch.setattr(app, "ImageConversionProcessor", _Processor)

    app.main(["in", "out", "--width", "300", "--upscale", target.value])

    assert captured["upscale"] == target
    assert captured["width"] is None
    assert captured["upscale_model"] == UpscaleModel.GENERAL


def test_When_CliSelectsAnime_Expect_ProcessorReceivesModel(monkeypatch):
    from backend.image_converter.presentation.cli import app
    captured = {}
    class _Processor:
        def __init__(self, **kwargs):
            captured.update(kwargs)
        def run(self):
            pass
    monkeypatch.setattr(app, "ImageConversionProcessor", _Processor)
    app.main(["in", "out", "--upscale", "4x", "--upscale-model", "anime"])
    assert captured["upscale_model"] == UpscaleModel.ANIME


@pytest.mark.parametrize("argv", [["in", "out", "--upscale", "4k", "--format", "pdf"]])
def test_When_CliUpscaleWithPdf_Expect_ExitWithError(argv):
    from backend.image_converter.presentation.cli import app

    with pytest.raises(SystemExit) as exc:
        app.main(argv)

    assert exc.value.code == 1


# --- Real model (runs where the model is installed, e.g. inside the Docker image) ----------

_model_missing = not locate_model().is_successful
_needs_model = pytest.mark.skipif(_model_missing, reason="AI upscaling model not installed")


def _test_card(width: int, height: int) -> Image.Image:
    """Sharp edges, thin lines and text: things bicubic blurs and the model should not."""
    img = Image.new("RGB", (width, height), (245, 245, 240))
    draw = ImageDraw.Draw(img)
    for x in range(4, width, 9):
        draw.line((x, 0, x, height // 2), fill=(30, 30, 30), width=1)
    draw.rectangle((width // 8, height * 5 // 8, width * 3 // 8, height * 7 // 8), fill=(200, 40, 40))
    draw.ellipse((width // 2, height // 2, width * 7 // 8, height - 4), outline=(20, 60, 160), width=2)
    draw.text((width // 2, 6), "imgcompress", fill=(0, 0, 0))
    return img


def _laplacian_energy(img: Image.Image) -> float:
    grey = np.asarray(img.convert("L"), dtype=np.float32)
    lap = 4 * grey[1:-1, 1:-1] - grey[:-2, 1:-1] - grey[2:, 1:-1] - grey[1:-1, :-2] - grey[1:-1, 2:]
    return float(np.mean(lap**2))


def _psnr(a: Image.Image, b: Image.Image) -> float:
    diff = np.asarray(a, dtype=np.float32) - np.asarray(b, dtype=np.float32)
    return float(10 * np.log10(255.0**2 / max(np.mean(diff**2), 1e-9)))


@_needs_model
@pytest.mark.parametrize("model", list(UpscaleModel))
def test_When_RealModelUpscales4x_Expect_SharperThanBicubicAndFaithful(model):
    if not locate_model(model.filename).is_successful:
        pytest.skip(f"{model.model_name} not installed")
    source = _test_card(160, 90)
    upscaler = AiUpscaler(_Logger(), threads=2)

    ai = _decode(upscaler.upscale(_encode(source), UpscaleTarget.X4, model))
    bicubic = source.resize(ai.size, Image.Resampling.BICUBIC)

    assert ai.size == (640, 360)
    assert _laplacian_energy(ai) > 2 * _laplacian_energy(bicubic)
    # Shrinking the result back must give roughly the original, i.e. no invented content.
    assert _psnr(ai.resize(source.size, Image.Resampling.BOX).convert("RGB"), source) > 25


@_needs_model
@pytest.mark.parametrize("selected", list(UpscaleModel))
def test_When_RealModelRunsTiled_Expect_NoSeams(selected):
    if not locate_model(selected.filename).is_successful:
        pytest.skip(f"{selected.model_name} not installed")
    source = _test_card(300, 300)
    upscaler = AiUpscaler(_Logger(), threads=2)
    model = upscaler._load_model(selected)
    whole = model(np.asarray(source, dtype=np.float32).transpose(2, 0, 1)[None] / 255.0)[0]
    whole = (np.clip(whole, 0, 1) * 255 + 0.5).astype(np.uint8).transpose(1, 2, 0)

    tiled = np.asarray(upscaler.upscale_image(source, UpscalePlan((300, 300), (1200, 1200)), selected))

    assert np.abs(tiled.astype(int) - whole.astype(int)).max() <= 1
