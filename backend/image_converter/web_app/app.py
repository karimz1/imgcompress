
import os
import time
import shutil
import tempfile
from flask import Flask, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename


from backend.image_converter.core.processor import ImageConversionProcessor
from backend.image_converter.core.args_namespace import ArgsNamespace
import tempfile
from typing import List
import shutil


###############################################################################
# Create the Flask app
###############################################################################
app = Flask(__name__, static_folder=None)  # We'll manually serve files


@app.route("/")
def serve_index():
    return send_from_directory("static_site", "index.html")

@app.route("/_next/static/<path:path>")
def serve_next_static(path):
    return send_from_directory("static_site/_next/static", path)


@app.route("/<path:path>")
def serve_out_files(path):
    full_path = os.path.join("static_site", path)
    if os.path.exists(full_path):
        return send_from_directory("static_site", path)
    else:
        # fallback to index.html if it's an SPA route
        return send_from_directory("static_site", "index.html")


###############################################################################
# /api/compress
# Expects a POST with form-data:
#   - "files[]" for the uploaded images
#   - "quality" (e.g. "85")
#   - "width" (e.g. "800" or blank)
###############################################################################
@app.route("/api/compress", methods=["POST"])
def compress_images():
    # 1) Extract form data
    uploaded_files = request.files.getlist("files[]")
    quality_str = request.form.get("quality", "85")
    width_str = request.form.get("width", "")

    # Convert quality/width to integers if possible
    try:
        quality = int(quality_str)
    except ValueError:
        quality = 85

    width = None
    if width_str.strip():
        try:
            width = int(width_str)
        except ValueError:
            width = None

    # 2) Validate we have files
    if not uploaded_files:
        return jsonify({"error": "No files uploaded"}), 400

    # 3) Create temp folders for input & output
    source_folder = tempfile.mkdtemp(prefix="source_")
    dest_folder = tempfile.mkdtemp(prefix="converted_")

    # 4) Save the uploaded files into source_folder
    for f in uploaded_files:
        filename = secure_filename(f.filename)
        f.save(os.path.join(source_folder, filename))

    # 5) Build arguments for your existing processor
    # If your code uses debug/json_output, set them accordingly
    args_obj = ArgsNamespace(
        source=source_folder,
        destination=dest_folder,
        quality=quality,
        width=width,
        debug=False,
        json_output=True  # <-- If you want your processor to output JSON logs
    )

    # 6) Run your processor
    processor = ImageConversionProcessor(args_obj)
    processor.run()

    # -------------------------------------------------------------------------
    # Option A: If your processor prints JSON to stdout, you can capture it or
    #           just build a custom response. For example, if run() returns a
    #           summary dict or logs, you can do:
    # summary = processor.generate_summary()
    # return jsonify(summary)
    #
    # Option B: If your processor writes a final JSON, read it. Or if "json_output"
    #           prints to stdout, you can parse that. The simplest is to gather
    #           the final results from "processor.results" or "summary".
    # -------------------------------------------------------------------------

    # Example: gather results from the final run (like the new .jpg files):
    converted_files = os.listdir(dest_folder)

    # If you want to merge in the processor's logs or summary, do so here:
    # e.g. summary = processor.generate_summary()

    # 7) Return JSON
    return jsonify({
        "status": "ok",
        "converted_files": converted_files,
        "dest_folder": dest_folder
        # "summary": summary,  # if you want to attach more info
    })

###############################################################################
# /api/download
# Download a previously converted file from the "dest_folder"
###############################################################################
@app.route("/api/download", methods=["GET"])
def download_file():
    folder = request.args.get("folder")
    filename = request.args.get("file")
    return send_from_directory(folder, filename, as_attachment=True)

@app.route("/api/download_all", methods=["GET"])
def download_all():
    """
    GET /api/download_all?folder=<dest_folder>
    Zips everything in `folder`, returns the .zip as attachment.
    """
    folder = request.args.get("folder")
    if not folder:
        return jsonify({"error": "No folder specified"}), 400

    if not os.path.exists(folder) or not os.path.isdir(folder):
        return jsonify({"error": "Folder does not exist"}), 404

    # Create a unique name for the zip
    # e.g. "converted_1674503800.zip"
    timestamp = int(time.time())
    zip_filename = f"converted_{timestamp}.zip"

    # We'll create the zip inside a temp directory.
    tmp_dir = tempfile.gettempdir()
    zip_path = os.path.join(tmp_dir, zip_filename)

    # Zip all files from `folder`
    # e.g., shutil.make_archive("/path/to/myarchive", 'zip', root_dir=folder)
    # But `make_archive` will append ".zip" automatically if needed,
    # so we pass zip_path without .zip for the "base_name".
    base_name = zip_path[:-4]  # remove ".zip"
    shutil.make_archive(base_name, 'zip', root_dir=folder)

    # Now "zip_path" should be a valid zip containing everything from `folder`.
    # Return it with send_from_directory
    return send_from_directory(tmp_dir, zip_filename, as_attachment=True, mimetype='application/zip')