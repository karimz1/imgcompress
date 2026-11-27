"""The one error shape of /api/v1: {"error": <short name>, "message": <what to do>}."""

from typing import Optional

from flask import jsonify

ERROR_NAMES = {
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    409: "Conflict",
    410: "Gone",
    413: "Payload Too Large",
    415: "Unsupported Media Type",
    422: "Unprocessable Entity",
    500: "Internal Server Error",
}


def error(status: int, message: str, headers: Optional[dict] = None):
    response = jsonify({"error": ERROR_NAMES.get(status, "Error"), "message": message})
    response.headers["Cache-Control"] = "no-store"
    for name, value in (headers or {}).items():
        response.headers[name] = value
    return response, status
