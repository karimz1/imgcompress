# image_converter/cli/convert_images.py

from image_converter.cli.argument_parser import parse_arguments
from image_converter.core.processor import ImageConversionProcessor

def main():
    """Main entry point of the script."""
    args = parse_arguments()
    processor = ImageConversionProcessor(args)
    processor.run()

if __name__ == "__main__":
    main()
