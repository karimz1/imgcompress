import imghdr


def is_image(file_path):
    """
    Check if the given file is a valid image based on its header.
    """
    return imghdr.what(file_path) is not None


def are_files_identical(file1, file2):
    """
    Compare the contents of two files to determine if they are identical.
    """
    with open(file1, 'rb') as f1, open(file2, 'rb') as f2:
        return f1.read() == f2.read()
