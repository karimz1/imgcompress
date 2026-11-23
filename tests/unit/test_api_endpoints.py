"""Every operation in the OpenAPI document is exercised against the real app.

For each documented endpoint: a happy path, the key check with PUBLIC_API_KEY,
API_ONLY, requests from other websites, and the validation errors of its input.
test_EveryDocumentedOperation_Expect_TestsForItHere fails when an endpoint is
added to the spec without tests.
"""

import inspect
import io
import time
import zipfile

import pytest
from PIL import Image

from backend.image_converter.config import settings
from backend.image_converter.presentation.web import openapi, routes
from backend.image_converter.presentation.web.server import app
from backend.image_converter.infrastructure.preset_store import PresetStore
from backend.image_converter.presentation.web.services.preset_service import PresetService
from tests.unit import test_conversion_jobs

KEY = "correct horse battery staple"
KEYED = {"Authorization": f"Bearer {KEY}"}
SAME_ORIGIN = {"Sec-Fetch-Site": "same-origin"}
CROSS_SITE = {"Sec-Fetch-Site": "cross-site", "Origin": "https://blog.example"}
LEGACY_HEALTH = "/api/health/backend"
UNKNOWN_JOB = "a" * 22
UNKNOWN_PRESET = "a" * 32
_METHODS = {"get", "post", "put", "patch", "delete"}

# Never need the key; the docs answer 404 instead of 403 while the public API is off.
OPEN = {("get", "/health"), ("get", "/health/internet"), ("get", LEGACY_HEALTH),
        ("get", "/openapi.json"), ("get", "/docs"), ("get", "/docs/{name}")}
DOCS = {("get", "/openapi.json"), ("get", "/docs"), ("get", "/docs/{name}")}


def _documented_operations():
    with pytest.MonkeyPatch.context() as monkeypatch:
        monkeypatch.setenv("ENABLE_PUBLIC_API", "true")
        monkeypatch.setenv("PUBLIC_API_KEY", KEY)
        monkeypatch.delenv("API_ONLY", raising=False)
        settings.reset_cache()
        try:
            spec = openapi.build_spec()
        finally:
            settings.reset_cache()
    return sorted((method, path) for path, item in spec["paths"].items() for method in item if method in _METHODS)


OPERATIONS = _documented_operations()


def _url(path: str) -> str:
    """A concrete URL for a documented path (placeholders filled, no real job)."""
    if path == LEGACY_HEALTH:
        return path
    filled = (path.replace("{job_id}", UNKNOWN_JOB).replace("{file_name}", "photo.png")
              .replace("{name}", "swagger-ui-init.js").replace("{preset_id}", UNKNOWN_PRESET))
    return f"/api/v1{filled}"


def _png(size=(40, 30)) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", size, (10, 120, 200)).save(buffer, format="PNG")
    return buffer.getvalue()


def _image(name="photo.png"):
    return io.BytesIO(_png()), name


@pytest.fixture
def configure(monkeypatch, tmp_path):
    # Presets live in a file of their own, never the container's /data.
    logger = type("Quiet", (), {"log": lambda self, *args, **kwargs: None})()
    monkeypatch.setattr(routes, "preset_service", PresetService(PresetStore(str(tmp_path / "presets.json"), logger), True))

    def apply(public=None, key=None, api_only=None):
        for name, value in (("ENABLE_PUBLIC_API", public), ("PUBLIC_API_KEY", key), ("API_ONLY", api_only),
                            ("PUBLIC_BASE_URL", None), ("DISABLE_STORAGE_MANAGEMENT", None)):
            if value is None:
                monkeypatch.delenv(name, raising=False)
            else:
                monkeypatch.setenv(name, value)
        settings.reset_cache()
        monkeypatch.setattr(routes, "has_internet", lambda: False)
        return app.test_client()

    yield apply
    settings.reset_cache()


@pytest.fixture
def client(configure):
    """Public API on with a key; requests below send it like a script would."""
    return configure(public="true", key=KEY)


def _post(client, url, data=None, **kwargs):
    return client.post(url, data=data or {}, content_type="multipart/form-data", headers=KEYED, **kwargs)


def _finished_job(client):
    started = _post(client, "/api/v1/jobs", {"files[]": _image("a.png"), "format": "png"})
    assert started.status_code == 202, started.get_json()
    job = started.get_json()
    headers = {**KEYED, "X-Job-Token": job["token"]}
    # By the clock, not a fixed count: a busy CI runner needs longer.
    deadline = time.monotonic() + 60
    while True:
        state = client.get(f"/api/v1/jobs/{job['id']}", headers=headers)
        if state.get_json()["status"] in ("done", "failed") or time.monotonic() > deadline:
            break
        time.sleep(0.02)
    assert state.get_json()["status"] == "done", state.get_json()
    return job["id"], headers, state


# --- happy path of every operation ------------------------------------------------

def _happy_job_status(client):
    _, _, state = _finished_job(client)
    assert state.get_json()["result"]["converted_files"] == ["a.png"]
    return state


def _happy_job_file(client):
    job_id, headers, _ = _finished_job(client)
    response = client.get(f"/api/v1/jobs/{job_id}/files/a.png", headers=headers)
    assert Image.open(io.BytesIO(response.data)).format == "PNG"
    return response


def _happy_job_zip(client):
    job_id, headers, _ = _finished_job(client)
    response = client.get(f"/api/v1/jobs/{job_id}/zip", headers=headers)
    assert zipfile.ZipFile(io.BytesIO(response.data)).namelist() == ["a.png"]
    return response


def _happy_convert(client):
    response = _post(client, "/api/v1/convert", {"files[]": _image(), "format": "webp"})
    assert response.mimetype == "image/webp"
    assert Image.open(io.BytesIO(response.data)).format == "WEBP"
    return response


def _listed_result(client):
    _finished_job(client)
    files = client.get("/api/v1/storage/files", headers=KEYED).get_json()["files"]
    return next(entry for entry in files if entry["filename"] == "a.png")


def _happy_storage_file(client):
    entry = _listed_result(client)
    return client.get("/api/v1/storage/files/download", headers=KEYED,
                      query_string={"folder": entry["folder_path"], "file": entry["filename"]})


def _happy_storage_folder(client):
    entry = _listed_result(client)
    response = client.get("/api/v1/storage/folders/download", headers=KEYED,
                          query_string={"folder": entry["folder_path"]})
    assert "a.png" in zipfile.ZipFile(io.BytesIO(response.data)).namelist()
    return response


def _happy_edit(client):
    response = _post(client, "/api/v1/edit", {"file": _image(), "fit_width": "20", "fit_height": "20"})
    assert response.get_json()["crop"]["width"] > 0
    return response


def _happy_render(client):
    response = _post(client, "/api/v1/preview", {"file": _image()})
    assert response.mimetype == "image/png"
    assert Image.open(io.BytesIO(response.data)).size == (40, 30)
    return response


def _happy_asset(client):
    response = _post(client, "/api/v1/editor/assets", {"file": _image("bg.png")})
    assert response.get_json()["width"] == 40
    return response


def _save_preset(client, name="Web photos"):
    return client.post(_url("/presets"), json={"name": name, "settings": {"format": "webp", "quality": 80}}, headers=KEYED)


def _happy_preset_update(client):
    preset = _save_preset(client).get_json()
    response = client.put(_url(f"/presets/{preset['id']}"), json={"name": "Blog photos"}, headers=KEYED)
    assert response.get_json()["name"] == "Blog photos"
    return response


def _happy_preset_delete(client):
    preset = _save_preset(client).get_json()
    response = client.delete(_url(f"/presets/{preset['id']}"), headers=KEYED)
    assert client.get(_url("/presets"), headers=KEYED).get_json() == {"presets": []}
    return response


def _get(path):
    return lambda client: client.get(_url(path), headers=KEYED)


# (method, path) -> (call, expected status)
HAPPY = {
    ("get", "/health"): (_get("/health"), 200),
    ("get", "/health/internet"): (_get("/health/internet"), 200),
    ("get", LEGACY_HEALTH): (_get(LEGACY_HEALTH), 200),
    ("get", "/info"): (_get("/info"), 200),
    ("get", "/formats"): (_get("/formats"), 200),
    ("get", "/models/remove-background"): (_get("/models/remove-background"), 200),
    ("get", "/models/upscale"): (_get("/models/upscale"), 200),
    ("post", "/convert"): (_happy_convert, 200),
    ("post", "/jobs"): (lambda client: _post(client, "/api/v1/jobs", {"files[]": _image(), "format": "webp"}), 202),
    ("get", "/jobs/{job_id}"): (_happy_job_status, 200),
    ("get", "/jobs/{job_id}/files/{file_name}"): (_happy_job_file, 200),
    ("get", "/jobs/{job_id}/zip"): (_happy_job_zip, 200),
    ("post", "/preview"): (_happy_render, 200),
    ("post", "/edit"): (_happy_edit, 200),
    ("post", "/editor/assets"): (_happy_asset, 200),
    ("get", "/presets"): (_get("/presets"), 200),
    ("post", "/presets"): (_save_preset, 201),
    ("put", "/presets/{preset_id}"): (_happy_preset_update, 200),
    ("delete", "/presets/{preset_id}"): (_happy_preset_delete, 204),
    ("get", "/storage"): (_get("/storage"), 200),
    ("get", "/storage/files"): (_get("/storage/files"), 200),
    ("get", "/storage/files/download"): (_happy_storage_file, 200),
    ("get", "/storage/folders/download"): (_happy_storage_folder, 200),
    ("post", "/storage/cleanup"): (lambda client: client.post(_url("/storage/cleanup"), headers=KEYED), 200),
    ("get", "/logs"): (_get("/logs"), 200),
    ("get", "/openapi.json"): (_get("/openapi.json"), 200),
    ("get", "/docs"): (_get("/docs"), 200),
    ("get", "/docs/{name}"): (_get("/docs/{name}"), 200),
}

# These need a job that is still running or a notifier; the job tests drive them
# with a scripted conversion (same blueprint, see tests/unit/test_conversion_jobs.py).
HAPPY_ELSEWHERE = {
    ("post", "/jobs/{job_id}/cancel"): test_conversion_jobs.test_When_UserCancelsRunningJob_Expect_CanceledStatusNoResultNoNotify,
    ("post", "/jobs/{job_id}/notify"): test_conversion_jobs.test_When_UserOptsIn_Expect_OneNotificationWithCountDeviceAndNoFileNames,
    ("post", "/jobs/{job_id}/claim"): test_conversion_jobs.test_When_PhoneOpensTheShareLink_Expect_ItsOwnTokenThatDownloadsTheResult,
}


@pytest.mark.parametrize("operation", sorted(HAPPY), ids=lambda op: f"{op[0].upper()} {op[1]}")
def test_HappyPath_Expect_DocumentedSuccess(client, operation):
    call, status = HAPPY[operation]
    response = call(client)
    assert response.status_code == status, (response.status_code, response.get_data(as_text=True)[:300])


# --- input validation ---------------------------------------------------------------

def _job_call(method, suffix, **kwargs):
    def call(client):
        return client.open(f"/api/v1/jobs/{UNKNOWN_JOB}{suffix}", method=method, headers=KEYED, **kwargs)
    return call


# (method, path) -> list of (call, expected status, text in the message)
VALIDATION = {
    ("post", "/convert"): [
        (lambda c: _post(c, "/api/v1/convert", {"format": "webp"}), 400, "files[]"),
        (lambda c: _post(c, "/api/v1/convert", {"files[]": _image(), "quality": "500"}), 400, "quality"),
        (lambda c: _post(c, "/api/v1/convert", {"files[]": _image(), "format": "gif"}), 400, "format"),
        (lambda c: _post(c, "/api/v1/convert", {"files[]": _image(), "format": "png", "output": "tar"}), 400, "output"),
        (lambda c: _post(c, "/api/v1/convert", {"files[]": _image(), "remove_background": "maybe"}), 400,
         "remove_background"),
        (lambda c: _post(c, "/api/v1/convert", {"files[]": (io.BytesIO(b"x"), "notes.txt")}), 415, "notes.txt"),
        (lambda c: _post(c, "/api/v1/convert", {"files[]": (io.BytesIO(b"no"), "broken.png"), "format": "png"}), 422,
         "broken.png"),
    ],
    ("post", "/jobs"): [
        (lambda c: _post(c, "/api/v1/jobs", {"format": "webp"}), 400, "files[]"),
        (lambda c: _post(c, "/api/v1/jobs", {"files[]": _image(), "pdf_margin_mm": "99"}), 400, "pdf_margin_mm"),
        (lambda c: _post(c, "/api/v1/jobs", {"files[]": (io.BytesIO(b"x"), "notes.txt")}), 415, "notes.txt"),
    ],
    ("get", "/jobs/{job_id}"): [(_job_call("GET", "", ), 404, "not found")],
    ("get", "/jobs/{job_id}/files/{file_name}"): [(_job_call("GET", "/files/photo.png"), 404, "not found")],
    ("get", "/jobs/{job_id}/zip"): [(_job_call("GET", "/zip"), 404, "not found")],
    ("post", "/jobs/{job_id}/cancel"): [(_job_call("POST", "/cancel"), 404, "not found")],
    ("post", "/jobs/{job_id}/notify"): [(_job_call("POST", "/notify", json={"enabled": True}), 409, "NOTIFY_URL")],
    ("post", "/jobs/{job_id}/claim"): [
        (_job_call("POST", "/claim", json={"share_token": "guess"}), 404, "share token is wrong"),
        (_job_call("POST", "/claim", json={}), 404, "share token is wrong"),
    ],
    ("post", "/preview"): [
        (lambda c: _post(c, "/api/v1/preview", {}), 400, "file"),
    ],
    ("post", "/edit"): [
        (lambda c: _post(c, "/api/v1/edit", {}), 400, ""),
        (lambda c: _post(c, "/api/v1/edit", {"file": _image(), "fit_width": "0", "fit_height": "20"}), 400, ""),
    ],
    ("post", "/editor/assets"): [
        (lambda c: _post(c, "/api/v1/editor/assets", {}), 400, ""),
        (lambda c: _post(c, "/api/v1/editor/assets", {"file": _image(), "session": "expired-session-id"}), 410, ""),
    ],
    ("post", "/presets"): [
        (lambda c: c.post("/api/v1/presets", json={"name": "x"}, headers=KEYED), 400, "name and settings"),
        (lambda c: c.post("/api/v1/presets", json={"name": "x", "settings": {"format": "gif"}}, headers=KEYED), 400,
         "format"),
        (lambda c: c.post("/api/v1/presets", json={"name": "", "settings": {"format": "png"}}, headers=KEYED), 400,
         "name"),
    ],
    ("put", "/presets/{preset_id}"): [
        (lambda c: c.put(f"/api/v1/presets/{UNKNOWN_PRESET}", json={"name": "x"}, headers=KEYED), 404, "not found"),
        (lambda c: c.put(f"/api/v1/presets/{UNKNOWN_PRESET}", json={}, headers=KEYED), 400, "name, settings"),
    ],
    ("delete", "/presets/{preset_id}"): [
        (lambda c: c.delete("/api/v1/presets/not-an-id", headers=KEYED), 404, "not found"),
    ],
    ("get", "/storage/files/download"): [
        (lambda c: c.get("/api/v1/storage/files/download", headers=KEYED,
                         query_string={"folder": "/etc", "file": "passwd"}), 404, ""),
    ],
    ("get", "/storage/folders/download"): [
        (lambda c: c.get("/api/v1/storage/folders/download", headers=KEYED, query_string={"folder": "/etc"}), 400, ""),
    ],
    ("get", "/docs/{name}"): [
        (lambda c: c.get("/api/v1/docs/server.py", headers=KEYED), 404, ""),
        (lambda c: c.get("/api/v1/docs/../routes.py", headers=KEYED), 404, ""),
    ],
}


@pytest.mark.parametrize("operation, index", [(op, i) for op in sorted(VALIDATION) for i in range(len(VALIDATION[op]))],
                         ids=lambda value: f"{value[0].upper()} {value[1]}" if isinstance(value, tuple) else str(value))
def test_InvalidInput_Expect_DocumentedJsonError(client, operation, index):
    call, status, needle = VALIDATION[operation][index]
    response = call(client)
    assert response.status_code == status, (response.status_code, response.get_data(as_text=True)[:300])
    assert response.is_json, response.get_data(as_text=True)[:200]
    body = response.get_json()
    assert set(body) >= {"error", "message"}
    assert needle.lower() in body["message"].lower(), body["message"]


# --- access rules, for every documented operation -------------------------------------

_IDS = [f"{method.upper()} {path}" for method, path in OPERATIONS]


@pytest.mark.parametrize("method, path", OPERATIONS, ids=_IDS)
def test_WithKeySet_Expect_KeyedRoutesRefuseWithout401AndOpenRoutesAnswer(configure, method, path):
    client = configure(public="true", key=KEY)
    response = client.open(_url(path), method=method.upper())
    if (method, path) in OPEN:
        assert response.status_code == 200, response.get_data(as_text=True)[:200]
    else:
        assert response.status_code == 401
        assert response.get_json()["error"] == "Unauthorized"
        assert response.headers["WWW-Authenticate"].startswith("Bearer")


@pytest.mark.parametrize("method, path", OPERATIONS, ids=_IDS)
@pytest.mark.parametrize("headers", [{"Authorization": f"Bearer {KEY}"}, {"X-API-Key": KEY}], ids=["bearer", "x-api-key"])
def test_WithKeySent_Expect_TheGateLetsItThrough(configure, method, path, headers):
    client = configure(public="true", key=KEY)
    response = client.open(_url(path), method=method.upper(), headers=headers)
    assert response.status_code not in (401, 403), (response.status_code, response.get_data(as_text=True)[:200])


@pytest.mark.parametrize("method, path", OPERATIONS, ids=_IDS)
def test_WithWrongKey_Expect_401OnKeyedRoutes(configure, method, path):
    client = configure(public="true", key=KEY)
    response = client.open(_url(path), method=method.upper(), headers={"Authorization": "Bearer guess"})
    assert response.status_code == (200 if (method, path) in OPEN else 401)


@pytest.mark.parametrize("method, path", OPERATIONS, ids=_IDS)
def test_ApiOnly_Expect_KeyRequiredEvenForSameOriginAndHealthAndDocsOpen(configure, method, path):
    client = configure(api_only="true", key=KEY)
    spoofed = client.open(_url(path), method=method.upper(), headers=SAME_ORIGIN)
    with_key = client.open(_url(path), method=method.upper(), headers={**SAME_ORIGIN, **KEYED})
    if (method, path) in OPEN:
        assert spoofed.status_code == 200
    else:
        assert spoofed.status_code == 401
        assert with_key.status_code not in (401, 403), with_key.get_data(as_text=True)[:200]


def test_ApiOnly_Expect_NoWebUi(configure):
    client = configure(api_only="true", key=KEY)
    for path in ("/", "/index.html", "/static/index.html"):
        response = client.get(path)
        assert response.is_json and "/api/v1/docs" in response.get_json()["message"], path
    assert client.get("/").status_code == 200 and client.get("/index.html").status_code == 404


@pytest.mark.parametrize("method, path", OPERATIONS, ids=_IDS)
def test_DefaultMode_Expect_OtherWebsitesGet403AndDocsAre404(configure, method, path):
    client = configure()
    response = client.open(_url(path), method=method.upper(), headers=CROSS_SITE)
    assert response.status_code == (404 if (method, path) in DOCS else 403)
    assert "Access-Control-Allow-Origin" not in response.headers


@pytest.mark.parametrize("method, path", OPERATIONS, ids=_IDS)
def test_DefaultMode_Expect_WebUiAndScriptsPassTheGate(configure, method, path):
    client = configure()
    for headers in (SAME_ORIGIN, {}):
        response = client.open(_url(path), method=method.upper(), headers=headers)
        expected_docs = (method, path) in DOCS
        assert (response.status_code == 404) if expected_docs else response.status_code not in (401, 403)


def test_StorageManagementOff_Expect_StorageRoutes403(configure, monkeypatch):
    client = configure()
    # Read once at start from DISABLE_STORAGE_MANAGEMENT.
    monkeypatch.setattr(routes.storage_management_service, "is_enabled", False)
    storage = [(m, p) for m, p in OPERATIONS if p.startswith("/storage") or p == "/logs"]
    assert len(storage) == 6
    for method, path in storage:
        response = client.open(_url(path), method=method.upper())
        assert response.status_code == 403, path
        assert "DISABLE_STORAGE_MANAGEMENT" in response.get_json()["message"]


def test_CustomPresetsOff_Expect_PresetRoutes403(configure, monkeypatch):
    client = configure()
    monkeypatch.setattr(routes.preset_service, "is_enabled", False)
    presets = [(m, p) for m, p in OPERATIONS if p.startswith("/presets")]
    assert len(presets) == 4
    for method, path in presets:
        response = client.open(_url(path), method=method.upper(), json={"name": "x", "settings": {"format": "png"}})
        assert response.status_code == 403, path
        assert response.get_json()["code"] == "disabled"


# --- the coverage contract ---------------------------------------------------------------

def test_EveryDocumentedOperation_Expect_TestsForItHere():
    documented = set(OPERATIONS)
    assert len(documented) == 31
    happy = set(HAPPY) | set(HAPPY_ELSEWHERE)
    assert documented - happy == set(), "operations without a happy-path test"
    assert happy - documented == set(), "tests for operations that are not documented"
    for (method, path), test in HAPPY_ELSEWHERE.items():
        source = inspect.getsource(test)
        assert path.rsplit("/", 1)[1] in source or path.rsplit("/", 1)[1] in inspect.getsource(test_conversion_jobs), path
    with_input = set()
    spec_paths = openapi._paths("")
    for method, path in documented:
        operation = spec_paths.get(path, {}).get(method, {})
        if operation.get("requestBody") or operation.get("parameters"):
            with_input.add((method, path))
    assert with_input - set(VALIDATION) == set(), "operations with input but no validation test"
