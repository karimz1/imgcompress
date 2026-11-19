"""The OpenAPI 3.1 document of /api/v1: the contract of the API.

Built from the same option list the request parsing uses
(application/conversion_options), so a documented default, limit or choice
is always the one the container applies. Every route of the blueprint must
appear here; tests/unit/test_openapi_spec.py fails otherwise.

Versioning: /api/v1 only grows. New endpoints, new optional fields and new
response fields can come in any release; nothing is renamed, removed or made
stricter. A breaking change gets /api/v2, served next to v1 for a while.
"""

import os
from html import escape

from backend.image_converter.application import conversion_options as options
from backend.image_converter.config import settings
from backend.image_converter.domain.fit_layers import MAX_IMAGE_LAYERS
from backend.image_converter.infrastructure.notifier import (
    PUBLIC_BASE_URL_ENV,
    clean_public_base_url,
)
from backend.image_converter.presentation.web.api_access import API_PREFIX
from backend.image_converter.presentation.web.api_auth import API_KEY_HEADER

API_VERSION = "1"
SPEC_VERSION = "1.0.0"
SITE_URL = "https://imgcompress.karimzouine.com"
AUTHOR_URL = "https://www.karimzouine.com"
DOCS_URL = f"{SITE_URL}/docs"
GITHUB_URL = "https://github.com/karimz1/imgcompress"
LICENSE_NAME = "GPL-3.0-or-later"
LICENSE_URL = "https://www.gnu.org/licenses/gpl-3.0.html"
# Files served under /api/v1/docs/<name>: swagger-ui-dist (copied at build) plus ours.
DOCS_ASSETS = (
    "swagger-ui.css", "swagger-ui-bundle.js", "swagger-ui-init.js", "imgcompress-docs.css",
    "logo.webp", "favicon.webp", "og-image.webp",
)
DOCS_TITLE = "imgcompress API docs, self-hosted image compression REST API"
DOCS_META_DESCRIPTION = (
    "Self-hosted REST API for image compression, conversion, editing and AI tools. "
    "Offline, private, free and open source. Compress 70+ formats, no cloud."
)
# Typical values, named in the field description only (never prefilled).
_RECOMMENDED = {"format": "webp", "quality": "80", "fit_width": "1080", "fit_height": "1080"}

# Example values in the exact format the container produces (secrets.token_urlsafe),
# never shortened: Swagger UI is a playground and people copy these.
_JOB_ID_PATTERN = "^[A-Za-z0-9_-]{22}$"  # token_urlsafe(16), conversion_job_store
_TOKEN_PATTERN = "^[A-Za-z0-9_-]{43}$"  # token_urlsafe(32): job, claim and share tokens
_SESSION_PATTERN = "^[A-Za-z0-9_-]{32}$"  # token_urlsafe(24), editor_asset_store
_ASSET_PATTERN = "^[A-Za-z0-9_-]{22}$"  # token_urlsafe(16), editor_asset_store
EXAMPLE_JOB_ID = "g30-VsIgWqrDkMS4a-bFJg"
EXAMPLE_JOB_TOKEN = "qs753DugZX5xOse40hTZUxJ0i58e-F5Zt7T6LzQnj9M"
EXAMPLE_CLAIMED_TOKEN = "J3bPZLbX79-JUO917GDk8j4wemJ_bJTRQ7B2Hu-OXtU"
EXAMPLE_SESSION = "r_z3VM0QmTufB9pGvuFJfOMr83mu8rv2"
EXAMPLE_ASSET = "ZZn7mT-kj8Iozp-imxUl8A"
# A complete 2x2 PNG, so the example is a data URL that really opens.
EXAMPLE_PREVIEW = (
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR42mMUTT3AwMDAxMDAwMDAAAAONwE"
    "+iByHdQAAAABJRU5ErkJggg=="
)

_ERROR_EXAMPLES = {
    400: "'quality' must be a whole number between 1 and 100.",
    401: f"Send the API key as 'Authorization: Bearer <key>' or '{API_KEY_HEADER}: <key>'.",
    403: "This container does not accept requests from other websites. Set ENABLE_PUBLIC_API=true to allow them.",
    404: "Job not found. It may have expired, or the X-Job-Token is wrong.",
    409: "Job already finished.",
    410: "The editor pictures expired. Please try again.",
    413: "The upload is larger than the limit of 40960 MB (MAX_UPLOAD_SIZE_MB).",
    415: "Unsupported file types: notes.txt. GET /api/v1/formats lists the supported ones.",
    422: "Image processing failed: broken.jpg: cannot identify image file",
    500: "An unexpected error occurred. See the container logs for details.",
}
_ERROR_TEXT = {
    400: "Invalid options or form. `message` says which field and what is allowed.",
    401: "PUBLIC_API_KEY is set and the request is neither from the web UI nor carries the key.",
    403: "A browser on another website sent this while ENABLE_PUBLIC_API is off, "
    "or the feature is turned off on this container (storage management).",
    404: "Unknown id, wrong token, or expired. These are not told apart on purpose.",
    409: "Conflicts with the current state (see `message`).",
    410: "The editor session expired; upload the pictures again with a new session.",
    413: "The request is larger than MAX_UPLOAD_SIZE_MB. Nothing was stored.",
    415: "A file type the container cannot read. GET /formats lists `supported_formats`.",
    422: "The files were readable as a form but none could be converted.",
    500: "Unexpected failure inside the container; details are in the container log.",
}


def _ref(name: str) -> dict:
    return {"$ref": f"#/components/schemas/{name}"}


def _json(schema: dict, example=None) -> dict:
    body = {"schema": schema}
    if example is not None:
        body["example"] = example
    return {"application/json": body}


def _error_response(status: int) -> dict:
    return {
        "description": _ERROR_TEXT[status],
        "content": _json(_ref("Error"), {"error": _error_name(status), "message": _ERROR_EXAMPLES[status]}),
    }


def _error_name(status: int) -> str:
    from backend.image_converter.presentation.web.api_errors import ERROR_NAMES

    return ERROR_NAMES[status]


def _errors(*statuses: int) -> dict:
    return {str(status): {"$ref": f"#/components/responses/E{status}"} for status in statuses}


def _with_gate_errors(paths: dict, keyed: bool) -> dict:
    """
    Adds the answers the access gate can give before any route runs, so no
    operation can forget them: 403 for other websites (every route but the docs,
    which answer 404 instead) and 401 for a missing key (every keyed route).

    Without PUBLIC_API_KEY nothing needs a key, so the document carries no
    `security` at all: Swagger UI then shows no locks and no Authorize button.
    Open routes (health, docs) are marked `security: []` in _paths.
    """
    for item in paths.values():
        for operation in item.values():
            is_open = operation.get("security") == []
            gate = []
            if operation["tags"] != ["Docs"]:
                gate.append(403)
            if keyed and not is_open:
                gate.append(401)
            if not keyed:
                operation.pop("security", None)
            responses = {**operation["responses"], **_errors(*gate)}
            operation["responses"] = dict(sorted(responses.items()))
    return paths


def _binary(description: str, media_types=("application/octet-stream",), headers=None) -> dict:
    response = {
        "description": description,
        "content": {media: {"schema": {"type": "string", "format": "binary"}} for media in media_types},
    }
    if headers:
        response["headers"] = headers
    return response


def _fmt_number(value) -> str:
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return f"{value:g}" if isinstance(value, float) else str(value)


def _fmt_omitted(value) -> str:
    if value is False:
        return "off"
    if value is True:
        return "true"
    return _fmt_number(value) if isinstance(value, (int, float)) else str(value)


def _range_text(option: options.Option) -> str:
    """Allowed range or choices, for the field description (not a prefilled value)."""
    if option.kind == options.BOOLEAN:
        return "true or false"
    if option.choices:
        return "Values: " + ", ".join(option.choices)
    if option.minimum is not None and option.maximum is not None:
        return f"Range: {_fmt_number(option.minimum)} to {_fmt_number(option.maximum)}"
    if option.minimum is not None:
        return f"Min: {_fmt_number(option.minimum)}"
    if option.maximum is not None:
        return f"Max: {_fmt_number(option.maximum)}"
    return ""


def _option_description(option: options.Option, required: bool = False) -> str:
    """What the field does, allowed values, a recommended value, and what omitting it means.

    `default` and `example` stay off the schema so Swagger UI never prefills a field.
    Omitting a field keeps the web UI's start state (features off).
    """
    text = option.description.rstrip(".") + "."
    span = _range_text(option)
    if span and option.kind != options.BOOLEAN:
        text += f" {span}."
    recommended = _RECOMMENDED.get(option.name)
    if recommended is not None:
        text += f" Recommended: {recommended}."
    if required:
        text += " Required."
    elif option.kind == options.BOOLEAN or option.default is False:
        text += " If omitted: off."
    elif option.default is not None:
        text += f" If omitted: {_fmt_omitted(option.default)}."
    else:
        text += " If omitted: not applied."
    if option.aliases:
        text += f" Alias: {', '.join(option.aliases)}."
    return text


def option_schema(option: options.Option, required: bool = False) -> dict:
    """JSON Schema of one form field, from the option list.

    Min, max and enum stay on the schema (they constrain, they do not prefill).
    Default and example stay off, so Swagger's Try-it-out starts empty.
    """
    kind = {options.BOOLEAN: "boolean", options.INTEGER: "integer", options.NUMBER: "number"}.get(
        option.kind, "string"
    )
    schema: dict = {"type": kind, "description": _option_description(option, required=required)}
    if option.minimum is not None:
        schema["minimum"] = option.minimum
    if option.maximum is not None:
        schema["maximum"] = option.maximum
    if option.choices:
        schema["enum"] = list(option.choices)
    if option.repeated:
        return {"type": "array", "items": {"type": "string"}, "description": schema["description"]}
    return schema

def _form(options_list, required=(), extra=None, example=None) -> dict:
    required_names = set(required)
    properties = dict(extra or {})
    for option in options_list:
        properties[option.name] = option_schema(option, required=option.name in required_names)
    schema = {"type": "object", "properties": properties}
    if required:
        schema["required"] = list(required)
    media = {"schema": schema, "encoding": {"files[]": {"contentType": "image/*, application/pdf, */*"}}}
    if example is not None:
        media["example"] = example
    return {"required": True, "content": {"multipart/form-data": media}}


def _conversion_form(with_output: bool) -> dict:
    files = {
        "files[]": {
            "type": "array",
            "items": {"type": "string", "format": "binary"},
            "description": options.FILES.description,
        },
    }
    option_list = options.CONVERSION_OPTIONS + ((options.OUTPUT,) if with_output else ())
    return _form(option_list, required=("files[]", "format"), extra=files)


# No `example` on parameters: Swagger UI would prefill Try-it-out with it.
_JOB_ID = {
    "name": "job_id", "in": "path", "required": True,
    "description": "The `id` from POST /jobs.",
    "schema": {"type": "string", "pattern": _JOB_ID_PATTERN},
}
_JOB_TOKEN = {
    "name": "X-Job-Token", "in": "header", "required": True,
    "description": "The `token` from POST /jobs or POST /jobs/{job_id}/claim. A header, so it stays out of URLs and logs.",
    "schema": {"type": "string"},
}
_STORAGE_NOTE = (
    "\n\nStorage management can see the files of **every** user of the container. "
    "Answers 403 when the container runs with DISABLE_STORAGE_MANAGEMENT=true."
)


def _curl(lines: str) -> str:
    return f"\n\n```bash\n{lines}\n```"


# Shown in curl examples when PUBLIC_BASE_URL is not set, so the document never
# hardcodes localhost. Swagger itself then uses the relative server URL.
_EXAMPLE_ORIGIN = "https://imgcompress.example.com"


def _spec_urls(script_root: str = "") -> tuple[str, str, str, str]:
    """Server URL and curl base for /api/v1, then the same for the legacy health path.

    With PUBLIC_BASE_URL (the same env as the ntfy share links), both use that
    origin with a trailing slash stripped. Without it, the server is a relative
    path so Swagger talks to the current origin, and curl examples use a
    placeholder host instead of localhost.
    """
    origin = clean_public_base_url(os.environ.get(PUBLIC_BASE_URL_ENV))
    if origin:
        origin = origin.rstrip("/")
        return f"{origin}{API_PREFIX}", f"{origin}{API_PREFIX}", origin, origin
    return (
        f"{script_root}{API_PREFIX}",
        f"{_EXAMPLE_ORIGIN}{API_PREFIX}",
        script_root or "/",
        _EXAMPLE_ORIGIN,
    )


def _paths(base: str, keyed: bool = True) -> dict:
    auth = ' \\\n  -H "Authorization: Bearer $PUBLIC_API_KEY"' if keyed else ""
    return {
        "/health": {"get": {
            "tags": ["Health"], "operationId": "health", "security": [],
            "summary": "Is the container up?",
            "description": "Cheap liveness check. Never needs the API key, so health checks and uptime "
            "monitors work with PUBLIC_API_KEY set. `python /container/healthcheck.py` uses it. "
            "GET /api/health/backend is a deprecated alias of this route and will be removed in 2.0."
            + _curl(f"curl -fsS {base}/health"),
            "responses": {"200": {"description": "The container answers.", "content": _json(
                _ref("Health"), {"status": "running", "api_version": "1", "utc_time": "2026-11-16T09:30:00+00:00"})}},
        }},
        "/health/internet": {"get": {
            "tags": ["Health"], "operationId": "healthInternet", "security": [],
            "summary": "Can the container reach the internet?",
            "description": "Tries a TCP connection to 1.1.1.1:53 for up to one second. Everything works offline; "
            "the web UI only uses this for its status badge." + _curl(f"curl -fsS {base}/health/internet"),
            "responses": {"200": {"description": "Result of the check.", "content": _json(
                _ref("InternetHealth"), {"internet": False, "utc_time": "2026-11-16T09:30:00+00:00"})}},
        }},
        "/info": {"get": {
            "tags": ["Info"], "operationId": "info",
            "summary": "Versions, limits and switched-on features",
            "description": "What this container allows: upload limit (MAX_UPLOAD_SIZE_MB), output size limit for "
            "AI upscaling, how long results are kept, and whether the API key, storage management and "
            "notifications are on." + _curl(f"curl -fsS {base}/info{auth}"),
            "responses": {"200": {"description": "Container settings.", "content": _json(_ref("Info"), {
                "api_version": "1", "app_version": "1.1.0", "public_api_enabled": True, "auth_required": True,
                "storage_management_enabled": True, "notifications_enabled": False,
                "limits": {"max_upload_size_mb": 40960, "max_output_megapixels": 144,
                           "max_fit_dimension": 8192, "result_retention_seconds": 172800}})}},
        }},
        "/formats": {"get": {
            "tags": ["Info"], "operationId": "formats",
            "summary": "Input and output formats",
            "description": "`supported_formats`: file extensions the container reads (70+, from Pillow plus the "
            "PDF, PSD, SVG and HEIC pipelines). `verified_formats`: the ones tested in CI. "
            "`preview_unsupported_formats`: inputs POST /preview cannot render (they still convert). "
            "`output_formats`: values for the `format` field." + _curl(f"curl -fsS {base}/formats{auth}"),
            "responses": {"200": {"description": "Format lists.", "content": _json(_ref("Formats"), {
                "supported_formats": [".avif", ".heic", ".jpg", ".png", ".psd", ".webp"],
                "verified_formats": [".heic", ".png", ".jpg"],
                "preview_unsupported_formats": [".pdf", ".raw"],
                "output_formats": list(options.FORMAT.choices)})}},
        }},
        "/models/remove-background": {"get": {
            "tags": ["Info"], "operationId": "removeBackgroundModel",
            "summary": "Background removal model",
            "description": "The bundled rembg model used for `remove_background=true`. Runs offline in the container.",
            "responses": {"200": {"description": "Model name.", "content": _json(
                _ref("RemoveBackgroundModel"), {"model_name": "u2net"})}},
        }},
        "/models/upscale": {"get": {
            "tags": ["Info"], "operationId": "upscaleModels",
            "summary": "AI upscaling models",
            "description": "The bundled Real-ESRGAN models (values for `upscale_model`) and whether each one is "
            "installed in this image.",
            "responses": {"200": {"description": "Model status.", "content": _json(_ref("UpscaleModels"), {
                "models": [{"id": "general", "model_name": "realesrgan-x4plus", "available": True}]})}},
        }},
        "/convert": {"post": {
            "tags": ["Convert"], "operationId": "convert",
            "summary": "Convert and get the result right away",
            "description": "Compress, convert, resize, remove the background, upscale or fit images, and get "
            "the result in the answer. One result comes back as the file itself, several as a ZIP "
            "(`output=zip` always gives a ZIP). Nothing is kept on the container afterwards.\n\n"
            "The request stays open until the conversion is done. For AI upscaling or big batches, "
            "use POST /jobs: proxies often cut long requests.\n\n"
            "Response headers: `X-Converted-Count` and `X-Failed-Count`. Files that fail in a batch are "
            "left out of the ZIP; when all fail, the answer is 422."
            + _curl(
                f"# Compress a photo to WebP, 1600 px wide\ncurl -fsS {base}/convert{auth} \\\n"
                '  -F "files[]=@photo.jpg" -F format=webp -F quality=80 -F width=1600 \\\n  -o photo.webp'
            )
            + _curl(
                f"# Remove the background, keep transparency\ncurl -fsS {base}/convert{auth} \\\n"
                '  -F "files[]=@product.jpg" -F format=png -F remove_background=true -o product.png'
            ),
            "requestBody": _conversion_form(with_output=True),
            "responses": {
                "200": _binary(
                    "The converted file, or a ZIP of all results. `Content-Disposition` has the file name.",
                    ("image/jpeg", "image/png", "image/webp", "image/avif", "image/vnd.microsoft.icon",
                     "application/pdf", "application/zip"),
                    headers={
                        "X-Converted-Count": {"description": "Files converted.", "schema": {"type": "integer"}},
                        "X-Failed-Count": {"description": "Files that failed.", "schema": {"type": "integer"}},
                    },
                ),
                **_errors(400, 413, 415, 422, 500),
            },
        }},
        "/jobs": {"post": {
            "tags": ["Jobs"], "operationId": "startJob",
            "summary": "Start a background conversion",
            "description": "Same form as POST /convert (without `output`), but answers at once with 202 and a "
            "job. The conversion keeps running if the caller goes away. Poll GET /jobs/{job_id} with the "
            "`X-Job-Token` header until `status` is `done`, `failed` or `canceled`, then download the files "
            "or the ZIP. Results are kept for `result_retention_seconds` (GET /info) after the last access."
            "\n\nThe web UI converts through this endpoint."
            + _curl(
                f"curl -fsS {base}/jobs{auth} \\\n"
                '  -F "files[]=@small.png" -F format=png -F upscale=4x -F upscale_model=general\n'
                f'# -> {{"id": "{EXAMPLE_JOB_ID}", "token": "{EXAMPLE_JOB_TOKEN}", "status": "queued"}}'
            ),
            "requestBody": _conversion_form(with_output=False),
            "responses": {
                "202": {
                    "description": "Job accepted. Keep `token`: it is shown only here.",
                    "headers": {"Location": {"description": "URL of the job.", "schema": {"type": "string"}}},
                    "content": _json(_ref("JobStarted"), {
                        "id": EXAMPLE_JOB_ID, "token": EXAMPLE_JOB_TOKEN, "status": "queued",
                        "progress": {"files_done": 0, "files_total": 1}, "device": "Linux · curl",
                        "created_at": 1763285400.0, "updated_at": 1763285400.0, "server_time": 1763285400.1}),
                },
                **_errors(400, 413, 415, 500),
            },
        }},
        "/jobs/{job_id}": {"get": {
            "tags": ["Jobs"], "operationId": "jobStatus",
            "summary": "Job status and progress",
            "description": "Poll every 1-2 seconds. `progress` has `files_done`/`files_total`, and for AI upscaling "
            "`tiles_done`/`tiles_total` (and `waiting` while another upscale holds the CPU). When `status` is "
            "`done`, `result.converted_files` lists the files to download. Every poll restarts the "
            "retention clock." + _curl(f'curl -fsS {base}/jobs/$JOB_ID{auth} \\\n  -H "X-Job-Token: $JOB_TOKEN"'),
            "parameters": [_JOB_ID, _JOB_TOKEN],
            "responses": {
                "200": {"description": "Current state.", "content": _json(_ref("JobState"), {
                    "id": EXAMPLE_JOB_ID, "status": "done",
                    "progress": {"files_done": 1, "files_total": 1, "tiles_done": 64, "tiles_total": 64},
                    "result": {"converted_files": ["small.png"],
                               "process_summary": {"processed_files": ["small.png"], "errors": []}},
                    "device": "Linux · curl", "created_at": 1763285400.0, "updated_at": 1763285431.2,
                    "started_at": 1763285400.2, "finished_at": 1763285431.2, "duration_seconds": 31.0,
                    "server_time": 1763285432.0, "notify": False})},
                **_errors(404),
            },
        }},
        "/jobs/{job_id}/cancel": {"post": {
            "tags": ["Jobs"], "operationId": "cancelJob",
            "summary": "Stop a running job",
            "description": "The job ends as `canceled` shortly after; its files are removed.",
            "parameters": [_JOB_ID, _JOB_TOKEN],
            "responses": {"204": {"description": "Canceled (or already canceling)."}, **_errors(404, 409)},
        }},
        "/jobs/{job_id}/notify": {"post": {
            "tags": ["Jobs"], "operationId": "notifyJob",
            "summary": "Get a push message when the job ends",
            "description": "Turns \"notify me when done\" on or off for one job. The container sends a short "
            "message (image count and device, never file names) to NOTIFY_URL. With PUBLIC_BASE_URL set the "
            "message links to the result. 409 when NOTIFY_URL is not configured.",
            "parameters": [_JOB_ID, _JOB_TOKEN],
            "requestBody": {"required": True, "content": _json(_ref("NotifyRequest"))},
            "responses": {"204": {"description": "Saved."}, **_errors(404, 409)},
        }},
        "/jobs/{job_id}/claim": {"post": {
            "tags": ["Jobs"], "operationId": "claimJob",
            "summary": "Open a job from a notification link",
            "description": "Trades the share token of a notification link for a job token of the calling "
            "device, which then works with `X-Job-Token` like the one from POST /jobs.\n\n"
            "The share token exists only in the link `/r/{job_id}/{share_token}` of a notification. The container "
            "creates it when a job finishes with notify on (POST /jobs/{job_id}/notify) and NOTIFY_URL set. "
            "It is **not** the job token from POST /jobs. Send it in the body, never in a URL.",
            "parameters": [_JOB_ID],
            "requestBody": {"required": True, "content": _json(_ref("ClaimRequest"))},
            "responses": {
                "200": {"description": "A job token for this device.", "content": _json(
                    _ref("JobClaim"), {"id": EXAMPLE_JOB_ID, "token": EXAMPLE_CLAIMED_TOKEN})},
                "404": {"description": "Unknown or expired job, or a wrong share token. These are not told apart "
                        "on purpose.", "content": _json(_ref("Error"), {
                            "error": "Not Found",
                            "message": "Job not found. It may have expired, or the share token is wrong."})},
            },
        }},
        "/jobs/{job_id}/files/{file_name}": {"get": {
            "tags": ["Jobs"], "operationId": "jobFile",
            "summary": "Download one result file",
            "description": "`file_name` is one entry of `result.converted_files` (may contain `/` when folder "
            "structure was kept)." + _curl(
                f'curl -fsS {base}/jobs/$JOB_ID/files/small.png{auth} \\\n  -H "X-Job-Token: $JOB_TOKEN" -o small.png'),
            "parameters": [_JOB_ID, {"name": "file_name", "in": "path", "required": True,
                                     "description": "Name from `result.converted_files`.",
                                     "schema": {"type": "string"}}, _JOB_TOKEN],
            "responses": {"200": _binary("The file."), **_errors(404)},
        }},
        "/jobs/{job_id}/zip": {"get": {
            "tags": ["Jobs"], "operationId": "jobZip",
            "summary": "Download all result files as ZIP",
            "description": "Built per request and never stored, so nobody else can fetch it.",
            "parameters": [_JOB_ID, _JOB_TOKEN],
            "responses": {"200": _binary("ZIP of all results.", ("application/zip",)), **_errors(404)},
        }},
        "/preview": {"post": {
            "tags": ["Editor"], "operationId": "preview",
            "summary": "Render any supported input as PNG",
            "description": "Decodes PSD, HEIC, RAW, SVG, EPS and the rest into a PNG, e.g. to show or crop it in an "
            "app. `X-Image-Width`/`X-Image-Height` give the original size. Formats in "
            "`preview_unsupported_formats` answer 415." + _curl(
                f'curl -fsS {base}/preview{auth} \\\n  -F "file=@design.psd" -o design.png'),
            "requestBody": _form((), required=("file",), extra={"file": {
                "type": "string", "format": "binary", "description": "The image to render."}}),
            "responses": {"200": _binary("PNG of the image.", ("image/png",), headers={
                "X-Image-Width": {"description": "Original width in pixels.", "schema": {"type": "integer"}},
                "X-Image-Height": {"description": "Original height in pixels.", "schema": {"type": "integer"}},
            }), **_errors(400, 413, 415)},
        }},
        "/edit": {"post": {
            "tags": ["Editor"], "operationId": "edit",
            "summary": "Crop, fit to size, add backgrounds, text and picture layers",
            "description": "Everything the web UI editor does, for one image. Send the image as `file` and the "
            "output size as `fit_width` and `fit_height`.\n\n"
            "- `render=true`: answers with the finished PNG at full size.\n"
            "- otherwise: JSON with `crop` (the selection in source pixels, e.g. what auto-crop picked) and a "
            "`preview` PNG as data URL, longest side at most 2048 px. `preview=false` leaves the preview out.\n\n"
            "Picture layers and a stored background need an editor session: upload each picture once with "
            "POST /editor/assets and pass `fit_session` plus the asset ids. A one-off background can also be "
            f"sent directly as `fit_background`. Up to {MAX_IMAGE_LAYERS} picture layers.\n\n"
            "To get another format, send the PNG to POST /convert." + _curl(
                f"# Instagram square with a blurred background and a caption\ncurl -fsS {base}/edit{auth} \\\n"
                '  -F "file=@photo.jpg" -F fit_width=1080 -F fit_height=1080 -F fit_mode=blur \\\n'
                "  -F 'fit_text={\"text\":\"Summer\",\"size\":0.1,\"y\":0.88}' -F render=true -o square.png"),
            "requestBody": _form(options.EDITOR_OPTIONS, required=("file", "fit_width", "fit_height"), extra={
                "file": {"type": "string", "format": "binary", "description": "The image to edit."},
                "fit_background": {"type": "string", "format": "binary",
                                   "description": "Background picture for fit_mode=image, without a session."},
                "render": {"type": "boolean",
                           "description": "true: answer with the full-size PNG instead of JSON. If omitted: off (JSON)."},
                "preview": {"type": "boolean",
                            "description": "JSON answer only: include the preview image. If omitted: true."},
            }),
            "responses": {
                "200": {"description": "PNG with `render=true`, else the selection and a preview.", "content": {
                    "image/png": {"schema": {"type": "string", "format": "binary"}},
                    **_json(_ref("EditResult"), {"crop": {
                        "x": 0, "y": 140, "width": 1080, "height": 1080, "originalWidth": 1080,
                        "originalHeight": 1350, "preset": "free",
                        "fit": {"width": 1080, "height": 1080, "mode": "crop"}},
                        "preview": EXAMPLE_PREVIEW}),
                }},
                **_errors(400, 410, 413),
            },
        }},
        "/editor/assets": {"post": {
            "tags": ["Editor"], "operationId": "uploadEditorAsset",
            "summary": "Store a picture for layers or backgrounds",
            "description": "Stores the picture once for an editor session, so POST /edit can use it many times by "
            "id. Without `session` a new session starts. Sessions are private (random ids, never listed) and "
            "expire with the other temporary files. 409: session full; 410: session expired, start a new one.",
            "requestBody": _form((), required=("file",), extra={
                "file": {"type": "string", "format": "binary", "description": "The picture."},
                "session": {"type": "string", "description": "Session from an earlier upload. If omitted: a new session."},
            }),
            "responses": {"200": {"description": "Stored.", "content": _json(_ref("EditorAsset"), {
                "session": EXAMPLE_SESSION, "asset": EXAMPLE_ASSET, "width": 800, "height": 600})},
                **_errors(400, 409, 410, 413)},
        }},
        "/storage": {"get": {
            "tags": ["Storage"], "operationId": "storageInfo",
            "summary": "Disk space used by temporary files", "description": "Used and free space of the temp folder." + _STORAGE_NOTE,
            "responses": {"200": {"description": "Sizes in MB.", "content": _json(
                _ref("StorageSummary"), {"used_storage_mb": 12.5, "available_storage_mb": 40210.0})}},
        }},
        "/storage/files": {"get": {
            "tags": ["Storage"], "operationId": "storageFiles",
            "summary": "All result files on the container", "description": "Every finished result file." + _STORAGE_NOTE,
            "responses": {"200": {"description": "File list.", "content": _json(_ref("ContainerInventory"), {
                "files": [{"folder": "converted_ab12", "folder_path": "/tmp/converted_ab12",
                           "filename": "photo.webp", "size_mb": 0.31}],
                "total_size_mb": 0.31, "total_count": 1})}},
        }},
        "/storage/files/download": {"get": {
            "tags": ["Storage"], "operationId": "storageDownloadFile",
            "summary": "Download one listed file", "description": "Only files of result folders can be served." + _STORAGE_NOTE,
            "parameters": [
                {"name": "folder", "in": "query", "required": True, "schema": {"type": "string"},
                 "description": "`folder_path` from GET /storage/files."},
                {"name": "file", "in": "query", "required": True, "schema": {"type": "string"},
                 "description": "`filename` from GET /storage/files."},
            ],
            "responses": {"200": _binary("The file."), **_errors(404)},
        }},
        "/storage/folders/download": {"get": {
            "tags": ["Storage"], "operationId": "storageDownloadFolder",
            "summary": "Download one result folder as ZIP", "description": "ZIP of one result folder." + _STORAGE_NOTE,
            "parameters": [{"name": "folder", "in": "query", "required": True, "schema": {"type": "string"},
                            "description": "`folder_path` from GET /storage/files."}],
            "responses": {"200": _binary("ZIP.", ("application/zip",)), **_errors(400)},
        }},
        "/storage/cleanup": {"post": {
            "tags": ["Storage"], "operationId": "storageCleanup",
            "summary": "Delete all finished results now",
            "description": "Deletes every finished result and upload. Running jobs are kept." + _STORAGE_NOTE,
            "responses": {"200": {"description": "Done.", "content": _json(
                _ref("Status"), {"status": "ok", "message": "Forced cleanup completed."})}, **_errors(500)},
        }},
        "/logs": {"get": {
            "tags": ["Storage"], "operationId": "logs",
            "summary": "Download the container log",
            "description": "The backend log as a text file, for bug reports." + _STORAGE_NOTE,
            "responses": {"200": _binary("Log file.", ("text/plain",))},
        }},
        "/openapi.json": {"get": {
            "tags": ["Docs"], "operationId": "openapi", "security": [],
            "summary": "This document",
            "description": "OpenAPI 3.1. Served only with ENABLE_PUBLIC_API=true (404 otherwise). Swagger UI: /api/v1/docs.",
            "responses": {"200": {"description": "The spec.", "content": _json({"type": "object"})}, **_errors(404)},
        }},
        "/docs": {"get": {
            "tags": ["Docs"], "operationId": "docs", "security": [],
            "summary": "Swagger UI",
            "description": "Interactive docs with \"Try it out\", served from the container (works offline). "
            "Only with ENABLE_PUBLIC_API=true (404 otherwise).",
            "responses": {"200": {"description": "HTML page.", "content": {"text/html": {"schema": {"type": "string"}}}},
                          **_errors(404)},
        }},
        "/docs/{name}": {"get": {
            "tags": ["Docs"], "operationId": "docsAsset", "security": [],
            "summary": "Swagger UI files", "description": "Scripts, style sheets and images of the Swagger UI page.",
            # Values in the text, not as enum: Swagger UI preselects the first enum of a required parameter.
            "parameters": [{"name": "name", "in": "path", "required": True,
                            "description": "File name. Values: " + ", ".join(DOCS_ASSETS) + ".",
                            "schema": {"type": "string"}}],
            "responses": {"200": _binary("The file.", ("text/css", "text/javascript", "image/webp")),
                          **_errors(404)},
        }},
    }


def _schemas() -> dict:
    number = {"type": "number"}
    string = {"type": "string"}
    strings = {"type": "array", "items": string}
    timestamp = {"type": "number", "description": "Unix time in seconds (container clock)."}
    summary = {"type": "object", "required": ["processed_files", "errors"], "properties": {
        "processed_files": strings, "errors": {**strings, "description": "One line per failed file."}}}
    return {
        "Error": {"type": "object", "required": ["error", "message"], "properties": {
            "error": {"type": "string", "description": "HTTP status name."},
            "message": {"type": "string", "description": "What went wrong and what to do."},
        }, "additionalProperties": True},
        "Health": {"type": "object", "required": ["status", "utc_time"], "properties": {
            "status": {"type": "string", "enum": ["running"]}, "api_version": string,
            "utc_time": {"type": "string", "format": "date-time"}}},
        "InternetHealth": {"type": "object", "required": ["internet", "utc_time"], "properties": {
            "internet": {"type": "boolean"}, "utc_time": {"type": "string", "format": "date-time"}}},
        "Info": {"type": "object", "required": ["api_version", "auth_required", "limits"], "properties": {
            "api_version": string,
            "app_version": {"type": ["string", "null"], "description": "Release of the container, null in dev builds."},
            "public_api_enabled": {"type": "boolean", "description": "ENABLE_PUBLIC_API."},
            "auth_required": {"type": "boolean", "description": "PUBLIC_API_KEY is set."},
            "storage_management_enabled": {"type": "boolean"},
            "notifications_enabled": {"type": "boolean", "description": "NOTIFY_URL is set."},
            "limits": {"type": "object", "required": ["max_upload_size_mb"], "properties": {
                "max_upload_size_mb": {"type": "integer", "description": "Largest request body (MAX_UPLOAD_SIZE_MB)."},
                "max_output_megapixels": {"type": "integer", "description": "Largest AI upscaling output."},
                "max_fit_dimension": {"type": "integer", "description": "Largest fit_width/fit_height."},
                "result_retention_seconds": {"type": "integer", "description": "How long idle results are kept."},
            }}}},
        "Formats": {"type": "object", "required": ["supported_formats", "verified_formats", "output_formats"],
                    "properties": {"supported_formats": strings, "verified_formats": strings,
                                   "preview_unsupported_formats": strings,
                                   "output_formats": {"type": "array", "items": {"type": "string",
                                                                                 "enum": list(options.FORMAT.choices)}}}},
        "RemoveBackgroundModel": {"type": "object", "required": ["model_name"], "properties": {"model_name": string}},
        "UpscaleModels": {"type": "object", "required": ["models"], "properties": {"models": {"type": "array", "items": {
            "type": "object", "required": ["id", "available"], "properties": {
                "id": {"type": "string", "enum": list(options.UPSCALE_MODEL.choices)},
                "model_name": string, "available": {"type": "boolean"}}}}}},
        "JobProgress": {"type": "object", "properties": {
            "files_done": {"type": "integer"}, "files_total": {"type": "integer"},
            "tiles_done": {"type": "integer", "description": "AI upscaling tiles done for the current file."},
            "tiles_total": {"type": "integer"},
            "waiting": {"type": "boolean", "description": "Waiting for another upscale to finish."}},
            "additionalProperties": True},
        "JobState": {"type": "object", "required": ["id", "status"], "properties": {
            "id": {"type": "string", "pattern": _JOB_ID_PATTERN},
            "status": {"type": "string", "enum": ["queued", "running", "done", "failed", "canceled"]},
            "progress": _ref("JobProgress"),
            "result": {"type": "object", "description": "With status done.", "properties": {
                "converted_files": strings, "process_summary": summary}},
            "error": {"type": "string", "description": "With status failed."},
            "device": {"type": "string", "description": "Short device/browser name, e.g. \"iPhone · Safari\"."},
            "created_at": timestamp, "updated_at": timestamp, "started_at": timestamp, "finished_at": timestamp,
            "duration_seconds": number, "server_time": timestamp,
            "notify": {"type": "boolean", "description": "Notification is on for this job."}},
            "additionalProperties": True},
        "JobStarted": {"allOf": [_ref("JobState"), {"type": "object", "required": ["token"], "properties": {
            "token": {"type": "string", "pattern": _TOKEN_PATTERN,
                      "description": "Send as X-Job-Token. Shown only once."}}}]},
        "JobClaim": {"type": "object", "required": ["id", "token"], "properties": {
            "id": {"type": "string", "pattern": _JOB_ID_PATTERN},
            "token": {"type": "string", "pattern": _TOKEN_PATTERN, "description": "Send as X-Job-Token."}}},
        "NotifyRequest": {"type": "object", "required": ["enabled"], "properties": {
            "enabled": {"type": "boolean", "description": "true turns the notification on, false off."},
            "language": {"type": "string", "description": "Message language, e.g. en or de; unknown = English."}}},
        "ClaimRequest": {"type": "object", "required": ["share_token"], "properties": {"share_token": {
            "type": "string", "pattern": _TOKEN_PATTERN,
            "description": "The last part of a notification link `/r/{job_id}/{share_token}`. Only there: it is "
            "created when the job finishes with notify on and NOTIFY_URL set. Not the job token from POST /jobs."}}},
        "EditorAsset": {"type": "object", "required": ["session", "asset", "width", "height"], "properties": {
            "session": {"type": "string", "pattern": _SESSION_PATTERN,
                        "description": "Pass as fit_session (and session for more uploads)."},
            "asset": {"type": "string", "pattern": _ASSET_PATTERN,
                      "description": "Use in fit_layers or fit_background_asset."},
            "width": {"type": "integer"}, "height": {"type": "integer"}}},
        "EditResult": {"type": "object", "required": ["crop"], "properties": {
            "crop": {"type": "object", "required": ["x", "y", "width", "height"], "properties": {
                "x": {"type": "integer"}, "y": {"type": "integer"},
                "width": {"type": "integer"}, "height": {"type": "integer"},
                "originalWidth": {"type": "integer"}, "originalHeight": {"type": "integer"},
                "fit": {"type": "object", "additionalProperties": True}}, "additionalProperties": True},
            "preview": {"type": "string", "description": "PNG as a data URL (data:image/png;base64, then the image)."}}},
        "StorageSummary": {"type": "object", "required": ["used_storage_mb", "available_storage_mb"], "properties": {
            "used_storage_mb": number, "available_storage_mb": number}},
        "ContainerInventory": {"type": "object", "required": ["files", "total_size_mb", "total_count"], "properties": {
            "files": {"type": "array", "items": {"type": "object", "required": ["folder", "folder_path", "filename", "size_mb"],
                                                  "properties": {"folder": string, "folder_path": string,
                                                                 "filename": string, "size_mb": number}}},
            "total_size_mb": number, "total_count": {"type": "integer"}}},
        "Status": {"type": "object", "required": ["status"], "properties": {"status": string, "message": string}},
    }


def _description(max_upload_mb: int, requires_key: bool, curl_base: str) -> str:
    key_state = "**set**" if requires_key else "**not set**"
    auth_line = '  -H "Authorization: Bearer $PUBLIC_API_KEY" \\\n' if requires_key else ""
    return f"""# ImgCompress, your self-hosted image toolbox. Compress every image format. Zero cloud.

Compress, convert, edit and upscale images in 70+ formats, with AI background removal built in.
Private, offline, free and open source. Own your data.

Prefer a web UI? It ships in the same container. [Website]({SITE_URL}) · [GitHub]({GITHUB_URL})

Created by [Karim Zouine]({AUTHOR_URL}) · License [{LICENSE_NAME}]({LICENSE_URL})

## Quick start

```bash
curl -fsS {curl_base}/convert \\
{auth_line}  -F "files[]=@photo.jpg" -F format=webp -o photo.webp
```

Base URL: `PUBLIC_BASE_URL` + `{API_PREFIX}`. Only `format` is required. Every other option is off
until you send it; allowed values and recommendations are in each field.

## Authentication

`PUBLIC_API_KEY` is {key_state} on this container. With a key, send `Authorization: Bearer <key>`
or `{API_KEY_HEADER}: <key>`. Health checks and these docs never need it.

## Modes

| Mode | Settings | Behaviour |
|---|---|---|
| Default | none | Web UI on. Scripts on your network can call the API; other websites get 403. No docs. |
| Web UI + API | `ENABLE_PUBLIC_API=true`, optional `PUBLIC_API_KEY` | Docs and CORS on. The key does not protect the web UI; on the internet use API only or proxy auth (Authelia, Authentik, Basic Auth). |
| API only | `API_ONLY=true` and `PUBLIC_API_KEY` | No web UI. Every call except health and docs needs the key. The container does not start without one. |

## Errors and limits

- Errors are JSON: `{{"error": "Bad Request", "message": "'quality' must be a whole number between 1 and 100."}}`.
- Uploads up to **{max_upload_mb} MB** (`MAX_UPLOAD_SIZE_MB`), else 413.
- `POST /convert` waits for the result. Use `POST /jobs` for AI upscaling and big batches.
- Job results answer only to their `X-Job-Token`. Storage routes see every user's files; turn them off with `DISABLE_STORAGE_MANAGEMENT=true`.
- `{API_PREFIX}` only grows. Breaking changes get `/api/v2`; deprecated routes go in 2.0. `info.version` is the version of the v1 contract.
"""


def _legacy_health_alias(server_root: str, curl_origin: str) -> dict:
    """GET /api/health/backend: same handler as /api/v1/health, documented off the v1 prefix."""
    return {"/api/health/backend": {"get": {
        "servers": [{"url": server_root, "description": "Container root (legacy path, not under /api/v1)"}],
        "tags": ["Health"], "operationId": "legacyHealthBackend", "security": [],
        "deprecated": True,
        "summary": "Legacy alias of GET /health",
        "description": "Same answer as GET /api/v1/health, kept for existing health checks. "
        "Never needs the API key. Will be removed in 2.0; use GET /api/v1/health."
        + _curl(f"curl -fsS {curl_origin}/api/health/backend"),
        "responses": {"200": {"description": "The container answers.", "content": _json(
            _ref("Health"), {"status": "running", "api_version": "1", "utc_time": "2026-11-16T09:30:00+00:00"})}},
    }}}


def build_spec(script_root: str = "") -> dict:
    config = settings.get()
    keyed = config.public_api.requires_key
    server, curl_base, legacy_server, curl_origin = _spec_urls(script_root)
    spec = {
        "openapi": "3.1.0",
        "info": {
            "title": "imgcompress API",
            "version": SPEC_VERSION,
            "summary": "Offline image compression, conversion, editing and AI background removal / upscaling.",
            "description": _description(
                config.uploads.max_file_size_mebibytes, keyed, curl_base,
            ),
            "license": {"name": LICENSE_NAME, "url": LICENSE_URL},
            "contact": {"name": "Karim Zouine", "url": AUTHOR_URL},
        },
        "externalDocs": {"description": "imgcompress docs", "url": DOCS_URL},
        "servers": [{"url": server, "description": "This container"}],
        "tags": [
            {"name": "Convert", "description": "Synchronous conversion: POST /convert waits and returns the file or a ZIP."},
            {"name": "Jobs", "description": "Asynchronous conversion: POST /jobs returns 202; poll and download with X-Job-Token."},
            {"name": "Editor", "description": "Crop, fit, backgrounds, text and picture layers; render a preview of any format."},
            {"name": "Info", "description": "Supported formats, AI models, limits and versions of this container."},
            {"name": "Health", "description": "Liveness checks. Never need the API key."},
            {"name": "Storage", "description": "Temporary files of the container. Answer 403 when DISABLE_STORAGE_MANAGEMENT=true."},
            {"name": "Docs", "description": "This document and Swagger UI. Served only with ENABLE_PUBLIC_API or API_ONLY."},
        ],
        "paths": _with_gate_errors(
            {**_paths(curl_base, keyed), **_legacy_health_alias(legacy_server, curl_origin)}, keyed,
        ),
        "components": {
            "schemas": _schemas(),
            "responses": {f"E{status}": _error_response(status) for status in _ERROR_TEXT if keyed or status != 401},
        },
    }
    if keyed:
        # Only with a key (always the case in API_ONLY): locks and the Authorize button in Swagger UI.
        spec["security"] = [{"bearerAuth": []}, {"apiKeyHeader": []}]
        spec["components"]["securitySchemes"] = {
            "bearerAuth": {"type": "http", "scheme": "bearer",
                           "description": "PUBLIC_API_KEY of the container, as `Authorization: Bearer <key>`."},
            "apiKeyHeader": {"type": "apiKey", "in": "header", "name": API_KEY_HEADER,
                             "description": f"PUBLIC_API_KEY of the container, as `{API_KEY_HEADER}: <key>`."},
        }
    return spec


def swagger_page(script_root: str) -> str:
    root = escape(script_root, quote=True)
    docs_path = f"{root}{API_PREFIX}/docs"
    title = escape(DOCS_TITLE, quote=True)
    description = escape(DOCS_META_DESCRIPTION, quote=True)
    origin = clean_public_base_url(os.environ.get(PUBLIC_BASE_URL_ENV))
    if origin:
        canonical = escape(f"{origin.rstrip('/')}{API_PREFIX}/docs", quote=True)
        image = f"{canonical}/og-image.webp"
        canonical_tags = (
            f'  <link rel="canonical" href="{canonical}">\n'
            f'  <meta property="og:url" content="{canonical}">\n'
        )
    else:
        image = f"{docs_path}/og-image.webp"
        canonical_tags = ""
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{title}</title>
  <meta name="description" content="{description}">
  <meta name="robots" content="index, follow">
  <link rel="icon" href="{docs_path}/favicon.webp">
{canonical_tags}  <meta property="og:type" content="website">
  <meta property="og:site_name" content="imgcompress">
  <meta property="og:title" content="{title}">
  <meta property="og:description" content="{description}">
  <meta property="og:image" content="{image}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{title}">
  <meta name="twitter:description" content="{description}">
  <meta name="twitter:image" content="{image}">
  <link rel="stylesheet" href="{docs_path}/swagger-ui.css">
  <link rel="stylesheet" href="{docs_path}/imgcompress-docs.css">
</head>
<body>
  <header class="imgc-header">
    <img class="imgc-logo" src="{docs_path}/logo.webp" alt="imgcompress logo" width="64" height="52">
    <div class="imgc-brand">
      <span class="imgc-name">imgcompress <span class="imgc-api">API</span></span>
      <span class="imgc-tagline">REST API v1, served by your container</span>
    </div>
  </header>
  <div id="swagger-ui" data-spec-url="{root}{API_PREFIX}/openapi.json">
    <noscript>Swagger UI needs JavaScript. The spec is at {root}{API_PREFIX}/openapi.json.</noscript>
  </div>
  <script src="{docs_path}/swagger-ui-bundle.js"></script>
  <script src="{docs_path}/swagger-ui-init.js"></script>
</body>
</html>
"""
