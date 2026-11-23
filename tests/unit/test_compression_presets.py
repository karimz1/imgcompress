"""Compression presets: validation, the shared JSON file and the /api/v1/presets routes."""

import json
import multiprocessing
import os

import pytest
from flask import Flask

from backend.image_converter.domain.compression_presets import (
    MAX_NAME_LENGTH,
    SETTING_KEYS,
    parse_name,
    parse_settings,
)
from backend.image_converter.infrastructure.preset_store import (
    PresetLimitReachedError,
    PresetNameTakenError,
    PresetNotFoundError,
    PresetStorageUnavailableError,
    PresetStore,
)
from backend.image_converter.presentation.web.services.preset_service import PresetService

NOW = "2026-08-14T10:12:33Z"
LATER = "2026-08-15T08:00:00Z"


class _Logger:
    def __init__(self):
        self.messages = []

    def log(self, message, level="info"):
        self.messages.append((level, message))


def _settings(**overrides) -> dict:
    """Normalized settings: every key, None where it does not apply."""
    base = {key: None for key in SETTING_KEYS}
    base.update(format="jpeg", quality=85)
    base.update(overrides)
    return base


def _valid(raw) -> dict:
    result = parse_settings(raw)
    assert result.is_successful, result.error
    return result.value


def _invalid(raw) -> str:
    result = parse_settings(raw)
    assert not result.is_successful
    return result.error


# --- Validation ------------------------------------------------------------


def test_jpeg_settings_keep_quality_and_width():
    assert _valid({"format": "jpeg", "quality": 80, "width": 1920}) == _settings(quality=80, width=1920)


def test_every_supported_format_is_accepted():
    for image_format in ("jpeg", "png", "ico", "avif", "webp", "pdf"):
        assert _valid({"format": image_format})["format"] == image_format


def test_settings_that_do_not_apply_to_the_format_are_stored_as_none():
    settings = _valid(
        {
            "format": "png",
            "quality": 70,
            "use_rembg": True,
            "webp_lossless": True,
            "pdf_preset": "a4-auto",
            "pdf_quality": "small",
            "pdf_scale": "fill",
            "pdf_margin_mm": 5,
            "pdf_paginate": True,
        }
    )

    assert settings == _settings(format="png", quality=None, use_rembg=True)


def test_target_size_replaces_quality():
    assert _valid({"format": "avif", "target_size_kb": 500}) == _settings(
        format="avif", quality=None, target_size_kb=500, use_rembg=False
    )


def test_quality_defaults_like_the_form_when_omitted():
    assert _valid({"format": "jpeg"})["quality"] == 85


def test_lossless_webp_has_no_quality_or_target_size():
    lossless = _valid({"format": "webp", "webp_lossless": True, "quality": 90})
    lossy = _valid({"format": "webp", "quality": 90, "use_rembg": False})

    assert lossless == _settings(format="webp", quality=None, webp_lossless=True, use_rembg=False)
    assert lossy == _settings(format="webp", quality=90, webp_lossless=False, use_rembg=False)


def test_pdf_with_original_size_keeps_width_but_no_page_options():
    settings = _valid({"format": "pdf", "width": 800, "pdf_scale": "fill", "pdf_margin_mm": 3})

    assert settings == _settings(
        format="pdf", quality=None, width=800, pdf_preset="original", pdf_quality="high"
    )


def test_pdf_page_size_fills_in_page_defaults_and_drops_width():
    settings = _valid({"format": "pdf", "pdf_preset": "a4-portrait", "width": 800})

    assert settings == _settings(
        format="pdf",
        quality=None,
        pdf_preset="a4-portrait",
        pdf_quality="high",
        pdf_scale="fit",
        pdf_margin_mm=10.0,
        pdf_paginate=False,
    )


def test_paginated_pdf_is_always_fitted():
    settings = _valid(
        {"format": "pdf", "pdf_preset": "letter-auto", "pdf_paginate": True, "pdf_scale": "fill", "pdf_margin_mm": 0}
    )

    assert settings["pdf_scale"] == "fit"
    assert settings["pdf_paginate"] is True
    assert settings["pdf_margin_mm"] == 0.0


def test_upscale_keeps_its_model_and_defaults_to_general():
    assert _valid({"format": "png", "upscale": "4k", "upscale_model": "anime"})["upscale_model"] == "anime"
    assert _valid({"format": "png", "upscale": "2x"})["upscale_model"] == "general"
    assert _valid({"format": "png", "upscale_model": "anime"})["upscale_model"] is None


def test_pdf_drops_upscaling():
    settings = _valid({"format": "pdf", "upscale": "2x", "upscale_model": "anime"})

    assert settings["upscale"] is None
    assert settings["upscale_model"] is None


@pytest.mark.parametrize(
    ("raw", "message"),
    [
        ({"format": "jpeg", "height": 10}, "Unknown preset settings: height"),
        ({"quality": 80}, "'format' is required"),
        ({"format": "gif"}, "'format' must be one of"),
        ({"format": "JPEG"}, "'format' must be one of"),
        ({"format": "jpeg", "quality": 0}, "'quality' must be between 1 and 100"),
        ({"format": "jpeg", "quality": 101}, "'quality' must be between 1 and 100"),
        ({"format": "jpeg", "quality": 80.5}, "'quality' must be a whole number"),
        ({"format": "jpeg", "quality": "80"}, "'quality' must be a whole number"),
        ({"format": "jpeg", "quality": True}, "'quality' must be a whole number"),
        ({"format": "jpeg", "width": 0}, "'width' must be at least 1"),
        ({"format": "jpeg", "width": -5}, "'width' must be at least 1"),
        ({"format": "jpeg", "quality": None, "target_size_kb": 0}, "'target_size_kb' must be at least 1"),
        ({"format": "png", "use_rembg": "yes"}, "'use_rembg' must be true or false"),
        ({"format": "pdf", "pdf_preset": "a5"}, "'pdf_preset' must be one of"),
        ({"format": "pdf", "pdf_quality": "best"}, "'pdf_quality' must be one of"),
        ({"format": "pdf", "pdf_scale": "stretch"}, "'pdf_scale' must be one of"),
        ({"format": "pdf", "pdf_margin_mm": -1}, "'pdf_margin_mm' must be between 0 and 30"),
        ({"format": "pdf", "pdf_margin_mm": 31}, "'pdf_margin_mm' must be between 0 and 30"),
        ({"format": "pdf", "pdf_margin_mm": float("nan")}, "'pdf_margin_mm' must be a number"),
        ({"format": "pdf", "pdf_margin_mm": float("inf")}, "'pdf_margin_mm' must be a number"),
        ({"format": "pdf", "pdf_margin_mm": 10**400}, "'pdf_margin_mm' must be between 0 and 30"),
        ({"format": "png", "upscale": "3x"}, "'upscale' must be one of"),
        ({"format": "png", "upscale": "2x", "upscale_model": "best"}, "'upscale_model' must be one of"),
        ({"format": "jpeg", "quality": 80, "target_size_kb": 500}, "not both"),
        ({"format": "png", "width": 800, "upscale": "2x"}, "Set either width or upscale"),
    ],
)
def test_invalid_settings_are_refused(raw, message):
    assert message in _invalid(raw)


def test_quality_and_target_size_are_refused_together_even_where_neither_applies():
    assert "not both" in _invalid({"format": "png", "quality": 80, "target_size_kb": 500})


def test_settings_must_be_an_object():
    assert _invalid(["jpeg"]) == "Preset settings must be an object."
    assert _invalid(None) == "Preset settings must be an object."


def test_normalized_settings_are_stable():
    once = _valid({"format": "pdf", "pdf_preset": "a4-auto", "pdf_paginate": True})

    assert _valid(once) == once


def test_names_are_trimmed():
    assert parse_name("  Web JPEG  ").value == "Web JPEG"


def test_names_may_use_any_script_and_emoji():
    for name in ("Fotos für das Web", "ウェブ用", "\U0001F469\u200D\U0001F4BB Blog"):
        assert parse_name(name).value == name


@pytest.mark.parametrize(
    ("value", "message"),
    [
        ("", "must not be empty"),
        ("   ", "must not be empty"),
        (None, "must be a string"),
        (42, "must be a string"),
        ("x" * (MAX_NAME_LENGTH + 1), f"at most {MAX_NAME_LENGTH} characters"),
        ("Web\nJPEG", "control characters"),
        ("Web\tJPEG", "control characters"),
    ],
)
def test_invalid_names_are_refused(value, message):
    result = parse_name(value)

    assert not result.is_successful
    assert message in result.error


# --- Store -------------------------------------------------------------------


@pytest.fixture
def preset_file(tmp_path):
    return tmp_path / "data" / "presets.json"


def _store(path, logger=None, **kwargs) -> PresetStore:
    return PresetStore(str(path), logger or _Logger(), clock=kwargs.pop("clock", lambda: NOW), **kwargs)


def test_missing_file_means_no_presets(preset_file):
    assert _store(preset_file).all() == []
    assert not preset_file.exists()


def test_created_preset_is_written_in_the_documented_format(preset_file):
    store = _store(preset_file)

    preset = store.create("Web JPEG", _settings(quality=80, width=1920))

    assert len(preset["id"]) == 32
    assert json.loads(preset_file.read_text(encoding="utf-8")) == {
        "version": 1,
        "presets": [
            {
                "id": preset["id"],
                "name": "Web JPEG",
                "created_at": NOW,
                "updated_at": NOW,
                "settings": _settings(quality=80, width=1920),
            }
        ],
    }


def test_presets_survive_a_new_store_on_the_same_file(preset_file):
    created = _store(preset_file).create("Web JPEG", _settings())

    assert _store(preset_file).all() == [created]


def test_update_changes_name_and_settings_and_keeps_created_at(preset_file):
    preset = _store(preset_file).create("Web JPEG", _settings())
    store = _store(preset_file, clock=lambda: LATER)

    renamed = store.update(preset["id"], name="Blog JPEG")
    overwritten = store.update(preset["id"], settings=_settings(format="png", quality=None, use_rembg=True))

    assert renamed["name"] == "Blog JPEG"
    assert overwritten["name"] == "Blog JPEG"
    assert overwritten["settings"]["format"] == "png"
    assert overwritten["created_at"] == NOW
    assert overwritten["updated_at"] == LATER
    assert store.all() == [overwritten]


def test_delete_removes_only_that_preset(preset_file):
    store = _store(preset_file)
    first = store.create("One", _settings())
    second = store.create("Two", _settings())

    store.delete(first["id"])

    assert store.all() == [second]


def test_unknown_ids_raise_not_found(preset_file):
    store = _store(preset_file)
    store.create("One", _settings())

    with pytest.raises(PresetNotFoundError):
        store.update("0" * 32, name="x")
    with pytest.raises(PresetNotFoundError):
        store.delete("0" * 32)


def test_names_are_unique_ignoring_case(preset_file):
    store = _store(preset_file)
    first = store.create("Web JPEG", _settings())
    second = store.create("Print PDF", _settings())

    with pytest.raises(PresetNameTakenError):
        store.create("web jpeg", _settings())
    with pytest.raises(PresetNameTakenError):
        store.update(second["id"], name="WEB JPEG")
    # Renaming a preset to a different spelling of its own name is fine.
    assert store.update(first["id"], name="web jpeg")["name"] == "web jpeg"


def test_limit_is_enforced(preset_file):
    store = _store(preset_file, max_presets=2)
    store.create("One", _settings())
    store.create("Two", _settings())

    with pytest.raises(PresetLimitReachedError):
        store.create("Three", _settings())
    assert len(store.all()) == 2


def test_writes_leave_no_temporary_file(preset_file):
    _store(preset_file).create("One", _settings())

    assert sorted(os.listdir(preset_file.parent)) == ["presets.json", "presets.json.lock"]


@pytest.mark.parametrize(
    "content",
    [
        "{not json",
        "[]",
        json.dumps({"version": 2, "presets": []}),
        json.dumps({"version": True, "presets": []}),
        json.dumps({"presets": []}),
        json.dumps({"version": 1, "presets": {}}),
        json.dumps({"version": 1, "presets": [{"id": "x"}]}),
        json.dumps(
            {
                "version": 1,
                "presets": [
                    {"id": "a" * 32, "name": "One", "created_at": NOW, "updated_at": NOW, "settings": {"format": "gif"}}
                ],
            }
        ),
        json.dumps(
            {
                "version": 1,
                "presets": [
                    {"id": "a" * 32, "name": "One", "created_at": NOW, "updated_at": NOW, "settings": _settings()},
                    {"id": "a" * 32, "name": "Two", "created_at": NOW, "updated_at": NOW, "settings": _settings()},
                ],
            }
        ),
        json.dumps(
            {
                "version": 1,
                "presets": [
                    {"id": "a" * 32, "name": "One", "created_at": "yesterday", "updated_at": NOW, "settings": _settings()}
                ],
            }
        ),
    ],
)
def test_unusable_file_is_reported_and_never_overwritten(preset_file, content):
    preset_file.parent.mkdir(parents=True)
    preset_file.write_text(content, encoding="utf-8")
    logger = _Logger()
    store = _store(preset_file, logger)

    with pytest.raises(PresetStorageUnavailableError):
        store.all()
    with pytest.raises(PresetStorageUnavailableError):
        store.create("One", _settings())

    assert preset_file.read_text(encoding="utf-8") == content
    assert any(level == "error" and "Presets unavailable" in message for level, message in logger.messages)


def test_hand_written_presets_are_normalized_on_read(preset_file):
    preset_file.parent.mkdir(parents=True)
    preset_file.write_text(
        json.dumps(
            {
                "version": 1,
                "presets": [
                    {
                        "id": "a" * 32,
                        "name": " Small PNG ",
                        "created_at": NOW,
                        "updated_at": NOW,
                        "settings": {"format": "png", "width": 640},
                    }
                ],
            }
        ),
        encoding="utf-8",
    )

    [preset] = _store(preset_file).all()

    assert preset["name"] == "Small PNG"
    assert preset["settings"] == _settings(format="png", quality=None, width=640, use_rembg=False)


def test_unreadable_folder_reports_storage_unavailable(tmp_path):
    blocker = tmp_path / "not-a-folder"
    blocker.write_text("file", encoding="utf-8")
    store = _store(blocker / "presets.json")

    with pytest.raises(PresetStorageUnavailableError):
        store.create("One", _settings())


def _create_presets(path: str, prefix: str, count: int) -> None:
    store = PresetStore(path, _Logger())
    for index in range(count):
        store.create(f"{prefix}-{index}", _settings())


def test_concurrent_processes_never_lose_a_preset(preset_file):
    """Several worker processes saving at once: every preset ends up in a valid file."""
    preset_file.parent.mkdir(parents=True)
    context = multiprocessing.get_context("spawn")
    workers = [
        context.Process(target=_create_presets, args=(str(preset_file), f"worker{n}", 10)) for n in range(4)
    ]
    for worker in workers:
        worker.start()
    for worker in workers:
        worker.join(timeout=60)
        assert worker.exitcode == 0

    names = sorted(preset["name"] for preset in _store(preset_file).all())
    assert names == sorted(f"worker{n}-{i}" for n in range(4) for i in range(10))


# --- API ----------------------------------------------------------------------


@pytest.fixture
def api(tmp_path, monkeypatch):
    from backend.image_converter.presentation.web import routes

    logger = _Logger()
    path = tmp_path / "data" / "presets.json"

    def client(enabled=True):
        service = PresetService(PresetStore(str(path), logger), is_enabled=enabled)
        monkeypatch.setattr(routes, "preset_service", service)
        app = Flask(__name__)
        app.register_blueprint(routes.api_blueprint, url_prefix="/api/v1")
        return app.test_client()

    client.path = path
    return client


def _create(client, name="Web JPEG", **settings):
    return client.post("/api/v1/presets", json={"name": name, "settings": settings or {"format": "jpeg", "quality": 80}})


def test_api_crud_round_trip(api):
    client = api()

    assert client.get("/api/v1/presets").get_json() == {"presets": []}

    created = _create(client, width=1920, format="jpeg", quality=80)
    assert created.status_code == 201
    preset = created.get_json()
    assert preset["settings"] == _settings(quality=80, width=1920)
    assert set(preset) == {"id", "name", "created_at", "updated_at", "settings"}

    renamed = client.put(f"/api/v1/presets/{preset['id']}", json={"name": "Blog JPEG"})
    assert renamed.status_code == 200
    assert renamed.get_json()["name"] == "Blog JPEG"

    overwritten = client.put(
        f"/api/v1/presets/{preset['id']}", json={"settings": {"format": "pdf", "pdf_preset": "a4-auto"}}
    )
    assert overwritten.status_code == 200
    assert overwritten.get_json()["settings"]["pdf_preset"] == "a4-auto"

    listed = client.get("/api/v1/presets")
    assert listed.headers["Cache-Control"] == "no-store"
    assert listed.get_json() == {"presets": [overwritten.get_json()]}

    deleted = client.delete(f"/api/v1/presets/{preset['id']}")
    assert deleted.status_code == 204
    assert deleted.data == b""
    assert client.get("/api/v1/presets").get_json() == {"presets": []}


def test_api_presets_are_shared_between_workers(api):
    first_worker = api()
    created = _create(first_worker).get_json()

    second_worker = api()

    assert second_worker.get("/api/v1/presets").get_json() == {"presets": [created]}


@pytest.mark.parametrize(
    ("body", "message"),
    [
        (None, "JSON object"),
        ([], "JSON object"),
        ({"name": "x"}, "both name and settings"),
        ({"settings": {"format": "jpeg"}}, "both name and settings"),
        ({"name": "", "settings": {"format": "jpeg"}}, "must not be empty"),
        ({"name": "x", "settings": {"format": "jpeg", "colour": "red"}}, "Unknown preset settings: colour"),
        ({"name": "x", "settings": {"format": "jpeg", "quality": 80, "target_size_kb": 9}}, "not both"),
        ({"id": "a" * 32, "name": "x", "settings": {"format": "jpeg"}}, "set by the server: id"),
        ({"name": "x", "settings": {"format": "jpeg"}, "created_at": NOW}, "set by the server: created_at"),
        ({"name": "x", "settings": {"format": "jpeg"}, "favorite": True}, "Unknown fields: favorite"),
    ],
)
def test_api_create_refuses_invalid_requests(api, body, message):
    client = api()
    response = client.post("/api/v1/presets", json=body) if body is not None else client.post(
        "/api/v1/presets", data="nope", content_type="text/plain"
    )

    assert response.status_code == 400
    assert message in response.get_json()["message"]
    assert response.get_json()["code"] == "invalid"
    assert client.get("/api/v1/presets").get_json() == {"presets": []}


@pytest.mark.parametrize(
    ("body", "message"),
    [
        ({}, "Send a name, settings or both"),
        ({"updated_at": NOW}, "set by the server: updated_at"),
        ({"settings": {"format": "bmp"}}, "'format' must be one of"),
    ],
)
def test_api_update_refuses_invalid_requests(api, body, message):
    client = api()
    preset = _create(client).get_json()

    response = client.put(f"/api/v1/presets/{preset['id']}", json=body)

    assert response.status_code == 400
    assert message in response.get_json()["message"]
    assert client.get("/api/v1/presets").get_json() == {"presets": [preset]}


@pytest.mark.parametrize("preset_id", ["0" * 32, "not-an-id", "A" * 32])
def test_api_unknown_preset_is_404(api, preset_id):
    client = api()
    _create(client)

    for response in (
        client.put(f"/api/v1/presets/{preset_id}", json={"name": "x"}),
        client.delete(f"/api/v1/presets/{preset_id}"),
    ):
        assert response.status_code == 404
        assert response.get_json()["code"] == "not_found"


def test_api_duplicate_name_and_limit_are_409(api, monkeypatch):
    client = api()
    _create(client, name="Web JPEG")

    duplicate = _create(client, name="WEB jpeg")
    assert duplicate.status_code == 409
    assert duplicate.get_json() == {
        "error": "Conflict",
        "message": "A preset with this name already exists.",
        "code": "name_taken",
    }

    from backend.image_converter.presentation.web import routes

    monkeypatch.setattr(routes.preset_service._store, "_max_presets", 1)
    full = _create(client, name="Another")
    assert full.status_code == 409
    assert "at most" in full.get_json()["message"]
    assert full.get_json()["code"] == "limit_reached"


def test_api_corrupt_file_is_503_and_stays_untouched(api):
    api.path.parent.mkdir(parents=True)
    api.path.write_text("{broken", encoding="utf-8")
    client = api()

    listed = client.get("/api/v1/presets")
    assert listed.status_code == 503
    assert listed.get_json()["code"] == "unavailable"
    assert _create(client).status_code == 503
    assert client.delete(f"/api/v1/presets/{'a' * 32}").status_code == 503
    assert api.path.read_text(encoding="utf-8") == "{broken"


def test_api_disabled_returns_403_and_keeps_existing_presets(api):
    preset = _create(api()).get_json()
    before = api.path.read_bytes()
    client = api(enabled=False)

    responses = [
        client.get("/api/v1/presets"),
        _create(client, name="Other"),
        client.put(f"/api/v1/presets/{preset['id']}", json={"name": "x"}),
        client.delete(f"/api/v1/presets/{preset['id']}"),
    ]

    assert [response.status_code for response in responses] == [403, 403, 403, 403]
    assert {response.get_json()["code"] for response in responses} == {"disabled"}
    assert api.path.read_bytes() == before
    assert api().get("/api/v1/presets").get_json() == {"presets": [preset]}
