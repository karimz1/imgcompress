import os
import shutil
from PIL import Image
from filecmp import cmp

def setup_test():
    # Clean up previous output
    if os.path.exists("output"):
        shutil.rmtree("output")

    # Recreate test image
    img = Image.new("RGB", (100, 100), color="white")
    img.save("sample-images/test_image.png")

    # Create a sample test image
    img = Image.new("RGB", (100, 100), color="white")
    img.save("sample-images/test_image.png")

def run_script():
    os.system("./run_imagecompressor_docker.sh")

def validate_output():
    expected_dir = "expected"
    output_dir = "output"

    # Validate output matches expected
    for root, _, files in os.walk(expected_dir):
        for file in files:
            expected_file = os.path.join(expected_dir, file)
            output_file = os.path.join(output_dir, file)

            if not os.path.exists(output_file):
                print(f"Test Failed: {file} is missing in the output folder.")
                return False

            if not cmp(expected_file, output_file, shallow=False):
                print(f"Test Failed: {file} does not match the expected output.")
                return False

    print("Test Passed: All output files match the expected results.")
    return True

if __name__ == "__main__":
    setup_test()
    run_script()
    if validate_output():
        exit(0)
    else:
        exit(1)
        