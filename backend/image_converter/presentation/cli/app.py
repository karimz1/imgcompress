from backend.image_converter.presentation.cli.argument_parser import parse_arguments
from backend.image_converter.core.image_convertsion_processor import ImageConversionProcessor
from backend.image_converter.core.enums.image_format import ImageFormat


def main():
    """Main entry point of the script."""
    args = parse_arguments()

    image_format = ImageFormat.from_string(args.format.upper())
    processor = ImageConversionProcessor(
        source=args.source,
        destination=args.destination,
        image_format=image_format,
        quality=args.quality,
        width=args.width,
        debug=args.debug,
        json_output=args.json_output
    )

    processor.run()


if __name__ == "__main__":
    main()
