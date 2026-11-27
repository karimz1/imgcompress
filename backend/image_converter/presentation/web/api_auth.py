"""The optional API key (PUBLIC_API_KEY) of /api/v1.

Accepted as ``Authorization: Bearer <key>`` or ``X-API-Key: <key>``,
compared in constant time, and never logged or echoed.
"""

import hmac
from typing import Optional

API_KEY_HEADER = "X-API-Key"
_BEARER = "bearer "


def presented_key(request) -> Optional[str]:
    authorization = (request.headers.get("Authorization") or "").strip()
    if authorization[: len(_BEARER)].lower() == _BEARER:
        token = authorization[len(_BEARER):].strip()
        if token:
            return token
    return (request.headers.get(API_KEY_HEADER) or "").strip() or None


def is_authorized(request, expected_key: Optional[str]) -> bool:
    if not expected_key:
        return True
    given = presented_key(request)
    if given is None:
        return False
    return hmac.compare_digest(given.encode("utf-8"), expected_key.encode("utf-8"))
