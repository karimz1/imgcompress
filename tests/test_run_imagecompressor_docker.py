import os
import pytest
import subprocess
from PIL import Image
from .test_utils import is_image, are_files_identical
import shutil
import shlex


TESTS_DIR = os.path.dirname(os.path.abspath(__file__))
DOCKER_IMAGE_NAME = "karimz1/imgcompress:local-test"
DOCKER_CONTEXT = os.path.abspath(os.path.join(TESTS_DIR, ".."))
DOCKERFILE_PATH = os.path.abspath(os.path.join(DOCKER_CONTEXT, "Dockerfile"))
SAMPLE_IMAGES_DIR = os.path.join(TESTS_DIR, "sample-images")
OUTPUT_DIR = os.path.join(TESTS_DIR, "output")
EXPECTED_DIR = os.path.join(TESTS_DIR, "expected")
EXPECTED_IMAGE_WIDTH = 800

@pytest.fixture(scope="session", autouse=True)
def build_docker_image():
    """
    Fixture to build the Docker image once before running tests.
    """
    print(f"Building Docker image from context: {DOCKER_CONTEXT}")
    cmd = ["docker", "build", "-t", DOCKER_IMAGE_NAME, "-f", DOCKERFILE_PATH, DOCKER_CONTEXT, "--no-cache"]
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
    )
    print("docker build command:", shlex.join(cmd))
    print("Docker build stdout:\n", result.stdout)
    print("Docker build stderr:\n", result.stderr)
    if result.returncode != 0:
        raise RuntimeError(f"Docker build failed with output:\n{result.stderr}")

@pytest.fixture(scope="function", autouse=True)
def setup_environment():
    """
    Fixture to set up the test environment before every test.
    Ensures that the output directory is clean before each test.
    """
    if os.path.exists(OUTPUT_DIR):
        print("remove the output folder")
        shutil.rmtree(OUTPUT_DIR)
    
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    assert os.path.exists(SAMPLE_IMAGES_DIR), "SAMPLE_IMAGES_DIR directory does not exist."
    
    create_sample_test_image()
    
    sample_files = os.listdir(SAMPLE_IMAGES_DIR)
    print(f"Contents of SAMPLE_IMAGES_DIR ({SAMPLE_IMAGES_DIR}): {sample_files}")

def create_sample_test_image():
    img_path = os.path.join(SAMPLE_IMAGES_DIR, "test_image.png")
    img = Image.new("RGB", (6000, 12000), color="white")
    img.save(img_path)
    assert os.path.exists(img_path), f"Failed to create test image at {img_path}"
    print(f"Created test image at {img_path}")


def is_github_actions():
    """
    Detect if the script is running inside a GitHub Actions workflow.
    Returns:
        bool: True if running in GitHub Actions, False otherwise.
    """
    return os.getenv("IS_RUNNING_IN_GITHUB_ACTIONS") == "true"

def run_docker_folder_processing():
    """
    Run the Docker container with a single string command.
    """
    if is_github_actions():
        print("running within github actions exec.")
        
        container_name = "devcontainer"
        cmd = [
             "docker", "run", "--rm",
                "--volumes-from", container_name,
                DOCKER_IMAGE_NAME,
                SAMPLE_IMAGES_DIR, OUTPUT_DIR,
                "--quality", str(80), "--width", str(EXPECTED_IMAGE_WIDTH)
        ]
    else:
        print("running within local exec")
        cmd = [
            "docker", "run", "--rm",
                "-v", f"{SAMPLE_IMAGES_DIR}:/container/input_folder",
                "-v", f"{OUTPUT_DIR}:/container/output_folder",
                DOCKER_IMAGE_NAME,
                "/container/input_folder", "/container/output_folder",
                "--quality", str(80), "--width", str(EXPECTED_IMAGE_WIDTH)
        ]

    print("docker run command:", shlex.join(cmd))
    subprocess.run(cmd, check=True)

def test_files_created():
    """
    Test that files are created in the output directory.
    """
    run_docker_folder_processing()

    assert os.path.exists(OUTPUT_DIR), "Output directory does not exist."
    output_files = os.listdir(OUTPUT_DIR)
    print(f"Output_FOLDER contents after run: {output_files}")
    assert len(output_files) > 0, "No files were created in the output directory."

def test_file_count_matches():
    """
    Test that the number of image files in output matches the number of image files in sample-images.
    """
    run_docker_folder_processing()
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

    print(f"Sample files count: {len(sample_files)}")
    print(f"Output files count: {len(output_files)}")
    print(f"Sample files: {sample_files}")
    print(f"Output files: {output_files}")

    assert len(sample_files) == len(output_files), (
        f"Number of image files in output ({len(output_files)}) does not match sample images ({len(sample_files)})."
    )

def test_validate_output_dimensions():
    """
    Test that all images in the output folder have the expected width of 800 pixels.
    """
    run_docker_folder_processing()

    output_files = os.listdir(OUTPUT_DIR)
    print(f"There are: {len(output_files)} files in: {OUTPUT_DIR}")

    if not output_files:
        raise AssertionError(f"Failed to find any files in {OUTPUT_DIR}")

    for file in output_files:
        output_file = os.path.join(OUTPUT_DIR, file)
        print(f"file found in {output_file}")

        try:
            with Image.open(output_file) as img:
                width, height = img.size
                print(f"Image {file} has width {width} and height {height}")
                assert width == EXPECTED_IMAGE_WIDTH, (
                    f"Image {file} has width {width}, expected {EXPECTED_IMAGE_WIDTH}."
                )
        except Exception as e:
            raise AssertionError(f"Failed to validate dimensions for file {file}. Error: {e}")

def test_single_file_processing():
    """
    Test processing a single file and validating its output.
    """
    # Prepare a single test image
    single_file_name = "pexels-pealdesign-28594392.jpg"
    single_file_path = os.path.join(SAMPLE_IMAGES_DIR, single_file_name)

    assert os.path.exists(single_file_path), f"Test image not created at {single_file_path}"

    # Run the script to process only this single file
    if is_github_actions():
        container_name = "devcontainer"
        cmd = [
            "docker", "run", "--rm",
            "--volumes-from", container_name,
            DOCKER_IMAGE_NAME,
            single_file_path, OUTPUT_DIR,
            "--quality", str(80), "--width", str(EXPECTED_IMAGE_WIDTH)
        ]
    else:
        cmd = [
            "docker", "run", "--rm",
            "-v", f"{SAMPLE_IMAGES_DIR}:/container/input_folder",
            "-v", f"{OUTPUT_DIR}:/container/output_folder",
            DOCKER_IMAGE_NAME,
            f"/container/input_folder/{single_file_name}", "/container/output_folder",
            "--quality", str(80), "--width", str(EXPECTED_IMAGE_WIDTH)
        ]

    print("docker run command for single file:", shlex.join(cmd))
    subprocess.run(cmd, check=True)

    # Validate that a single file is generated in the output directory
    output_files = os.listdir(OUTPUT_DIR)
    assert len(output_files) == 1, f"Expected 1 file in output, found {len(output_files)}."
    output_file_path = os.path.join(OUTPUT_DIR, output_files[0])
    print(f"Single output file path: {output_file_path}")

    # Validate the output file's dimensions
    try:
        with Image.open(output_file_path) as img:
            width, height = img.size
            print(f"Output image dimensions: width={width}, height={height}")
            assert width == EXPECTED_IMAGE_WIDTH, (
                f"Output image width is {width}, expected {EXPECTED_IMAGE_WIDTH}."
            )
    except Exception as e:
        raise AssertionError(f"Failed to open and validate single output file. Error: {e}")
