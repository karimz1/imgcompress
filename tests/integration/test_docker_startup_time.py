import os
import time
import subprocess
import pytest
import shlex

class TestDockerStartupTime:
    DOCKER_IMAGE_NAME = "karimz1/imgcompress:local-test"
    STARTUP_LOG_MESSAGE = "started using mode: web"
    
    # Default is 5s local, 30s in CI/QEMU
    IS_CI = os.getenv("IS_RUNNING_IN_GITHUB_ACTIONS") == "true"
    DEFAULT_MAX_TIME = 30.0 if IS_CI else 5.0
    MAX_ALLOWED_STARTUP_TIME = float(os.getenv("MAX_STARTUP_TIME", DEFAULT_MAX_TIME))

    @pytest.fixture(scope="session", autouse=True)
    def ensure_image_built(self):
        """Build the image if it doesn't exist, or ensure it's up to date."""
        print(f"\n[Setup] Building/Verifying Docker image: {self.DOCKER_IMAGE_NAME}")
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        cmd = ["docker", "build", "-t", self.DOCKER_IMAGE_NAME, project_root]
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    def test_startup_time_is_within_acceptable_threshold(self):
        """
        Measure the time it takes for the Docker container to show the startup log message.
        """
        container_name = "imgcompress-startup-test"
        
        # Ensure no old container is running
        subprocess.run(["docker", "rm", "-f", container_name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        cmd = [
            "docker", "run", "--name", container_name,
            "-p", "5001:5000",
            self.DOCKER_IMAGE_NAME
        ]
        
        print(f"\n[Test] Starting container: {shlex.join(cmd)}")
        
        start_time = time.time()
        process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        
        startup_duration = None
        try:
            # Poll logs for the startup message
            for line in iter(process.stdout.readline, ""):
                print(f"Log: {line.strip()}")
                if self.STARTUP_LOG_MESSAGE in line:
                    startup_duration = time.time() - start_time
                    print(f"\n>>> Startup message detected! <<<")
                    print(f">>> Cold start took: {startup_duration:.2f} seconds <<<")
                    break
                
                # Safety timeout
                if time.time() - start_time > 120:
                    print("\n[Error] Startup timeout reached (120s)")
                    break
        finally:
            # Cleanup
            subprocess.run(["docker", "rm", "-f", container_name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            if process.poll() is None:
                process.terminate()

        assert startup_duration is not None, "Startup log message was never found."
        assert startup_duration < self.MAX_ALLOWED_STARTUP_TIME, f"Startup took too long: {startup_duration:.2f}s (Max allowed: {self.MAX_ALLOWED_STARTUP_TIME}s)"
