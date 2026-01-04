import sys
import traceback
from backend.image_converter.presentation.cli.argument_parser import parse_arguments
from backend.image_converter.core.image_conversion_processor import ImageConversionProcessor
from backend.image_converter.core.enums.image_format import ImageFormat
from backend.image_converter.infrastructure.logger import Logger

def main(argv=None):
    """Main entry point of the script."""

    args = parse_arguments(argv)
    logger = Logger(debug=args.debug, json_output=args.json_output)

    # Validate: --remove-background only works with PNG format
    if args.remove_background and args.format.upper() != "PNG":
        logger.log(
            "Error: --remove-background can only be used with --format png",
            "error"
        )
        sys.exit(1)

    try:
        image_format = ImageFormat.from_string(args.format.upper())
        processor = ImageConversionProcessor(
            source=args.source,
            destination=args.destination,
            image_format=image_format,
            quality=args.quality,
            width=args.width,
            use_rembg=args.remove_background,
            debug=args.debug,
            json_output=args.json_output
        )

        processor.run()
    except Exception as e:
        tb = traceback.format_exc()
        logger.log(f"A fatal error occurred during processing:\n{tb}", "error")
        sys.exit(1)

if __name__ == '__main__':
    main()
