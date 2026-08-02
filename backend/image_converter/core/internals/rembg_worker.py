"""Short-lived rembg worker used to isolate native model memory."""

from __future__ import annotations

import argparse
import sys
import traceback

from backend.image_converter.core.internals.rembg_runtime import remove_background_in_process


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--post-process-mask", action="store_true")
    parser.add_argument("--alpha-matting", action="store_true")
    args = parser.parse_args()

    try:
        with open(args.input, "rb") as input_file:
            image_data = input_file.read()
        output = remove_background_in_process(
            image_data,
            args.model,
            post_process_mask=args.post_process_mask,
            alpha_matting=args.alpha_matting,
        )
        with open(args.output, "wb") as output_file:
            output_file.write(output)
        return 0
    except Exception:
        sys.stderr.write(traceback.format_exc())
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
