"""Builds a path from a request value that can only name a direct child of a known folder."""

import os
from typing import Optional


def direct_child(base_dir, name) -> Optional[str]:
    """``base_dir/name`` as a real path, or None if it would land anywhere else.

    Both sides are resolved first, so ``..``, absolute or nested names and
    links (even ones pointing back inside ``base_dir``) are all refused. The
    child does not have to exist yet.
    """
    if not isinstance(name, str) or not name or "\x00" in name or os.path.isabs(name):
        return None
    base = os.path.realpath(base_dir)
    joined = os.path.join(base, name)
    resolved = os.path.realpath(joined)
    if not resolved.startswith(base + os.sep):
        return None
    if resolved != joined or os.path.dirname(resolved) != base:
        return None
    return resolved
