# test_file_location.py

import os

def test_print_file_location():
    """
    Test that retrieves and prints the current script's directory.
    """
    # Retrieve the directory of the current script
    current_directory = os.path.dirname(os.path.abspath(__file__))

    # Print statements
    print("About to print file location:")
    print(current_directory)

    # Simple assertion to ensure the directory exists



    SAMPLE_IMAGES_DIR = os.path.join(current_directory, "sample-images")
    print(SAMPLE_IMAGES_DIR)
    OUTPUT_DIR = os.path.join(current_directory, "output")
    print(OUTPUT_DIR)


    assert os.path.isdir(current_directory), "The current directory should exist."
