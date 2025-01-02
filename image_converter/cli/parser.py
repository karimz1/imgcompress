import argparse
import json
from image_converter.infrastructure.logger import Logger
from image_converter.core.file_manager import FileManager
from image_converter.core.converter import ImageConverter

def parse_arguments():
    parser = argparse.ArgumentParser(
        description="Convert images to JPEG (optionally resizing to given width)."
    )
    parser.add_argument("source_folder", help="Folder containing images to convert")
    parser.add_argument("dest_folder", help="Folder to store output JPEG images")
    parser.add_argument("--quality", type=int, default=85, help="JPEG quality (default: 85)")
    parser.add_argument("--width", type=int, default=None, help="Optional width for resizing (height auto-calculated)")
    parser.add_argument("--debug", action="store_true", help="Enable debug logging")
    parser.add_argument("--json-output", action="store_true", help="Output logs in JSON format")
    return parser.parse_args()

def main():
    args = parse_arguments()

    logger = Logger(debug=args.debug, json_output=args.json_output)
    logger.log("Starting image conversion process.", "info")

    file_manager = FileManager(args.source_folder, args.dest_folder, logger)
    file_manager.ensure_destination()
    supported_files = file_manager.list_supported_files()

    converter = ImageConverter(quality=args.quality, width=args.width, logger=logger)

    results = []
    for filename in supported_files:
        result = converter.convert(filename, args.source_folder, args.dest_folder)
        results.append(result)

    error_count = sum(1 for result in results if result["status"] == "failed")
    summary = {
        "summary": results,
        "status": "success" if error_count == 0 else "failed",
        "errors": error_count
    }

    if args.json_output:
        print(json.dumps(summary, indent=4))
    else:
        logger.log(f"Summary: {len(results)} files processed, {error_count} errors.", "info")
        for result in results:
            if result["status"] == "failed":
                logger.log(f"Failed: {result['file']} - Error: {result['error']}", "error")

if __name__ == "__main__":
    main()
