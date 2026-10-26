from flask import jsonify

from backend.image_converter.config import settings


def handle_request_entity_too_large(e):
    """The request is above MAX_UPLOAD_SIZE_MB; it is refused before anything is stored."""
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
