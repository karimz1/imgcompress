class ConversionError(Exception):
    """Exception raised when an image conversion cannot be performed."""
    def __init__(self, message: str) -> None:
        super().__init__(message)
