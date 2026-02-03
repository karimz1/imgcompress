#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

OUTPUTS_PATH = Path(__file__).resolve().parent / "cdk-outputs.json"


def main() -> None:
    if OUTPUTS_PATH.exists():
        OUTPUTS_PATH.unlink()
        print(f"Removed {OUTPUTS_PATH}")


if __name__ == "__main__":
    main()
