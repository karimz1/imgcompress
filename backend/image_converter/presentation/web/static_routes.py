# static_routes.py
import os
from flask import Blueprint, jsonify, send_from_directory, abort, current_app

static_blueprint = Blueprint("static_blueprint", __name__)

def serve_static_file(filename: str):
    """
    Serve a file from the Flask app's configured static_folder.
    current_app.static_folder is set by your main Flask app.
    """
    try:
        return send_from_directory(current_app.static_folder, filename)
    except Exception as e:
        current_app.logger.error(f"Error serving static file {filename}: {e}")
        return jsonify({
            "error": "File Not Found",
            "message": f"The requested file {filename} was not found on the server."
        }), 404


@static_blueprint.errorhandler(404)
def not_found_handler(error):
    """
    If a route is not found (while in this blueprint), serve index.html.
    This is typical for client-side routing in SPAs (React, Next.js, etc.).
    """
    return serve_static_file("index.html")


@static_blueprint.route("/")
def serve_index():
    """
    Serve the main index.html at the root URL.
    """
    return serve_static_file("index.html")


@static_blueprint.route("/_next/static/<path:path>")
def serve_next_static(path):
    """
    Serve files from the Next.js .next/static folder.
    """
    return send_from_directory(
        os.path.join(current_app.static_folder, "_next", "static"),
        path
    )


@static_blueprint.route("/<path:path>")
def serve_out_files(path):
    """
    Catch-all route for non-API paths:
      1) If it starts with 'api/', abort(404) so it can bubble up to your API blueprint.
      2) Else, serve the file if it exists.
      3) If no file, serve index.html for SPA routing.
    """
    if path.startswith("api/"):
        abort(404)

    full_path = os.path.join(current_app.static_folder, path)
    if os.path.exists(full_path) and os.path.isfile(full_path):
        return send_from_directory(current_app.static_folder, path)

    return serve_static_file("index.html")
