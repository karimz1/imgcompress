"""The OpenAPI document is the contract: complete, valid, and true to the real answers."""

import io
import re
import zipfile

import pytest
from jsonschema import Draft202012Validator
from openapi_spec_validator import validate
from PIL import Image

from backend.image_converter.application import conversion_options as options
from backend.image_converter.config import settings
from backend.image_converter.presentation.web import openapi, routes
from backend.image_converter.presentation.web.server import app

_METHODS = {"get", "post", "put", "patch", "delete"}


@pytest.fixture(scope="module")
def spec():
    return openapi.build_spec()


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("ENABLE_PUBLIC_API", "true")
    monkeypatch.delenv("PUBLIC_API_KEY", raising=False)
    settings.reset_cache()
    monkeypatch.setattr(routes, "has_internet", lambda: False)
    yield app.test_client()
    settings.reset_cache()


def _png(size=(40, 30), colour=(10, 120, 200)) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", size, colour).save(buffer, format="PNG")
    return buffer.getvalue()


_LEGACY_HEALTH = "/api/health/backend"


def _api_routes():
    found = set()
    for rule in app.url_map.iter_rules():
        if rule.rule.startswith("/api/v1/"):
            path = re.sub(r"<(?:[a-z]+:)?([a-z_]+)>", r"{\1}", rule.rule[len("/api/v1"):])
        elif rule.rule == _LEGACY_HEALTH:
            path = _LEGACY_HEALTH
        else:
            continue
        for method in rule.methods - {"HEAD", "OPTIONS"}:
            found.add((path, method.lower()))
    return found


def _operations(spec):
    for path, item in spec["paths"].items():
        for method, operation in item.items():
            if method in _METHODS:
                yield path, method, operation


def test_Spec_Expect_ValidOpenApi31(spec):
    assert spec["openapi"] == "3.1.0"
    validate(spec)


def test_Routes_Expect_EveryRouteDocumentedAndNoStaleDocs(spec):
    documented = {(path, method) for path, method, _ in _operations(spec)}
    assert _api_routes() - documented == set(), "routes missing in openapi.py"
    assert documented - _api_routes() == set(), "openapi.py documents routes that do not exist"


def test_Operations_Expect_SummaryDescriptionTagsAndResponses(spec):
    tags = {tag["name"] for tag in spec["tags"]}
    operation_ids = set()
    for path, method, operation in _operations(spec):
        where = f"{method.upper()} {path}"
        assert operation.get("summary"), where
        assert len(operation.get("description", "")) >= 40, where
        assert operation.get("tags") and set(operation["tags"]) <= tags, where
        assert operation["operationId"] not in operation_ids, where
        operation_ids.add(operation["operationId"])
        assert any(code.startswith("2") for code in operation["responses"]), where
        for code, response in operation["responses"].items():
            if "$ref" not in response:
                assert response.get("description"), f"{where} {code}"
        for parameter in operation.get("parameters", []):
            assert parameter.get("description") and parameter.get("schema"), f"{where} {parameter['name']}"
            assert "example" in parameter, f"{where} {parameter['name']} has no example"
        body = operation.get("requestBody", {}).get("content", {})
        for media in body.values():
            for name, prop in media["schema"].get("properties", {}).items():
                assert prop.get("description"), f"{where} field {name}"


def test_EveryWriteAndKeyedOperation_Expect_ItsErrorsDocumented(spec):
    for path, method, operation in _operations(spec):
        if operation.get("security") == []:
            continue
        assert "401" in operation["responses"], f"{method} {path}: 401 (PUBLIC_API_KEY) missing"
        assert "403" in operation["responses"], f"{method} {path}: 403 (other websites) missing"


def _form_schema(spec, path):
    return spec["paths"][path]["post"]["requestBody"]["content"]["multipart/form-data"]["schema"]


def _assert_field_documents_range_and_recommendation(option, field):
    text = field["description"]
    span = openapi._range_text(option)
    if span:
        assert span in text, option.name
    assert "Recommended:" in text or "Required" in text, option.name
    assert "If omitted" in text or "If a script omits" in text or "Required." in text, option.name
    if option.minimum is not None:
        assert field["minimum"] == option.minimum, option.name
    if option.maximum is not None:
        assert field["maximum"] == option.maximum, option.name
    if option.choices:
        assert field["enum"] == list(option.choices), option.name
    for key in ("default", "example", "examples"):
        assert key not in field, f"{option.name} has prefill key {key}"


def test_ConvertForm_Expect_TheOptionListWithLimitsAndNoPrefill(spec):
    form = _form_schema(spec, "/convert")
    assert form["required"] == ["files[]", "format"]
    for option in options.CONVERSION_OPTIONS + (options.OUTPUT,):
        _assert_field_documents_range_and_recommendation(option, form["properties"][option.name])
    jobs = _form_schema(spec, "/jobs")
    assert jobs["required"] == ["files[]", "format"]
    assert "output" not in jobs["properties"]
    edit = _form_schema(spec, "/edit")
    assert {o.name for o in options.EDITOR_OPTIONS} <= set(edit["properties"])
    for option in options.EDITOR_OPTIONS:
        _assert_field_documents_range_and_recommendation(option, edit["properties"][option.name])


def test_TryItOutForms_Expect_NoDefaultOrExampleThatWouldPrefill(spec):
    for path in ("/convert", "/jobs", "/preview", "/edit"):
        form = _form_schema(spec, path)
        for name, field in form["properties"].items():
            for key in ("default", "example", "examples"):
                assert key not in field, f"{path} {name} has prefill key {key}"
            if "items" in field:
                for key in ("default", "example", "examples"):
                    assert key not in field["items"], f"{path} {name}.items has prefill key {key}"
        media = spec["paths"][path]["post"]["requestBody"]["content"]["multipart/form-data"]
        assert "example" not in media and "examples" not in media, path


def test_Description_Expect_DevSectionsAuthCorsVersioningAndCurl(spec):
    text = spec["info"]["description"]
    for needle in (
        "ImgCompress, your self-hosted image toolbox", "Getting started", "Authentication",
        "Deployment and security", "Convert vs jobs", "Errors", "Limits", "Versioning",
        "ENABLE_PUBLIC_API", "PUBLIC_API_KEY", "API_ONLY", "Access-Control-Allow-Origin",
        "/api/v2", "curl ", "DISABLE_STORAGE_MANAGEMENT", "PUBLIC_BASE_URL",
        "Created by [Karim Zouine]", openapi.SITE_URL, openapi.GITHUB_URL,
        "deprecated", "CSRF", "Stirling-PDF", "Authelia",
    ):
        assert needle in text, needle
    assert "curl " in spec["paths"]["/convert"]["post"]["description"]
    assert spec["info"]["contact"] == {"name": "Karim Zouine", "url": openapi.SITE_URL}
    assert spec["info"]["license"] == {"name": openapi.LICENSE_NAME, "url": openapi.LICENSE_URL}
    assert "identifier" not in spec["info"]["license"]
    assert spec["externalDocs"] == {"description": "imgcompress docs", "url": openapi.DOCS_URL}
    tag_names = [tag["name"] for tag in spec["tags"]]
    assert tag_names == ["Convert", "Jobs", "Editor", "Info", "Health", "Storage", "Docs"]
    assert all(tag.get("description") for tag in spec["tags"])


# --- the answers match the documented schemas -----------------------------------

def _validator(spec, schema):
    return Draft202012Validator({**schema, "components": spec["components"]})


def _response_schema(spec, path, method, status):
    response = spec["paths"][path][method]["responses"][str(status)]
    if "$ref" in response:
        response = spec["components"]["responses"][response["$ref"].rsplit("/", 1)[1]]
    return response["content"]["application/json"]["schema"]


def _check(spec, path, method, response):
    assert response.is_json, f"{method} {path} -> {response.status_code} is not JSON"
    schema = _response_schema(spec, path, method, response.status_code)
    errors = list(_validator(spec, schema).iter_errors(response.get_json()))
    assert not errors, f"{method} {path} {response.status_code}: {errors[0].message}"


def test_Examples_Expect_TheyMatchTheirSchemas(spec):
    for path, method, operation in _operations(spec):
        for code, response in operation["responses"].items():
            if "$ref" in response:
                response = spec["components"]["responses"][response["$ref"].rsplit("/", 1)[1]]
            media = response.get("content", {}).get("application/json")
            if media and "example" in media:
                errors = list(_validator(spec, media["schema"]).iter_errors(media["example"]))
                assert not errors, f"{method} {path} {code}: {errors[0].message}"


def test_ReadEndpoints_Expect_AnswersMatchTheSpec(spec, client):
    for path in ("/health", "/health/internet", "/info", "/formats", "/models/remove-background",
                 "/models/upscale", "/storage", "/storage/files"):
        response = client.get(f"/api/v1{path}")
        assert response.status_code == 200, path
        _check(spec, path, "get", response)


def test_JobFlow_Expect_AnswersMatchTheSpec(spec, client):
    started = client.post("/api/v1/jobs", data={"files[]": (io.BytesIO(_png()), "a.png"), "format": "png"},
                          content_type="multipart/form-data")
    assert started.status_code == 202
    _check(spec, "/jobs", "post", started)
    job = started.get_json()
    headers = {"X-Job-Token": job["token"]}
    for _ in range(500):
        state = client.get(f"/api/v1/jobs/{job['id']}", headers=headers)
        if state.get_json()["status"] in ("done", "failed"):
            break
    _check(spec, "/jobs/{job_id}", "get", state)
    assert state.get_json()["status"] == "done"
    zipped = client.get(f"/api/v1/jobs/{job['id']}/zip", headers=headers)
    assert zipfile.ZipFile(io.BytesIO(zipped.data)).namelist() == ["a.png"]
    _check(spec, "/jobs/{job_id}", "get", client.get(f"/api/v1/jobs/{job['id']}"))  # 404
    _check(spec, "/jobs/{job_id}/cancel", "post", client.post(f"/api/v1/jobs/{job['id']}/cancel", headers=headers))


def test_EditorEndpoints_Expect_AnswersMatchTheSpec(spec, client):
    asset = client.post("/api/v1/editor/assets", data={"file": (io.BytesIO(_png()), "bg.png")},
                        content_type="multipart/form-data")
    assert asset.status_code == 200
    _check(spec, "/editor/assets", "post", asset)
    edit = client.post("/api/v1/edit", data={"file": (io.BytesIO(_png()), "a.png"), "fit_width": "20",
                                            "fit_height": "20"}, content_type="multipart/form-data")
    assert edit.status_code == 200
    _check(spec, "/edit", "post", edit)
    _check(spec, "/edit", "post", client.post("/api/v1/edit", data={}, content_type="multipart/form-data"))


@pytest.mark.parametrize("data, status", [
    ({}, 400),
    ({"files[]": (io.BytesIO(b"x"), "notes.txt")}, 415),
    ({"files[]": (io.BytesIO(b"not a picture"), "broken.png"), "format": "png"}, 422),
    ({"files[]": (io.BytesIO(b"x"), "a.png"), "quality": "500"}, 400),
])
def test_ConvertErrors_Expect_TheDocumentedErrorShape(spec, client, data, status):
    response = client.post("/api/v1/convert", data=data, content_type="multipart/form-data")
    assert response.status_code == status, response.get_json()
    _check(spec, "/convert", "post", response)


def test_Docs_Expect_SwaggerUiPageWithLocalAssetsAndSeoTags(client):
    page = client.get("/api/v1/docs").get_data(as_text=True)
    assert f"<title>{openapi.DOCS_TITLE}</title>" in page
    assert f'<meta name="description" content="{openapi.DOCS_META_DESCRIPTION}">' in page
    assert '<meta name="robots" content="index, follow">' in page
    assert 'property="og:title"' in page and 'name="twitter:card"' in page
    assert 'rel="canonical"' not in page
    assert "/api/v1/docs/swagger-ui-bundle.js" in page and "/api/v1/docs/swagger-ui.css" in page
    assert "/api/v1/docs/og-image.webp" in page and "/api/v1/docs/favicon.webp" in page
    assert "http" not in page.split("<body>")[1], "no CDN: the container works offline"
    assert "localhost" not in page
    init = client.get("/api/v1/docs/swagger-ui-init.js")
    assert init.status_code == 200 and b"SwaggerUIBundle" in init.data
    assert b"getSampleSchema" in init.data and b"noPrefill" in init.data
    assert client.get("/api/v1/docs/og-image.webp").status_code == 200
    assert client.get("/api/v1/docs/favicon.webp").status_code == 200
    assert client.get("/api/v1/docs/../server.py").status_code == 404
    assert client.get("/api/v1/docs/index.css").status_code == 404


def test_LegacyHealthAlias_Expect_DeprecatedInSpecAndSameAnswerAsHealth(spec, client):
    operation = spec["paths"][_LEGACY_HEALTH]["get"]
    assert operation.get("deprecated") is True
    assert "/api/v1/health" in operation["description"]
    assert "2.0" in operation["description"]
    current = client.get("/api/v1/health")
    alias = client.get(_LEGACY_HEALTH)
    assert alias.status_code == 200
    assert alias.get_json()["status"] == current.get_json()["status"]
    assert alias.get_json()["api_version"] == current.get_json()["api_version"]
    _check(spec, _LEGACY_HEALTH, "get", alias)

_EXAMPLE_ORIGIN = "https://imgcompress.example.com"


def _curl_text(spec) -> str:
    parts = [spec["info"]["description"]]
    for _, _, operation in _operations(spec):
        parts.append(operation.get("description", ""))
    return "\n".join(parts)


def test_ServersAndCurl_Expect_RelativeServerAndPlaceholderWhenPublicBaseUrlIsUnset(monkeypatch):
    monkeypatch.delenv("PUBLIC_BASE_URL", raising=False)
    spec = openapi.build_spec()
    validate(spec)
    assert spec["servers"] == [{"url": "/api/v1", "description": "This container"}]
    examples = _curl_text(spec)
    assert "localhost" not in examples
    assert f"{_EXAMPLE_ORIGIN}/api/v1/convert" in examples
    assert f"{_EXAMPLE_ORIGIN}/api/health/backend" in examples
    assert spec["paths"][_LEGACY_HEALTH]["get"]["servers"][0]["url"] == "/"


def test_ServersAndCurl_Expect_ScriptRootStaysRelativeWhenPublicBaseUrlIsUnset(monkeypatch):
    monkeypatch.delenv("PUBLIC_BASE_URL", raising=False)
    spec = openapi.build_spec(script_root="/imgcompress")
    validate(spec)
    assert spec["servers"][0]["url"] == "/imgcompress/api/v1"
    assert not spec["servers"][0]["url"].startswith("http")
    assert spec["paths"][_LEGACY_HEALTH]["get"]["servers"][0]["url"] == "/imgcompress"


@pytest.mark.parametrize("raw, origin", [
    ("https://photos.example.com", "https://photos.example.com"),
    ("https://photos.example.com/", "https://photos.example.com"),
    ("  https://photos.example.com/imgcompress/  ", "https://photos.example.com/imgcompress"),
])
def test_ServersAndCurl_Expect_PublicBaseUrlWithTrailingSlashStripped(monkeypatch, raw, origin):
    monkeypatch.setenv("PUBLIC_BASE_URL", raw)
    spec = openapi.build_spec(script_root="/ignored")
    validate(spec)
    assert spec["servers"] == [{"url": f"{origin}/api/v1", "description": "This container"}]
    examples = _curl_text(spec)
    assert "localhost" not in examples
    assert f"{origin}/api/v1/convert" in examples
    assert f"{origin}/api/v1/health" in examples
    assert f"{origin}/api/health/backend" in examples
    assert f"{origin}//" not in examples
    assert spec["paths"][_LEGACY_HEALTH]["get"]["servers"][0]["url"] == origin


def test_ServersAndCurl_Expect_InvalidPublicBaseUrlFallsBackToRelative(monkeypatch):
    monkeypatch.setenv("PUBLIC_BASE_URL", "https://user:secret@evil.example")
    spec = openapi.build_spec()
    validate(spec)
    assert spec["servers"][0]["url"] == "/api/v1"
    examples = _curl_text(spec)
    assert "localhost" not in examples
    assert "evil.example" not in examples
    assert "secret" not in examples
    assert f"{_EXAMPLE_ORIGIN}/api/v1/convert" in examples


def test_ServedOpenapiJson_Expect_ServersFollowPublicBaseUrl(client, monkeypatch):
    unset = client.get("/api/v1/openapi.json")
    assert unset.status_code == 200
    body = unset.get_json()
    validate(body)
    assert body["servers"][0]["url"] == "/api/v1"
    assert "localhost" not in body["info"]["description"]

    monkeypatch.setenv("PUBLIC_BASE_URL", "https://imgcompress.example.com/")
    set_spec = client.get("/api/v1/openapi.json").get_json()
    validate(set_spec)
    assert set_spec["servers"][0]["url"] == "https://imgcompress.example.com/api/v1"
    assert "https://imgcompress.example.com/api/v1/convert" in set_spec["info"]["description"]
    assert "localhost" not in set_spec["info"]["description"]


def test_DocsHtml_Expect_CanonicalAndOgUrlOnlyWhenPublicBaseUrlIsSet(client, monkeypatch):
    unset = client.get("/api/v1/docs").get_data(as_text=True)
    assert 'rel="canonical"' not in unset
    assert 'property="og:url"' not in unset

    monkeypatch.setenv("PUBLIC_BASE_URL", "https://photos.example.com/")
    page = client.get("/api/v1/docs").get_data(as_text=True)
    assert f"<title>{openapi.DOCS_TITLE}</title>" in page
    assert f'<meta name="description" content="{openapi.DOCS_META_DESCRIPTION}">' in page
    assert 'href="https://photos.example.com/api/v1/docs"' in page
    assert 'content="https://photos.example.com/api/v1/docs"' in page
    assert "https://photos.example.com/api/v1/docs/og-image.webp" in page
    assert "localhost" not in page
