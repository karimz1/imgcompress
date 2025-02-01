import os
import pytest
import subprocess
import shlex
import shutil

from tests.test_utils import (
    is_image,
    validate_image_dimensions,
    create_sample_test_image,
    is_github_actions,
)

from PIL import Image, ImageDraw

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

    @pytest.fixture(scope="session", autouse=True)
    def build_docker_image(self):
        """
        Builds the Docker image once before running tests.
        Since this fixture is session-scoped and autouse=True,
        it runs before any tests in this class.
        """
        print(f"Building Docker image from context: {self.DOCKER_CONTEXT}")
        cmd = [
            "docker", "build",
            "-t", self.DOCKER_IMAGE_NAME,
            "-f", self.DOCKERFILE_PATH,
            self.DOCKER_CONTEXT,
            "--no-cache"
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
        Runs before each test method in this class.
        Cleans OUTPUT_DIR and ensures SAMPLE_IMAGES_DIR is valid.
        Creates a test image if needed.
        """
        if os.path.exists(self.OUTPUT_DIR):
            print("Removing existing output folder...")
            shutil.rmtree(self.OUTPUT_DIR)
        os.makedirs(self.OUTPUT_DIR, exist_ok=True)

        assert os.path.exists(self.SAMPLE_IMAGES_DIR), "SAMPLE_IMAGES_DIR does not exist."

        # Create a generic test image for other tests
        img_path = os.path.join(self.SAMPLE_IMAGES_DIR, "test_image.png")
        create_sample_test_image(img_path)
        assert os.path.exists(img_path), f"Failed to create test image at {img_path}"

        sample_files = os.listdir(self.SAMPLE_IMAGES_DIR)
        print(f"Contents of SAMPLE_IMAGES_DIR: {sample_files}")


    def run_docker_folder_processing(self):
        """
        Processes the entire folder: SAMPLE_IMAGES_DIR -> OUTPUT_DIR.
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


    def run_docker_singlefile_processing(self, single_file_name, extra_args=None):
        """
        Processes a single file inside SAMPLE_IMAGES_DIR -> OUTPUT_DIR.
        Optionally appends extra command-line arguments.
        """
        extra_args = extra_args or []
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


    def test_png_transparency_preserved(self):
        """
        Creates a PNG image with transparency, processes only that file with --format png,
        and validates that the output image is PNG and preserves its transparency.
        """
        # Create a transparent PNG image in SAMPLE_IMAGES_DIR
        transparent_img_path = os.path.join(self.SAMPLE_IMAGES_DIR, "test_transparent.png")
        width, height = 100, 100
        # Create a fully transparent background
        img = Image.new("RGBA", (width, height), (255, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        # Draw a semi-transparent green rectangle in a smaller area (from (10,10) to (50,50))
        draw.rectangle([10, 10, 50, 50], fill=(0, 255, 0, 128))
        img.save(transparent_img_path, "PNG")
        assert os.path.exists(transparent_img_path), f"Failed to create {transparent_img_path}"
    
        # Process only the test_transparent.png file with --format png
        self.run_docker_singlefile_processing("test_transparent.png", extra_args=["--format", "png"])
    
        # Verify that the output file exists
        out_path = os.path.join(self.OUTPUT_DIR, "test_transparent.png")
        assert os.path.exists(out_path), f"Output file {out_path} not found."
    
        # Open the output image and perform validations
        with Image.open(out_path) as out_img:
            print(f"Output image format: {out_img.format}, mode: {out_img.mode}")
            # Check that the output image is PNG
            assert out_img.format.upper() == "PNG", f"Output image is not PNG."
            # Check that transparency is preserved (alpha channel present)
            assert "A" in out_img.mode, "Output image does not have an alpha channel."
    
            # Determine the scale factor (output width / original width)
            scale_factor = self.EXPECTED_IMAGE_WIDTH / width  # 800 / 100 = 8.0
    
            # Calculate new coordinates:
            # Original inside point (30,30) becomes (30*8, 30*8) = (240,240)
            # Original outside point (6,6) becomes (6*8,6*8) = (48,48)
            inside_x, inside_y = int(30 * scale_factor), int(30 * scale_factor)
            outside_x, outside_y = int(6 * scale_factor), int(6 * scale_factor)
    
            pixel_inside = out_img.getpixel((inside_x, inside_y))
            pixel_outside = out_img.getpixel((outside_x, outside_y))
    
            # Debug print of the pixel values:
            print(f"Pixel inside at ({inside_x},{inside_y}): {pixel_inside}")
            print(f"Pixel outside at ({outside_x},{outside_y}): {pixel_outside}")
    
            # Pixel format is RGBA; verify alpha values
            expected_inside_alpha = 128
            expected_outside_alpha = 0
            assert pixel_inside[3] == expected_inside_alpha, (
                f"Expected alpha {expected_inside_alpha} at ({inside_x},{inside_y}), got {pixel_inside[3]}"
            )
            assert pixel_outside[3] == expected_outside_alpha, (
                f"Expected alpha {expected_outside_alpha} at ({outside_x},{outside_y}), got {pixel_outside[3]}"
            )