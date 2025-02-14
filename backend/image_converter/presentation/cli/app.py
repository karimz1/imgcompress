import sys
import traceback
from backend.image_converter.presentation.cli.argument_parser import parse_arguments
from backend.image_converter.core.image_convertsion_processor import ImageConversionProcessor
from backend.image_converter.core.enums.image_format import ImageFormat
from backend.image_converter.infrastructure.logger import Logger

def main():
    """Main entry point of the script."""
    try:
        args = parse_arguments()
    except Exception as e:
        tb = traceback.format_exc()
        print("Error parsing arguments:")
        print(tb)
        sys.exit(1)

    logger = Logger(debug=args.debug, json_output=args.json_output)

    try:
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
    except Exception as e:
        tb = traceback.format_exc()
        logger.log(f"A fatal error occurred during processing:\n{tb}", "error")
        sys.exit(1)

if __name__ == '__main__':
    main()
