import os

def is_file_supported(file_path: str) -> bool:
    """
    Determines if the given file_path points to a supported image file.
    This function checks the file extension against a set of extensions
    corresponding to the most common formats that Pillow supports.

    Supported extensions (case-insensitive):
      - JPEG: .jpg, .jpeg, .jpe
      - PNG: .png
      - GIF: .gif
      - BMP: .bmp, .dib
      - TIFF: .tif, .tiff
      - WebP: .webp
      - HEIC/HEIF: .heic, .heif (requires pillow-heif)
      - ICO: .ico
      - ICNS: .icns
      - EPS: .eps, .ps  (read-only support)
      - PDF: .pdf       (read-only support, with extra dependencies)
      - PCX: .pcx
      - Portable image formats: .ppm, .pgm, .pbm
      - XBM/XPM: .xbm, .xpm
      - SGI: .sgi, .rgb
      - TGA: .tga
      - JPEG2000: .jp2   (if OpenJPEG libraries are installed)
      - MSP: .msp

    Args:
        file_path (str): The path to the file.

    Returns:
        bool: True if the file's extension is in the supported list; otherwise False.
    """
    supported_extensions = {
        '.jpg', '.jpeg', '.jpe',
        '.png',
        '.gif',
        '.bmp', '.dib',
        '.tif', '.tiff',
        '.webp',
        '.heic', '.heif',
        '.ico', '.icns',
        '.eps', '.ps',
        '.pdf',
        '.pcx',
        '.ppm', '.pgm', '.pbm',
        '.xbm', '.xpm',
        '.sgi', '.rgb',
        '.tga',
        '.jp2',
        '.msp'
    }
    _, ext = os.path.splitext(file_path)
    return ext.lower() in supported_extensions


class FileUrl:
    """
    Encapsulates a file path and provides helper methods for checking file existence,
    retrieving file properties, and determining if the file type is supported.
    """
    def __init__(self, path: str):
        self.path = path

    def exists(self) -> bool:
        """Returns True if the file exists and is a file."""
        return os.path.isfile(self.path)

    def is_supported(self) -> bool:
        """Returns True if the file has a supported extension."""
        return is_file_supported(self.path)

    def get_extension(self) -> str:
        """Returns the file extension in lowercase."""
        return os.path.splitext(self.path)[1].lower()

    def get_filename(self) -> str:
        """Returns the basename of the file."""
        return os.path.basename(self.path)

    def __str__(self):
        return self.path

    def __repr__(self):
        return f"FileUrl({self.path!r})"

    def __fspath__(self):
        """
        Allows FileUrl objects to be used as os.PathLike objects.
        This method returns the underlying file system path as a string.
        """
        return self.path
