# image_converter/cli/convert_images.py

from backend.image_converter.cli.argument_parser import parse_arguments
from backend.image_converter.core.processor import ImageConversionProcessor

def main():
    """Main entry point of the script."""
    args = parse_arguments()
    processor = ImageConversionProcessor(args)
    processor.run()

if __name__ == "__main__":
    main()
