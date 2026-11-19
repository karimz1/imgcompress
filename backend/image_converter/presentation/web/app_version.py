"""The release of this container (for example 1.1.0-rc.5), from build-info.json.

One source for app_version in GET /api/v1/info and info.version in the
OpenAPI document. The API version stays separate: it is the 1 in /api/v1.
"""

import json
import os
from typing import Optional

from flask import current_app

# info.version must be a string; builds without build-info.json are dev builds.
DEV_VERSION = "dev"


def app_version() -> Optional[str]:
    """The installed release, or None in dev builds."""
    try:
        with open(os.path.join(current_app.static_folder, "build-info.json"), encoding="utf-8") as f:
            version = json.load(f).get("version")
        return version if isinstance(version, str) else None
    except (OSError, ValueError, TypeError, AttributeError, RuntimeError):
        return None
