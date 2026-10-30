import time

from flask import jsonify, request

from backend.image_converter.config import settings
from backend.image_converter.domain.units import BYTES_PER_MEBIBYTE

# A refused body up to this size is read and dropped before the 413 goes out.
# Answering and closing while the client is still sending makes the client's
# system reset the connection, so it sees "EPIPE" or "connection reset"
# instead of the answer. Bigger bodies are cut off right away.
REFUSED_BODY_READ_MAX_BYTES = 256 * BYTES_PER_MEBIBYTE
REFUSED_BODY_READ_SECONDS = 30


def _drop_refused_body() -> None:
    length = request.content_length
    stream = request.environ.get("wsgi.input")
    if stream is None or not length or length > REFUSED_BODY_READ_MAX_BYTES:
        return
    deadline = time.monotonic() + REFUSED_BODY_READ_SECONDS
    while length > 0 and time.monotonic() < deadline:
        chunk = stream.read(min(length, BYTES_PER_MEBIBYTE))
        if not chunk:
            return
        length -= len(chunk)


def handle_request_entity_too_large(e):
    """The request is above MAX_UPLOAD_SIZE_MB; it is refused before anything is stored."""
    _drop_refused_body()
    limit_mb = settings.get().uploads.max_file_size_mebibytes
    return jsonify({
        "error": "Payload Too Large",
        "message": f"The upload is larger than the limit of {limit_mb} MB (MAX_UPLOAD_SIZE_MB).",
        "max_upload_size_mb": limit_mb,
    }), 413


def handle_http_exception(e):
    """Return a sanitized JSON body for any HTTPException.

    The traceback is intentionally not included in the response: it would
    leak internal paths, dependency versions, and implementation details
    to the client. The traceback is still logged server-side by the
    global exception handler in `server.py`.
    """
    response = e.get_response()

    data = {
        "error": e.name,
        "description": e.description,
        "code": e.code,
    }

    response.data = jsonify(data).data
    response.content_type = "application/json"
    return response, e.code


def not_found(error):
    return jsonify({
        "error": "Not Found",
        "message": "The requested resource was not found.",
    }), 404
