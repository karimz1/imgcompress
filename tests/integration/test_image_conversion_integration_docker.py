import os
import glob
import shlex
import shutil
import subprocess

import pytest
from PIL import Image, ImageDraw

from tests.pillow_samples import generate_pillow_samples
from backend.image_converter.core.internals.utls import is_file_supported
from backend.image_converter.core.internals.utls import load_supported_formats
from tests.test_utils import (
    validate_image_dimensions,
    create_sample_test_image,
    is_github_actions,
)

# ----------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------

def _generated_samples(dirpath: str) -> list[str]:
    """
    Return all generated Pillow sample files in dirpath (used for parametrize).
    """
    return sorted(os.path.basename(p) for p in glob.glob(os.path.join(dirpath, "sample_*")))


# ----------------------------------------------------------------------
# Integration tests
# ----------------------------------------------------------------------

class TestDockerIntegration:
    INTEGRATION_TESTS_DIR = os.path.dirname(os.path.abspath(__file__))
    PROJECT_ROOT = os.path.abspath(os.path.join(INTEGRATION_TESTS_DIR, "..", ".."))
    DOCKER_IMAGE_NAME = "karimz1/imgcompress:local-test"
    DOCKER_CONTEXT = PROJECT_ROOT
    DOCKERFILE_PATH = os.path.join(PROJECT_ROOT, "Dockerfile")

    SAMPLE_IMAGES_DIR = os.path.join(PROJECT_ROOT, "tests", "sample-images")
    OUTPUT_DIR = os.path.join(PROJECT_ROOT, "tests", "output")
    EXPECTED_IMAGE_WIDTH = 800
    DEVCONTAINER_NAME = "devcontainer"

    # ------------------------------------------------------------------
    # Fixtures
    # ------------------------------------------------------------------

    @pytest.fixture(scope="session", autouse=True)
    def build_docker_image(self):
        """
        Build the Docker image once before running tests.
        """
        print(f"Building Docker image from context: {self.DOCKER_CONTEXT}")
        cmd = [
            "docker", "build",
            "-t", self.DOCKER_IMAGE_NAME,
            "-f", self.DOCKERFILE_PATH,
            self.DOCKER_CONTEXT,
            "--no-cache",
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        print("docker build command:", shlex.join(cmd))
        print("Docker build stdout:\n", result.stdout)
        print("Docker build stderr:\n", result.stderr)
        if result.returncode != 0:
            raise RuntimeError(f"Docker build failed:\n{result.stderr}")

    @pytest.fixture(scope="function", autouse=True)
    def setup_environment(self):
        """
        Before each test: clean output dir, ensure sample-images exists,
        and populate it with baseline + Pillow-generated samples.
        """
        if os.path.exists(self.OUTPUT_DIR):
            print("Removing existing output folder...")
            shutil.rmtree(self.OUTPUT_DIR)
        os.makedirs(self.OUTPUT_DIR, exist_ok=True)

        assert os.path.exists(self.SAMPLE_IMAGES_DIR), "SAMPLE_IMAGES_DIR does not exist."

        # Create a baseline PNG
        img_path = os.path.join(self.SAMPLE_IMAGES_DIR, "test_image.png")
        create_sample_test_image(img_path)
        assert os.path.exists(img_path), f"Failed to create test image at {img_path}"

        # Generate one sample per supported Pillow format
        generate_pillow_samples(self.SAMPLE_IMAGES_DIR, is_file_supported)

        sample_files = os.listdir(self.SAMPLE_IMAGES_DIR)
        print(f"Contents of SAMPLE_IMAGES_DIR: {sample_files}")

    # ------------------------------------------------------------------
    # Internal runners
    # ------------------------------------------------------------------

    def run_docker_folder_processing(self):
        """
        Run the docker image to process the entire SAMPLE_IMAGES_DIR into OUTPUT_DIR.
        """
        if is_github_actions():
            print("Running within GitHub Actions.")
            cmd = [
                "docker", "run", "--rm",
                "--volumes-from", self.DEVCONTAINER_NAME,
                self.DOCKER_IMAGE_NAME,
                self.SAMPLE_IMAGES_DIR,
                self.OUTPUT_DIR,
                "--quality", str(80),
                "--width", str(self.EXPECTED_IMAGE_WIDTH),
            ]
        else:
            print("Running locally...")
            cmd = [
                "docker", "run", "--rm",
                "-v", f"{self.SAMPLE_IMAGES_DIR}:/container/input_folder",
                "-v", f"{self.OUTPUT_DIR}:/container/output_folder",
                self.DOCKER_IMAGE_NAME,
                "/container/input_folder/",
                "/container/output_folder",
                "--quality", str(80),
                "--width", str(self.EXPECTED_IMAGE_WIDTH),
            ]
        print("Docker run command:", shlex.join(cmd))
        subprocess.run(cmd, check=True)

    def run_docker_singlefile_processing(self, single_file_name: str, extra_args=None):
        """
        Run the docker image to process a single file from SAMPLE_IMAGES_DIR into OUTPUT_DIR.
        Default format: jpeg.
        """
        extra_args = extra_args or ["--format", "jpeg"]

        if is_github_actions():
            cmd = [
                "docker", "run", "--rm",
                "--volumes-from", self.DEVCONTAINER_NAME,
                self.DOCKER_IMAGE_NAME,
                os.path.join(self.SAMPLE_IMAGES_DIR, single_file_name),
                self.OUTPUT_DIR,
                "--quality", "80",
                "--width", str(self.EXPECTED_IMAGE_WIDTH),
            ] + extra_args
        else:
            cmd = [
                "docker", "run", "--rm",
                "-v", f"{self.SAMPLE_IMAGES_DIR}:/container/input_folder",
                "-v", f"{self.OUTPUT_DIR}:/container/output_folder",
                self.DOCKER_IMAGE_NAME,
                f"/container/input_folder/{single_file_name}",
                "/container/output_folder",
                "--quality", "80",
                "--width", str(self.EXPECTED_IMAGE_WIDTH),
            ] + extra_args

        print("Docker single-file command:", shlex.join(cmd))
        subprocess.run(cmd, check=True)

    # ------------------------------------------------------------------
    # Tests
    # ------------------------------------------------------------------

    def test_files_created(self):
        """Ensure at least one file is created in OUTPUT_DIR after folder processing."""
        self.run_docker_folder_processing()
        output_files = os.listdir(self.OUTPUT_DIR)
        print(f"Contents of OUTPUT_DIR after run: {output_files}")
        assert output_files, "No files were created in the output directory."

    def test_file_count_matches(self):
        """
        Ensure processed file count matches supported inputs, and log details for unsupported/skipped files.
        """
       

        self.run_docker_folder_processing()
        output_files = set(os.listdir(self.OUTPUT_DIR))

        supported_exts = set(load_supported_formats())
        sample_files = []
        unsupported_files = []
        for f in os.listdir(self.SAMPLE_IMAGES_DIR):
            path = os.path.join(self.SAMPLE_IMAGES_DIR, f)
            if not os.path.isfile(path):
                continue
            _, ext = os.path.splitext(f)
            if ext.lower() in supported_exts:
                sample_files.append(f)
            else:
                unsupported_files.append(f)

        sample_basenames = {os.path.splitext(f)[0] for f in sample_files}
        output_basenames = {os.path.splitext(f)[0] for f in output_files}

        missing_outputs = [f for f in sample_basenames if f not in output_basenames]
        extra_outputs = [f for f in output_basenames if f not in sample_basenames]

        print(f"Sample basenames: {sample_basenames}")
        print(f"Output basenames: {output_basenames}")
        if missing_outputs:
            print(f"Missing outputs: {missing_outputs}")
        if extra_outputs:
            print(f"Extra outputs: {extra_outputs}")

        assert not missing_outputs, (
            f"Missing outputs: {missing_outputs}\n"
            f"Extra outputs: {extra_outputs}\n"
            f"Unsupported/skipped: {unsupported_files}"
        )

    def test_validate_output_dimensions(self):
        """Ensure each processed file has the expected width."""
        self.run_docker_folder_processing()
        output_files = os.listdir(self.OUTPUT_DIR)
        assert output_files, f"No files found in {self.OUTPUT_DIR}"

        for filename in output_files:
            path = os.path.join(self.OUTPUT_DIR, filename)
            assert is_file_supported(path), f"Not a valid image file: {filename}"
            validate_image_dimensions(path, self.EXPECTED_IMAGE_WIDTH)
            print(f"{filename}: {self.EXPECTED_IMAGE_WIDTH}px wide - OK")

    def test_single_file_processing(self):
        """Convert just one known JPG and validate width."""
        single_file_name = "pexels-pealdesign-28594392.jpg"
        local_path = os.path.join(self.SAMPLE_IMAGES_DIR, single_file_name)
        assert os.path.exists(local_path), f"Missing test image: {local_path}"

        self.run_docker_singlefile_processing(single_file_name)

        output_files = os.listdir(self.OUTPUT_DIR)
        assert len(output_files) == 1, f"Expected 1 output file, found {len(output_files)}."
        out_path = os.path.join(self.OUTPUT_DIR, output_files[0])
        validate_image_dimensions(out_path, self.EXPECTED_IMAGE_WIDTH)
        print(f"Single file '{out_path}' validated at {self.EXPECTED_IMAGE_WIDTH}px wide - OK")

    def test_png_transparency_preserved(self):
        """Ensure PNG transparency survives round-trip conversion."""
        transparent_img_path = os.path.join(self.SAMPLE_IMAGES_DIR, "test_transparent.png")
        width, height = 100, 100

        img = Image.new("RGBA", (width, height), (255, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        draw.rectangle([10, 10, 50, 50], fill=(0, 255, 0, 128))
        img.save(transparent_img_path, "PNG")
        assert os.path.exists(transparent_img_path)

        self.run_docker_singlefile_processing("test_transparent.png", extra_args=["--format", "png"])

        out_path = os.path.join(self.OUTPUT_DIR, "test_transparent.png")
        assert os.path.exists(out_path)

        with Image.open(out_path) as out_img:
            print(f"Output image format: {out_img.format}, mode: {out_img.mode}")
            assert out_img.format.upper() == "PNG"
            assert "A" in out_img.mode

            scale_factor = self.EXPECTED_IMAGE_WIDTH / width
            inside_x, inside_y = int(30 * scale_factor), int(30 * scale_factor)
            outside_x, outside_y = int(6 * scale_factor), int(6 * scale_factor)

            pixel_inside = out_img.getpixel((inside_x, inside_y))
            pixel_outside = out_img.getpixel((outside_x, outside_y))

            expected_inside_alpha = 128
            expected_outside_alpha = 0
            assert pixel_inside[3] == expected_inside_alpha
            assert pixel_outside[3] == expected_outside_alpha

    @pytest.mark.parametrize(
        "sample_name",
        _generated_samples(SAMPLE_IMAGES_DIR),
        ids=lambda name: name,
    )
    def test_single_file_many_formats(self, sample_name):
        """
        Convert each generated Pillow sample individually and validate width.
        """
        ext = os.path.splitext(sample_name)[1].lstrip(".").lower()
        fmt_cli = {"jpg": "jpeg", "tif": "tiff", "jp2": "jpeg2000", "heif": "heic"}.get(ext, ext)

        self.run_docker_singlefile_processing(sample_name, extra_args=["--format", fmt_cli])

        output_files = os.listdir(self.OUTPUT_DIR)
        assert len(output_files) == 1, f"Expected 1 output, found {len(output_files)}."
        out_path = os.path.join(self.OUTPUT_DIR, output_files[0])
        validate_image_dimensions(out_path, self.EXPECTED_IMAGE_WIDTH)