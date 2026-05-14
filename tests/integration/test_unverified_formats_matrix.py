"""Reader smoke test for the "Other possible formats" surface.

imgcompress only outputs to a small set of verified formats
(JPEG/PNG/WebP/AVIF/PDF/ICO). The long tail listed in the UI under "Other
possible formats" are **input** formats — extensions whose decoders Pillow
claims to register but that have never been exercised in tests
("These haven't been fully tested yet, but they might work!"). What we care
about here is one thing only:

    Does the running docker image have all the libraries needed to read
    these files and convert them into a usable PNG?

That is a smoke test, not a correctness suite. It does not assert anything
about output writers for these extensions (we don't ship those), it just
proves the reader path works end-to-end through the CLI.

Strategy:
  1. Build the same `supported_extensions - verified_formats` list the
     backend serves to the UI.
  2. Synthesize one RGBA-with-transparency 256x256 test image and save it
     under each extension. Fall through pixel modes (RGBA -> RGB -> LA -> L
     -> P -> 1) so format constraints (e.g. XBM = 1-bit only, GIF = palette)
     do not block us.
  3. If no mode produced a non-empty file, Pillow has no writer for that
     extension. The test for it is skipped with a clear reason — we cannot
     fabricate a fixture out of thin air for a read-only format.
  4. After saving each input, re-open it to detect whether alpha actually
     survived the save (so we know whether to assert alpha-preservation on
     the way out).
  5. Run the docker CLI once over the folder, converting everything to PNG.
  6. Per-extension assertions:
       - The CLI produced a PNG output for this input.
       - The output is not blank (max per-channel std-dev > 5).
       - If the input file carried alpha, the PNG output also carries alpha
         (the reader preserved transparency).

The matrix runs in its own non-blocking CI job
(`test-unverified-formats-smoke`, `continue-on-error: true`) so a failing
exotic format is informational, not a merge blocker.
"""

from __future__ import annotations

import importlib.util
import os
import shlex
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Optional

import pytest
from PIL import Image, ImageDraw, ImageStat


# Mirrored from
# backend/image_converter/presentation/web/services/configuration_service.py.
# If that list grows, freshly-verified extensions automatically drop out of
# the smoke matrix.
_VERIFIED_FORMATS = {
    ".heic", ".heif", ".png", ".jpg", ".jpeg",
    ".ico", ".eps", ".psd", ".pdf", ".avif",
}


def _supported_extensions() -> list[str]:
    """Same logic as backend.image_converter.core.internals.utilities."""
    formats = [
        ext.lower()
        for ext, fmt in Image.registered_extensions().items()
        if fmt.upper() in Image.OPEN
    ]
    formats.append(".pdf")
    if importlib.util.find_spec("pillow_heif") is not None:
        formats.extend([".heic", ".heif"])
    return sorted(set(formats))


_UNVERIFIED = sorted(set(_supported_extensions()) - _VERIFIED_FORMATS)


@dataclass
class _SynthesizedInput:
    output_path: Path
    input_had_alpha: bool


def _make_distinctive_rgba() -> Image.Image:
    """256x256 RGBA image with strong color variation and real transparency
    so we can assert both 'not blank' and 'alpha preserved' on the output."""
    img = Image.new("RGBA", (256, 256), (0, 0, 0, 255))
    px = img.load()
    # Gradient RGB content covering most of the canvas — guarantees high
    # stddev on output even after palette quantization on legacy formats.
    for x in range(256):
        for y in range(256):
            px[x, y] = (
                (x * 3) % 256,
                (y * 5) % 256,
                ((x + y) * 2) % 256,
                255,
            )
    # Fully-transparent strip on the right edge so any format that supports
    # alpha will record a real alpha=0 region we can check on the way out.
    for x in range(200, 256):
        for y in range(256):
            r, g, b, _ = px[x, y]
            px[x, y] = (r, g, b, 0)
    # Semi-transparent vertical band in the middle (alpha=128).
    for x in range(110, 150):
        for y in range(256):
            r, g, b, _ = px[x, y]
            px[x, y] = (r, g, b, 128)

    draw = ImageDraw.Draw(img)
    draw.rectangle([20, 20, 100, 100], outline=(0, 0, 0, 255), width=4)
    draw.rectangle([30, 30, 90, 90], fill=(255, 255, 255, 255))
    return img


def _try_save_in_modes(base_rgba: Image.Image, target: Path) -> bool:
    """Save `base_rgba` to `target`, walking through pixel modes that
    different writers require. Returns True iff some mode produced a
    non-empty file."""
    candidates = [
        base_rgba,
        base_rgba.convert("RGB"),
        base_rgba.convert("LA"),
        base_rgba.convert("L"),
        base_rgba.convert("P"),
        base_rgba.convert("1"),
    ]
    for img in candidates:
        try:
            if target.exists():
                target.unlink()
            img.save(target)
        except Exception:
            continue
        if target.exists() and target.stat().st_size > 0:
            return True
    if target.exists():
        target.unlink()
    return False


def _saved_file_has_alpha(target: Path) -> bool:
    """Read the input file back to see whether alpha actually survived the
    save. The Pillow writer for some formats silently drops alpha; we only
    want to assert preservation on inputs where alpha is genuinely present."""
    try:
        with Image.open(target) as img:
            # 'transparency' info means an indexed format (GIF) is using a
            # palette index as transparent.
            return (
                img.mode in ("RGBA", "LA", "PA")
                or "transparency" in img.info
            )
    except Exception:
        return False


@pytest.mark.skipif(
    shutil.which("docker") is None,
    reason="docker not available",
)
class TestUnverifiedFormatsMatrix:
    INTEGRATION_TESTS_DIR = os.path.dirname(os.path.abspath(__file__))
    PROJECT_ROOT = os.path.abspath(
        os.path.join(INTEGRATION_TESTS_DIR, "..", "..")
    )
    DOCKER_IMAGE_NAME = "karimz1/imgcompress:local-test"
    INPUT_DIRNAME = "unverified_formats_inputs"
    OUTPUT_DIRNAME = "unverified_formats_outputs"

    def _container_exists(self, name: str) -> bool:
        try:
            return (
                subprocess.run(
                    ["docker", "container", "inspect", name],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    check=False,
                ).returncode
                == 0
            )
        except Exception:
            return False

    def _mounting_strategy(self, input_dir: Path, output_dir: Path):
        running_in_container = os.path.exists("/.dockerenv")
        if running_in_container:
            container_name = os.environ.get("HOSTNAME")
            if container_name and self._container_exists(container_name):
                return {
                    "volume_args": ["--volumes-from", container_name],
                    "input_path": str(input_dir),
                    "output_path": str(output_dir),
                }
            raise RuntimeError(
                "Running inside a container but could not determine container name for --volumes-from"
            )
        return {
            "volume_args": [
                "-v", f"{input_dir}:/container/input_folder",
                "-v", f"{output_dir}:/container/output_folder",
            ],
            "input_path": "/container/input_folder",
            "output_path": "/container/output_folder",
        }

    @pytest.fixture(scope="class")
    def converted_outputs(self, tmp_path_factory) -> Dict[str, Optional[_SynthesizedInput]]:
        """Synthesize one input file per unverified extension, then run one
        docker CLI invocation to convert the whole folder to PNG. Returns:

            { ".bmp": _SynthesizedInput(output_path, input_had_alpha),
              ".grib": None,   # Pillow has no writer; reader is untestable
              ... }
        """
        scratch = tmp_path_factory.mktemp("unverified-formats")
        input_dir = scratch / self.INPUT_DIRNAME
        output_dir = scratch / self.OUTPUT_DIRNAME
        input_dir.mkdir(parents=True, exist_ok=True)
        output_dir.mkdir(parents=True, exist_ok=True)

        results: Dict[str, Optional[_SynthesizedInput]] = {ext: None for ext in _UNVERIFIED}
        synthesized: list[str] = []
        base_rgba = _make_distinctive_rgba()

        for ext in _UNVERIFIED:
            target_input = input_dir / f"unverified_{ext.lstrip('.')}{ext}"
            if not _try_save_in_modes(base_rgba, target_input):
                # No writer — leave results[ext] as None, test will skip.
                continue
            synthesized.append(ext)
            input_had_alpha = _saved_file_has_alpha(target_input)
            expected_output = output_dir / f"unverified_{ext.lstrip('.')}.png"
            results[ext] = _SynthesizedInput(
                output_path=expected_output,
                input_had_alpha=input_had_alpha,
            )

        if not synthesized:
            pytest.skip("Pillow could not synthesize any unverified format - nothing to test")

        running_in_container = os.path.exists("/.dockerenv")
        if running_in_container:
            # Inside a devcontainer, /tmp may not be mounted into the docker
            # socket peer. Move inputs into the workspace tree so the
            # --volumes-from mount can see them.
            workspace_input = (
                Path(self.PROJECT_ROOT) / "tests" / "output" / self.INPUT_DIRNAME
            )
            workspace_output = (
                Path(self.PROJECT_ROOT) / "tests" / "output" / self.OUTPUT_DIRNAME
            )
            shutil.rmtree(workspace_input, ignore_errors=True)
            shutil.rmtree(workspace_output, ignore_errors=True)
            workspace_input.mkdir(parents=True, exist_ok=True)
            workspace_output.mkdir(parents=True, exist_ok=True)
            for entry in input_dir.iterdir():
                shutil.copy2(entry, workspace_input / entry.name)
            for ext, val in list(results.items()):
                if val is not None:
                    results[ext] = _SynthesizedInput(
                        output_path=workspace_output / val.output_path.name,
                        input_had_alpha=val.input_had_alpha,
                    )
            input_dir = workspace_input
            output_dir = workspace_output

        strategy = self._mounting_strategy(input_dir, output_dir)
        cmd = [
            "docker", "run", "--rm",
            *strategy["volume_args"],
            self.DOCKER_IMAGE_NAME,
            "cli",
            strategy["input_path"],
            strategy["output_path"],
            "--format", "png",
            "--quality", "80",
        ]
        print("Unverified-formats reader smoke cmd:", shlex.join(cmd))
        completed = subprocess.run(cmd, check=False, capture_output=True, text=True)
        if completed.returncode != 0:
            pytest.fail(
                "docker CLI exited non-zero processing unverified-formats batch: "
                f"code={completed.returncode}\n"
                f"stdout:\n{completed.stdout}\n"
                f"stderr:\n{completed.stderr}"
            )

        return results

    @pytest.mark.parametrize("ext", _UNVERIFIED)
    def test_reader_for_extension_produces_visible_png(self, converted_outputs, ext):
        """For each unverified input extension: the CLI can read it and the
        output PNG is non-blank. If the input had alpha, the PNG keeps it."""
        synth = converted_outputs[ext]
        if synth is None:
            pytest.skip(
                f"Pillow has no writer for {ext} - cannot synthesize an input "
                "to feed the reader. A real fixture file would be required."
            )

        out = synth.output_path
        if not out.exists():
            pytest.fail(
                f"CLI did not produce output for {ext} (reader path missing or "
                f"broken in the container). Expected: {out}\n"
                f"Folder contents: {sorted(p.name for p in out.parent.iterdir())}"
            )

        with Image.open(out) as out_img:
            assert out_img.format and out_img.format.upper() == "PNG", (
                f"{ext} -> expected PNG output, got format={out_img.format!r}"
            )
            assert out_img.width >= 8 and out_img.height >= 8, (
                f"{ext} -> implausibly small output: {out_img.width}x{out_img.height}"
            )

            stat = ImageStat.Stat(out_img.convert("RGB"))
            max_std = max(stat.stddev)
            assert max_std > 5.0, (
                f"{ext} -> output looks blank/uniform "
                f"(per-channel stddev={stat.stddev})"
            )

            if synth.input_had_alpha:
                # The input carried alpha info; the reader must preserve it
                # all the way through to the PNG. Otherwise users converting,
                # say, a transparent .tga lose transparency silently.
                converted_mode = out_img.mode
                assert "A" in converted_mode or "transparency" in out_img.info, (
                    f"{ext} -> input had alpha, but output PNG dropped it "
                    f"(output mode={converted_mode!r}, info keys={list(out_img.info)})"
                )
