# file: backend/image_converter/presentation/web/error_handlers.py

from flask import jsonify, request
from werkzeug.exceptions import RequestEntityTooLarge, HTTPException

def handle_request_entity_too_large(e):
    return jsonify({
        "error": "Payload Too Large",
        "message": "The uploaded files exceed the maximum allowed size."
    }), 413

def handle_http_exception(e):
    response = e.get_response()
    response.data = jsonify({
        "error": e.name,
        "description": e.description,
        "code": e.code
    }).data
    response.content_type = "application/json"
    return response, e.code

def handle_exception(e):
    # fallback for all unhandled exceptions
    return jsonify({
        "error": "Internal Server Error",
        "message": "An unexpected error occurred. Please try again later."
    }), 500

def not_found(error):
    # If a route is not found, we return JSON or could serve an index.html
    return jsonify({
        "error": "Not Found",
        "message": "The requested resource was not found."
    }), 404
