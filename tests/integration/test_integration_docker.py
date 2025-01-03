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

        # Ensure a test image is present
        img_path = os.path.join(self.SAMPLE_IMAGES_DIR, "test_image.png")
        create_sample_test_image(img_path)
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


    def run_docker_singlefile_processing(self, single_file_name):
    """
    Processes a single file inside SAMPLE_IMAGES_DIR -> OUTPUT_DIR.
    """
    if is_github_actions():
        print("Running within GitHub Actions.")
        cmd = [
            "docker", "run", "--rm",
            "--volumes-from", self.DEVCONTAINER_NAME,
            self.DOCKER_IMAGE_NAME,
            f"/container/input_folder/{single_file_name}",  # path within the container
            "/container/output_folder",                     # same destination as folder mode
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
            f"/container/input_folder/{single_file_name}",  # path within the container
            "/container/output_folder",
            "--quality", str(80),
            "--width", str(self.EXPECTED_IMAGE_WIDTH),
        ]
    print("Docker single-file command:", shlex.join(cmd))
    subprocess.run(cmd, check=True)


    def test_files_created(self):
        """
        Ensures at least one file is created in OUTPUT_DIR after folder processing.
        """
        self.run_docker_folder_processing()
        output_files = os.listdir(self.OUTPUT_DIR)
        print(f"Contents of OUTPUT_DIR after run: {output_files}")
        assert output_files, "No files were created in the output directory."

    def test_file_count_matches(self):
        """
        Ensures the number of processed files in OUTPUT_DIR 
        matches the number of supported images in SAMPLE_IMAGES_DIR.
        """
        self.run_docker_folder_processing()
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

    def test_validate_output_dimensions(self):
        """
        Ensures that each file in OUTPUT_DIR has the expected width.
        """
        self.run_docker_folder_processing()
        output_files = os.listdir(self.OUTPUT_DIR)
        assert output_files, f"No files found in {self.OUTPUT_DIR}"

        for filename in output_files:
            path = os.path.join(self.OUTPUT_DIR, filename)
            assert is_image(path), f"Not a valid image file: {filename}"
            validate_image_dimensions(path, self.EXPECTED_IMAGE_WIDTH)
            print(f"{filename}: {self.EXPECTED_IMAGE_WIDTH}px wide - OK")

    def test_single_file_processing(self):
        """
        Tests converting just a single file (pexels-pealdesign-28594392.jpg).
        """
        single_file_name = "pexels-pealdesign-28594392.jpg"
        local_path = os.path.join(self.SAMPLE_IMAGES_DIR, single_file_name)
        assert os.path.exists(local_path), f"Missing test image: {local_path}"

        self.run_docker_singlefile_processing(single_file_name)

        output_files = os.listdir(self.OUTPUT_DIR)
        assert len(output_files) == 1, f"Expected 1 output file, found {len(output_files)}."
        out_path = os.path.join(self.OUTPUT_DIR, output_files[0])
        validate_image_dimensions(out_path, self.EXPECTED_IMAGE_WIDTH)
        print(f"Single file '{out_path}' validated at {self.EXPECTED_IMAGE_WIDTH}px wide - OK")
