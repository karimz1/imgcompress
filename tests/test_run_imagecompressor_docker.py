import os
import pytest
import subprocess
from PIL import Image
from .test_utils import is_image, are_files_identical
import shutil

# Constants for directories and Docker
TESTS_DIR = os.path.dirname(__file__)
DOCKER_IMAGE_NAME = "karimz1/imgcompress:local-test"
DOCKERFILE_PATH = os.path.abspath(os.path.join(TESTS_DIR, "../Dockerfile"))
SAMPLE_IMAGES_DIR = os.path.join(TESTS_DIR, "sample-images")
OUTPUT_DIR = os.path.join(TESTS_DIR, "output")
EXPECTED_DIR = os.path.join(TESTS_DIR, "expected")
EXPECTED_IMAGE_WIDTH = 800

@pytest.fixture(scope="session", autouse=True)
def build_docker_image():
    """
    Fixture to build the Docker image once before running tests.
    """
    docker_context = os.path.abspath(os.path.join(TESTS_DIR, ".."))
    print(f"Building Docker image from context: {docker_context}")
    result = subprocess.run(
        ["docker", "build", "-t", DOCKER_IMAGE_NAME, "-f", DOCKERFILE_PATH, docker_context, "--no-cache"],
        capture_output=True,
        text=True,
    )
    print("Docker build stdout:\n", result.stdout)
    print("Docker build stderr:\n", result.stderr)
    if result.returncode != 0:
        raise RuntimeError(f"Docker build failed with output:\n{result.stderr}")


@pytest.fixture(scope="module", autouse=True)
def setup_once_environment():
    """
    Fixture to set up the environment once per module.
    Ensures the script is executable.
    """
    script_path = os.path.join(TESTS_DIR, "run_imagecompressor_docker.sh")
    subprocess.run(["chmod", "u+x", script_path], check=True)


@pytest.fixture(scope="function", autouse=True)
def setup_environment():
    """
    Fixture to set up the test environment before every test.
    """
    # Clean up and set up the environment
    if os.path.exists(OUTPUT_DIR):
        shutil.rmtree(OUTPUT_DIR)

    assert os.path.exists(SAMPLE_IMAGES_DIR), "SAMPLE_IMAGES_DIR directory does not exist."
    create_sample_test_image()


def create_sample_test_image():
    img = Image.new("RGB", (6000, 12000), color="white")
    img.save(os.path.join(SAMPLE_IMAGES_DIR, "test_image.png"))


def run_script():
    """
    Run the Docker container using the image compressor script.
    """
    script_path = os.path.join(TESTS_DIR, "run_imagecompressor_docker.sh")
    if not os.path.exists(script_path):
        raise RuntimeError(f"Script not found at path: {script_path}")

    print("Running the Docker container using run.sh...")
    result = subprocess.run(
        [script_path],
        capture_output=True,
        text=True,
        shell=True,
    )
    print("Docker run stdout:\n", result.stdout)
    print("Docker run stderr:\n", result.stderr)
    if result.returncode != 0:
        raise RuntimeError(f"Script failed with output:\n{result.stderr}")


def test_files_created():
    """
    Test that files are created in the output directory.
    """
    run_script()

    assert os.path.exists(OUTPUT_DIR), "Output directory does not exist."
    assert len(os.listdir(OUTPUT_DIR)) > 0, "No files were created in the output directory."


def test_file_count_matches():
    """
    Test that the number of image files in output matches the number of image files in sample-images.
    """
    run_script()
    assert os.path.exists(SAMPLE_IMAGES_DIR), "Sample images directory does not exist."
    assert os.path.exists(OUTPUT_DIR), "Output directory does not exist."

    sample_files = [
        f for f in os.listdir(SAMPLE_IMAGES_DIR)
        if os.path.isfile(os.path.join(SAMPLE_IMAGES_DIR, f)) and is_image(os.path.join(SAMPLE_IMAGES_DIR, f))
    ]

    output_files = [
        f for f in os.listdir(OUTPUT_DIR)
        if os.path.isfile(os.path.join(OUTPUT_DIR, f)) and is_image(os.path.join(OUTPUT_DIR, f))
    ]

    assert len(sample_files) == len(output_files), (
        f"Number of image files in output ({len(output_files)}) does not match sample images ({len(sample_files)})."
    )


def test_validate_output_dimensions():
    """
    Test that all images in the output folder have the expected width of 800 pixels.
    """

    run_script()

    for root, _, files in os.walk(OUTPUT_DIR):
        for file in files:
            output_file = os.path.join(root, file)

            try:
                with Image.open(output_file) as img:
                    width, height = img.size
                    assert width == EXPECTED_IMAGE_WIDTH, f"Image {file} has width {width}, expected {EXPECTED_IMAGE_WIDTH}."
            except Exception as e:
                raise AssertionError(f"Failed to validate dimensions for file {file}. Error: {e}")
