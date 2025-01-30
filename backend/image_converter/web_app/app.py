import os
from flask import Flask, request, render_template, send_from_directory, redirect, url_for
from werkzeug.utils import secure_filename
from image_converter.core.processor import ImageConversionProcessor
from image_converter.core.args_namespace import ArgsNamespace
import tempfile
from typing import List
import shutil

app = Flask(__name__)
# For local dev; I need to change it in production, adjust or use a more robust path hahaha
app.config['UPLOAD_FOLDER'] = '/tmp/uploads'
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

class ArgsNamespace:
    """Minimal class to mimic argparse.Namespace behavior."""
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)

@app.route("/", methods=["GET", "POST"])
def index():
    converted_files: List[str] = []

    if request.method == "POST":
        mode = request.form.get("mode", "single")
        quality = request.form.get("quality", "85")
        width = request.form.get("width", "800")

        # Convert quality/width to integers, or None if blank
        try:
            quality = int(quality)
        except ValueError:
            quality = 85

        try:
            width = int(width)
        except ValueError:
            width = None

        uploaded_files = request.files.getlist("images")

        # This folder will hold any "batch" of uploaded images
        with tempfile.TemporaryDirectory() as source_folder:
            # Also prepare a destination for the converter
            dest_folder = os.path.join("/tmp", "converted")
            os.makedirs(dest_folder, exist_ok=True)

            # 1) SINGLE MODE
            if mode == "single" and len(uploaded_files) > 0:
                file = uploaded_files[0]  # take the first file only
                if file.filename.strip() != "":
                    filename = secure_filename(file.filename)
                    source_path = os.path.join(source_folder, filename)
                    file.save(source_path)

                    # Prepare the processor arguments
                    args_obj = ArgsNamespace(
                        source=source_path,       # single file
                        destination=dest_folder,  # folder for .jpg output
                        quality=quality,
                        width=width,
                        debug=False,
                        json_output=False
                    )

                    processor = ImageConversionProcessor(args_obj)
                    processor.run()

                    # The processor typically creates <filename>.jpg in dest_folder
                    # We can’t know all the names if the user had .png etc.
                    # Let's see what the file was converted to:
                    # It's <base_name>.jpg according to your code
                    base, ext = os.path.splitext(filename)
                    converted_name = base + ".jpg"
                    converted_files.append(converted_name)

            # 2) FOLDER MODE
            elif mode == "folder" and len(uploaded_files) > 0:
                # Save all uploaded files into `source_folder`
                for file in uploaded_files:
                    if file.filename.strip() == "":
                        continue
                    filename = secure_filename(file.filename)
                    source_path = os.path.join(source_folder, filename)
                    file.save(source_path)

                # Now `source_folder` has multiple images
                args_obj = ArgsNamespace(
                    source=source_folder,    # directory
                    destination=dest_folder, # all processed files go here
                    quality=quality,
                    width=width,
                    debug=False,
                    json_output=False
                )
                processor = ImageConversionProcessor(args_obj)
                processor.run()

                # Collect all .jpg that were generated in `dest_folder`
                # (or you can read from processor.results to see which files were processed)
                for f in os.listdir(dest_folder):
                    converted_files.append(f)
            else:
                # No files or no known mode
                pass

    return render_template("index.html", converted=converted_files)

@app.route("/download/<filename>")
def download(filename):
    # Serve the file from /tmp/converted
    return send_from_directory("/tmp/converted", filename, as_attachment=True)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
