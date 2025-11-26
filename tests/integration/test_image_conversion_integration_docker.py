import os
import pytest
import subprocess
import shlex
import shutil
from backend.image_converter.core.internals.utls import is_file_supported

from tests.test_utils import (
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

    def _container_exists(self, name: str) -> bool:
        """Return True if a docker container with the given name is running or exists."""
        try:
            result = subprocess.run(
                ["docker", "container", "inspect", name],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=False,
            )
            return result.returncode == 0
        except Exception:
            return False

    def _mounting_strategy(self):
        """
        When running inside a container (devcontainer/CI) we need to use
        --volumes-from to reuse the mounted workspace. Otherwise, fall back
        to binding the host paths directly.
        """
        running_in_container = os.path.exists("/.dockerenv")
        use_shared_volumes = is_github_actions() or running_in_container
        if use_shared_volumes:
            container_name = os.getenv("DEVCONTAINER_NAME", self.DEVCONTAINER_NAME)
            if self._container_exists(container_name):
                return {
                    "volume_args": ["--volumes-from", container_name],
                    "input_path": self.SAMPLE_IMAGES_DIR,
                    "output_path": self.OUTPUT_DIR,
                }
        return {
            "volume_args": [
                "-v", f"{self.SAMPLE_IMAGES_DIR}:/container/input_folder",
                "-v", f"{self.OUTPUT_DIR}:/container/output_folder",
            ],
            "input_path": "/container/input_folder",
            "output_path": "/container/output_folder",
        }

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

        img_path = os.path.join(self.SAMPLE_IMAGES_DIR, "test_image.png")
        create_sample_test_image(img_path)
        assert os.path.exists(img_path), f"Failed to create test image at {img_path}"

        sample_files = os.listdir(self.SAMPLE_IMAGES_DIR)
        print(f"Contents of SAMPLE_IMAGES_DIR: {sample_files}")

    def run_docker_folder_processing(self):
        """
        Processes the entire folder: SAMPLE_IMAGES_DIR -> OUTPUT_DIR.
        """
        strategy = self._mounting_strategy()
        cmd = [
            "docker", "run", "--rm",
            *strategy["volume_args"],
            self.DOCKER_IMAGE_NAME,
            strategy["input_path"],
            strategy["output_path"],
            "--quality", str(80),
            "--width", str(self.EXPECTED_IMAGE_WIDTH),
        ]
        print("Docker run command:", shlex.join(cmd))
        subprocess.run(cmd, check=True)

    def run_docker_singlefile_processing(self, single_file_name, extra_args=["--format", "jpeg"]):
        """
        Processes a single file inside SAMPLE_IMAGES_DIR -> OUTPUT_DIR.
        Optionally appends extra command-line arguments.
        Default is jpeg.
        """
        extra_args = extra_args or []
        strategy = self._mounting_strategy()
        cmd = [
            "docker", "run", "--rm",
            *strategy["volume_args"],
            self.DOCKER_IMAGE_NAME,
            os.path.join(strategy["input_path"], single_file_name),
            strategy["output_path"],
            "--quality", "80",
            "--width", str(self.EXPECTED_IMAGE_WIDTH),
        ] + extra_args
        print("Docker single-file command:", shlex.join(cmd))
        subprocess.run(cmd, check=True)


    def test_run_docker_folder_processing_withValidImages_createsOutputFiles(self):
        """
        Ensures at least one file is created in OUTPUT_DIR after folder processing.
        """
        self.run_docker_folder_processing()
        output_files = os.listdir(self.OUTPUT_DIR)
        print(f"Contents of OUTPUT_DIR after run: {output_files}")
        assert output_files, "No files were created in the output directory."

    def test_run_docker_folder_processing_withSupportedImages_matchesOutputCount(self):
        """
        Ensures the number of processed files in OUTPUT_DIR 
        matches the number of supported images in SAMPLE_IMAGES_DIR.
        """
        self.run_docker_folder_processing()
        output_files = os.listdir(self.OUTPUT_DIR)

        sample_files = [
            f for f in os.listdir(self.SAMPLE_IMAGES_DIR)
            if os.path.isfile(os.path.join(self.SAMPLE_IMAGES_DIR, f))
               and is_file_supported(os.path.join(self.SAMPLE_IMAGES_DIR, f))
        ]
        print(f"Sample count: {len(sample_files)}, Output count: {len(output_files)}")
        assert len(sample_files) == len(output_files), (
            f"Expected {len(sample_files)} processed files, got {len(output_files)}."
        )

    def test_run_docker_folder_processing_withResizing_setsExpectedWidth(self):
        """
        Ensures that each file in OUTPUT_DIR has the expected width.
        """
        self.run_docker_folder_processing()
        output_files = os.listdir(self.OUTPUT_DIR)
        assert output_files, f"No files found in {self.OUTPUT_DIR}"

        for filename in output_files:
            path = os.path.join(self.OUTPUT_DIR, filename)
            assert is_file_supported(path), f"Not a valid image file: {filename}"
            validate_image_dimensions(path, self.EXPECTED_IMAGE_WIDTH)
            print(f"{filename}: {self.EXPECTED_IMAGE_WIDTH}px wide - OK")

    def test_run_docker_singlefile_processing_withSingleImage_createsResizedOutput(self):
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

    def test_run_docker_singlefile_processing_withEpsImage_convertsToRasterOutput(self):
        """
        Tests converting a vector EPS file to a raster output while respecting resize width.
        """
        eps_file = "vecteezy_new-update-logo-template-illustration_5412356-0.eps"
        local_path = os.path.join(self.SAMPLE_IMAGES_DIR, eps_file)
        assert os.path.exists(local_path), f"Missing EPS test image: {local_path}"

        self.run_docker_singlefile_processing(eps_file)

        output_files = os.listdir(self.OUTPUT_DIR)
        assert len(output_files) == 1, f"Expected 1 output file, found {len(output_files)}."
        out_path = os.path.join(self.OUTPUT_DIR, output_files[0])
        validate_image_dimensions(out_path, self.EXPECTED_IMAGE_WIDTH)
        print(f"EPS file '{out_path}' validated at {self.EXPECTED_IMAGE_WIDTH}px wide - OK")


    def test_run_docker_singlefile_processing_withTransparentPng_preservesAlphaChannel(self):
        """
        Creates a PNG image with transparency, processes only that file with --format png,
        and validates that the output image is PNG and preserves its transparency.
        """
                                                             
        transparent_img_path = os.path.join(self.SAMPLE_IMAGES_DIR, "test_transparent.png")
        width, height = 100, 100
                                               
        img = Image.new("RGBA", (width, height), (255, 0, 0, 0))
        draw = ImageDraw.Draw(img)
                                                                                             
        draw.rectangle([10, 10, 50, 50], fill=(0, 255, 0, 128))
        img.save(transparent_img_path, "PNG")
        assert os.path.exists(transparent_img_path), f"Failed to create {transparent_img_path}"
    
                                                                      
        self.run_docker_singlefile_processing("test_transparent.png", extra_args=["--format", "png"])
    
                                            
        out_path = os.path.join(self.OUTPUT_DIR, "test_transparent.png")
        assert os.path.exists(out_path), f"Output file {out_path} not found."
    
                                                       
        with Image.open(out_path) as out_img:
            print(f"Output image format: {out_img.format}, mode: {out_img.mode}")
                                                
            assert out_img.format.upper() == "PNG", f"Output image is not PNG."
                                                                          
            assert "A" in out_img.mode, "Output image does not have an alpha channel."
    
                                                                        
            scale_factor = self.EXPECTED_IMAGE_WIDTH / width                   
    
                                        
                                                                            
                                                                      
            inside_x, inside_y = int(30 * scale_factor), int(30 * scale_factor)
            outside_x, outside_y = int(6 * scale_factor), int(6 * scale_factor)
    
            pixel_inside = out_img.getpixel((inside_x, inside_y))
            pixel_outside = out_img.getpixel((outside_x, outside_y))
    
                                              
            print(f"Pixel inside at ({inside_x},{inside_y}): {pixel_inside}")
            print(f"Pixel outside at ({outside_x},{outside_y}): {pixel_outside}")
    
                                                       
            expected_inside_alpha = 128
            expected_outside_alpha = 0
            assert pixel_inside[3] == expected_inside_alpha, (
                f"Expected alpha {expected_inside_alpha} at ({inside_x},{inside_y}), got {pixel_inside[3]}"
            )
            assert pixel_outside[3] == expected_outside_alpha, (
                f"Expected alpha {expected_outside_alpha} at ({outside_x},{outside_y}), got {pixel_outside[3]}"
            )
