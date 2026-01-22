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

    # Validate: --remove-background only works with PNG or AVIF format
    if args.remove_background and args.format.upper() not in ["PNG", "AVIF"]:
        logger.log(
            "Error: --remove-background can only be used with --format png or --format avif",
            "error"
        )
        sys.exit(1)

    try:
        image_format = ImageFormat.from_string(args.format.upper())
        pdf_preset = args.pdf_preset
        pdf_scale = args.pdf_scale
        pdf_margin_mm = args.pdf_margin_mm
        pdf_paginate = args.pdf_paginate
        if image_format != ImageFormat.PDF:
            pdf_preset = None
            pdf_scale = "fit"
            pdf_margin_mm = None
            pdf_paginate = False
        processor = ImageConversionProcessor(
            source=args.source,
            destination=args.destination,
            image_format=image_format,
            quality=args.quality,
            width=args.width,
            pdf_preset=pdf_preset,
            pdf_scale=pdf_scale,
            pdf_margin_mm=pdf_margin_mm,
            pdf_paginate=pdf_paginate,
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
