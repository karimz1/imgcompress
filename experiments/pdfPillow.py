from PIL import Image

def get_supported_readable_extensions():
    """
    Dynamically returns a sorted list of file extensions for which Pillow has a registered
    decoder (i.e. that Pillow can actually open).
    """
    # Image.registered_extensions() returns a dictionary mapping extensions to format names.
    # Image.OPEN contains the internal formats (in uppercase) that Pillow can decode.
    supported = [
        ext.lower() 
        for ext, fmt in Image.registered_extensions().items() 
        if fmt.upper() in Image.OPEN
    ]
    return sorted(set(supported))

if __name__ == '__main__':
    exts = get_supported_readable_extensions()
    print("Dynamically supported readable file extensions:", exts)
    print("extensions count:", exts.__len__())
