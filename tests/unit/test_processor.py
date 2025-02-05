import os
import pytest
import subprocess
import shlex
import shutil

from PIL import Image, ImageDraw

from tests.test_utils import (
    is_image,
    validate_image_dimensions,
    create_sample_test_image,
    is_github_actions,
)

class TestImageConversionDockerIntegration:
    """
    Integration tests that run the Docker container for the image conversion CLI.
    """

    # Directory/Path configuration
    INTEGRATION_TESTS_DIR = os.path.dirname(os.path.abspath(__file__))
    PROJECT_ROOT = os.path.abspath(os.path.join(INTEGRATION_TESTS_DIR, "..", ".."))
    DOCKER_IMAGE_NAME = "karimz1/imgcompress:local-test"
    DOCKER_CONTEXT = PROJECT_ROOT
    DOCKERFILE_PATH = os.path.join(PROJECT_ROOT, "Dockerfile")

    SAMPLE_IMAGES_DIR = os.path.join(PROJECT_ROOT, "tests", "sample-images")
    OUTPUT_DIR = os.path.join(PROJECT_ROOT, "tests", "output")
    EXPECTED_IMAGE_WIDTH = 800
    DEV_CONTAINER_NAME = "devcontainer"

    @pytest.fixture(scope="session", autouse=True)
    def build_docker_image(self):
        """
        Build the Docker image once per session before any tests run.
        This ensures we have a fresh local Docker image for testing.
        """
        print(f"Building Docker image from context: {self.DOCKER_CONTEXT}")
        cmd = [
            "docker", "build",
            "-t", self.DOCKER_IMAGE_NAME,
            "-f", self.DOCKERFILE_PATH,
            self.DOCKER_CONTEXT,
            "--no-cache",
        ]
        print("docker build command:", shlex.join(cmd))
        result = subprocess.run(cmd, capture_output=True, text=True)
        print("Docker build stdout:\n", result.stdout)
        print("Docker build stderr:\n", result.stderr)
        if result.returncode != 0:
            raise RuntimeError(f"Docker build failed:\n{result.stderr}")

    @pytest.fixture(scope="function", autouse=True)
    def prepare_test_environment(self):
        """
        Prepare a clean environment before each test:
          - Remove and recreate the OUTPUT_DIR.
          - Ensure the SAMPLE_IMAGES_DIR is valid.
          - Create a sample test image if none exists.
        """
        if os.path.exists(self.OUTPUT_DIR):
            print("Removing existing output folder...")
            shutil.rmtree(self.OUTPUT_DIR)
        os.makedirs(self.OUTPUT_DIR, exist_ok=True)

        assert os.path.exists(self.SAMPLE_IMAGES_DIR), "SAMPLE_IMAGES_DIR does not exist."

        # Create a sample image for testing
        test_image_path = os.path.join(self.SAMPLE_IMAGES_DIR, "test_image.png")
        create_sample_test_image(test_image_path)
        assert os.path.exists(test_image_path), f"Failed to create test image at {test_image_path}"

        print(f"Contents of SAMPLE_IMAGES_DIR: {os.listdir(self.SAMPLE_IMAGES_DIR)}")

    def run_docker_folder_conversion(self):
        """
        Convert all images in SAMPLE_IMAGES_DIR -> OUTPUT_DIR using default options.
        Defaults to JPEG unless the container’s CLI is changed to specify --format.
        """
        if is_github_actions():
            print("Running within GitHub Actions...")
            cmd = [
                "docker", "run", "--rm",
                "--volumes-from", self.DEV_CONTAINER_NAME,
                self.DOCKER_IMAGE_NAME,
                self.SAMPLE_IMAGES_DIR,
                self.OUTPUT_DIR,
                "--quality", "80",
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
                "--quality", "80",
                "--width", str(self.EXPECTED_IMAGE_WIDTH),
            ]

        print("Docker run command:", shlex.join(cmd))
        subprocess.run(cmd, check=True)

    def run_docker_single_file_conversion(self, file_name, extra_args=None):
        """
        Convert a single file: SAMPLE_IMAGES_DIR/file_name -> OUTPUT_DIR.
        Optionally append extra_args to the CLI command (e.g., ["--format", "png"]).
        Defaults to JPEG if no format is specified.
        """
        if extra_args is None:
            extra_args = ["--format", "jpeg"]

        if is_github_actions():
            cmd = [
                "docker", "run", "--rm",
                "--volumes-from", self.DEV_CONTAINER_NAME,
                self.DOCKER_IMAGE_NAME,
                os.path.join(self.SAMPLE_IMAGES_DIR, file_name),
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
                f"/container/input_folder/{file_name}",
                "/container/output_folder",
                "--quality", "80",
                "--width", str(self.EXPECTED_IMAGE_WIDTH),
            ] + extra_args

        print("Docker single-file command:", shlex.join(cmd))
        subprocess.run(cmd, check=True)

    def test_folder_processing_creates_output_files(self):
        """
        Verify that processing an entire folder creates at least one output file.
        """
        self.run_docker_folder_conversion()
        output_files = os.listdir(self.OUTPUT_DIR)
        print(f"Output folder contents after run: {output_files}")
        assert output_files, "No files were created in the output directory."

    def test_folder_processing_matches_supported_image_count(self):
        """
        Verify that the number of converted images matches the number
        of supported images in SAMPLE_IMAGES_DIR.
        """
        self.run_docker_folder_conversion()
        output_files = os.listdir(self.OUTPUT_DIR)

        sample_files = [
            f for f in os.listdir(self.SAMPLE_IMAGES_DIR)
            if os.path.isfile(os.path.join(self.SAMPLE_IMAGES_DIR, f))
               and is_image(os.path.join(self.SAMPLE_IMAGES_DIR, f))
        ]
        print(f"Sample count: {len(sample_files)}, Output count: {len(output_files)}")
        assert len(sample_files) == len(output_files), (
            f"Expected {len(sample_files)} processed files, got {len(output_files)}."
        )

    def test_folder_processing_output_dimensions(self):
        """
        Verify that each processed image in OUTPUT_DIR matches the expected width.
        """
        self.run_docker_folder_conversion()
        output_files = os.listdir(self.OUTPUT_DIR)
        assert output_files, f"No files found in {self.OUTPUT_DIR}"

        for filename in output_files:
            path = os.path.join(self.OUTPUT_DIR, filename)
            assert is_image(path), f"Not a valid image file: {filename}"
            validate_image_dimensions(path, self.EXPECTED_IMAGE_WIDTH)
            print(f"{filename} is {self.EXPECTED_IMAGE_WIDTH}px wide - OK")

    def test_single_file_conversion(self):
        """
        Convert a single JPG image and ensure only one output file is produced
        with the correct dimensions.
        """
        single_file_name = "pexels-pealdesign-28594392.jpg"
        local_path = os.path.join(self.SAMPLE_IMAGES_DIR, single_file_name)
        assert os.path.exists(local_path), f"Missing test image: {local_path}"

        self.run_docker_single_file_conversion(single_file_name)
        output_files = os.listdir(self.OUTPUT_DIR)

        assert len(output_files) == 1, f"Expected 1 output file, found {len(output_files)}."
        out_path = os.path.join(self.OUTPUT_DIR, output_files[0])
        validate_image_dimensions(out_path, self.EXPECTED_IMAGE_WIDTH)
        print(f"Single file '{out_path}' validated at {self.EXPECTED_IMAGE_WIDTH}px wide - OK")

    def test_png_transparency_is_preserved(self):
        """
        Create a transparent PNG and ensure after processing with --format png:
          - The resulting image is still PNG.
          - The alpha channel is preserved.
          - The image is resized correctly (if width is specified).
        """
        transparent_img_path = os.path.join(self.SAMPLE_IMAGES_DIR, "test_transparent.png")
        original_width, original_height = 100, 100

        # Create a fully transparent background
        img = Image.new("RGBA", (original_width, original_height), (255, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        # Draw a semi-transparent rectangle (green, alpha=128)
        draw.rectangle([10, 10, 50, 50], fill=(0, 255, 0, 128))
        img.save(transparent_img_path, "PNG")
        assert os.path.exists(transparent_img_path), f"Failed to create {transparent_img_path}"

        self.run_docker_single_file_conversion("test_transparent.png", extra_args=["--format", "png"])

        out_path = os.path.join(self.OUTPUT_DIR, "test_transparent.png")
        assert os.path.exists(out_path), f"Output file not found: {out_path}"

        with Image.open(out_path) as out_img:
            print(f"Output image format: {out_img.format}, mode: {out_img.mode}")
            # Ensure it's still PNG
            assert out_img.format.upper() == "PNG", "Output image is not PNG."
            # Ensure alpha channel is present
            assert "A" in out_img.mode, "Output image does not have an alpha channel."

            # Calculate new coordinates based on scale factor
            scale_factor = self.EXPECTED_IMAGE_WIDTH / original_width  # e.g., 800 / 100 = 8
            inside_x, inside_y = int(30 * scale_factor), int(30 * scale_factor)
            outside_x, outside_y = int(6 * scale_factor), int(6 * scale_factor)

            pixel_inside = out_img.getpixel((inside_x, inside_y))
            pixel_outside = out_img.getpixel((outside_x, outside_y))

            print(f"Pixel inside at ({inside_x},{inside_y}): {pixel_inside}")
            print(f"Pixel outside at ({outside_x},{outside_y}): {pixel_outside}")

            expected_inside_alpha = 128
            expected_outside_alpha = 0
            assert pixel_inside[3] == expected_inside_alpha, (
                f"Expected alpha {expected_inside_alpha}, got {pixel_inside[3]}"
            )
            assert pixel_outside[3] == expected_outside_alpha, (
                f"Expected alpha {expected_outside_alpha}, got {pixel_outside[3]}"
            )
