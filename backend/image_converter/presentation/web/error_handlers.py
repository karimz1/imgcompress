from flask import jsonify, request
from werkzeug.exceptions import RequestEntityTooLarge, HTTPException

def handle_request_entity_too_large(e):
    return jsonify({
        "error": "Payload Too Large",
        "message": "The uploaded files exceed the maximum allowed size."
    }), 413

import traceback

def handle_http_exception(e):
    response = e.get_response()
    
    data = {
        "error": e.name,
        "description": e.description,
        "code": e.code
    }
    
    if e.code == 500:
        data["stacktrace"] = traceback.format_exc()
        if "The server encountered an internal error" in data["description"]:
             data["message"] = str(e)

    response.data = jsonify(data).data
    response.content_type = "application/json"
    return response, e.code

def not_found(error):
    return jsonify({
        "error": "Not Found",
        "message": "The requested resource was not found."
    }), 404
