import os
import time
import subprocess
import pytest
import shlex
from typing import Optional

class TestDockerStartupTime:
    DOCKER_IMAGE_NAME = "karimz1/imgcompress:local-test"
    CONTAINER_NAME = "imgcompress-startup-test"
    STARTUP_LOG_MESSAGE = "started using mode: web"
    TEST_PORT = "5001"
    
    # Environment-aware thresholds
    IS_CI = os.getenv("IS_RUNNING_IN_GITHUB_ACTIONS") == "true"
    DEFAULT_MAX_TIME = 30.0 if IS_CI else 5.0
    MAX_ALLOWED_STARTUP_TIME = float(os.getenv("MAX_STARTUP_TIME", DEFAULT_MAX_TIME))
    MAX_WAIT_TIME = 120.0

    @pytest.fixture(scope="session", autouse=True)
    def ensure_image_built(self):
        """Builds the Docker image once per session."""
        print(f"\n[Setup] Building/Verifying Docker image: {self.DOCKER_IMAGE_NAME}")
        project_root = self._get_project_root()
        self._run_command(["docker", "build", "-t", self.DOCKER_IMAGE_NAME, project_root])

    @pytest.fixture(scope="function")
    def managed_container(self):
        """Ensures a clean container state before and after each test."""
        self._remove_container()
        yield
        self._remove_container()

    def test_startup_time_is_within_acceptable_threshold(self, managed_container):
        """Measures the time it takes for the Docker container to become ready."""
        start_time = time.time()
        process = self._start_docker_container()
        
        try:
            startup_duration = self._wait_for_startup_message(process, start_time)
            self._verify_startup_performance(startup_duration)
        finally:
            self._terminate_process(process)

    # --- Helper methods ---

    def _get_project_root(self) -> str:
        return os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

    def _remove_container(self):
        """Force-removes the test container if it exists."""
        self._run_command(["docker", "rm", "-f", self.CONTAINER_NAME], ignore_errors=True)

    def _start_docker_container(self) -> subprocess.Popen:
        """Starts the Docker container in a subprocess."""
        cmd = [
            "docker", "run", "--name", self.CONTAINER_NAME,
            "-p", f"{self.TEST_PORT}:5000",
            self.DOCKER_IMAGE_NAME
        ]
        print(f"\n[Test] Starting container: {shlex.join(cmd)}")
        return subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)

    def _wait_for_startup_message(self, process: subprocess.Popen, start_time: float) -> Optional[float]:
        """Polls container logs until the startup success message appears or timeout occurs."""
        for line in iter(process.stdout.readline, ""):
            line_text = line.strip()
            print(f"Log: {line_text}")
            
            if self.STARTUP_LOG_MESSAGE in line_text:
                duration = time.time() - start_time
                print(f"\n>>> Startup message detected in {duration:.2f}s <<<")
                return duration
            
            if (time.time() - start_time) > self.MAX_WAIT_TIME:
                print(f"\n[Error] Startup timeout reached ({self.MAX_WAIT_TIME}s)")
                return None
        return None

    def _verify_startup_performance(self, duration: Optional[float]):
        """Asserts that the startup duration meets performance requirements."""
        assert duration is not None, "Startup log message was never detected."
        assert duration < self.MAX_ALLOWED_STARTUP_TIME, (
            f"Startup took {duration:.2f}s, exceeding threshold of {self.MAX_ALLOWED_STARTUP_TIME}s"
        )

    def _terminate_process(self, process: subprocess.Popen):
        """Ensures the subprocess is terminated."""
        if process.poll() is None:
            process.terminate()

    def _run_command(self, cmd: list, ignore_errors: bool = False):
        """Runs a system command synchronously."""
        try:
            subprocess.run(cmd, check=not ignore_errors, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except subprocess.CalledProcessError as e:
            if not ignore_errors:
                raise e
