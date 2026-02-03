#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

STACK_NAME = "ImgcompressDocsStack"

CDK_DIR = Path(__file__).resolve().parent
OUTPUTS_PATH = CDK_DIR / "cdk-outputs.json"


def print_cloudfront_url() -> None:
    if not OUTPUTS_PATH.exists():
        print("No outputs file found. CloudFront URL unavailable.")
        return

    with OUTPUTS_PATH.open("r", encoding="utf-8") as handle:
        data = json.load(handle)

    outputs = data.get(STACK_NAME, {})
    custom = outputs.get("CustomDomainUrl")
    cf = outputs.get("CloudFrontUrl")

    if custom:
        print(f"App URL: {custom}")
    if cf:
        print(f"CloudFront URL: {cf}")

    if not custom and not cf:
        print("No URL outputs found. Check stack outputs.")


def main() -> None:
    print_cloudfront_url()


if __name__ == "__main__":
    try:
        main()
    except subprocess.CalledProcessError as exc:
        raise SystemExit(exc.returncode) from exc
