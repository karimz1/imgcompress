"""The 404 page: HTML for browsers, JSON for scripts, in all three modes."""

import re

import pytest

from backend.image_converter.config import settings
from backend.image_converter.presentation.web.api_access import PAGE_ASSETS
from backend.image_converter.presentation.web.server import app

BROWSER = {"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"}
CURL = {"Accept": "*/*"}
JSON = {"Accept": "application/json"}
UNKNOWN = ["/api/", "/api/foo", "/api/v1/nope", "/random", "/some/deep/page"]
MODES = {
    "default": {},
    "public": {"ENABLE_PUBLIC_API": "true"},
    "api_only": {"API_ONLY": "true", "PUBLIC_API_KEY": "k" * 40},
}
HOME = 'href="/"'
DOCS = 'href="/api/v1/docs"'


@pytest.fixture
def client_for(monkeypatch):
    def build(mode):
        for name in ("ENABLE_PUBLIC_API", "PUBLIC_API_KEY", "API_ONLY", "PUBLIC_BASE_URL"):
            monkeypatch.delenv(name, raising=False)
        for name, value in MODES[mode].items():
            monkeypatch.setenv(name, value)
        settings.reset_cache()
        return app.test_client()

    yield build
    settings.reset_cache()


@pytest.mark.parametrize("mode", MODES)
@pytest.mark.parametrize("path", UNKNOWN)
def test_When_BrowserOpensUnknownUrl_Expect_404Page(client_for, mode, path):
    response = client_for(mode).get(path, headers=BROWSER)

    assert response.status_code == 404
    assert response.mimetype == "text/html"
    page = response.get_data(as_text=True)
    assert "Page not found" in page
    assert 'class="imgc-header"' in page
    assert "/api/v1/docs/logo.webp" in page
    assert "/api/v1/docs/mascot.webp" in page
    assert "/api/v1/docs/imgcompress-docs.css" in page


@pytest.mark.parametrize("mode", MODES)
@pytest.mark.parametrize("headers", [CURL, JSON, {}], ids=["curl", "json", "no-accept"])
@pytest.mark.parametrize("path", ["/api/", "/api/foo", "/api/v1/nope"])
def test_When_ScriptCallsUnknownApiUrl_Expect_Json404(client_for, mode, headers, path):
    response = client_for(mode).get(path, headers=headers)

    assert response.status_code == 404
    assert response.is_json
    assert response.get_json()["error"] == "Not Found"


@pytest.mark.parametrize("headers", [CURL, JSON], ids=["curl", "json"])
def test_When_ApiOnlyAndScriptCallsWebUiUrl_Expect_Json404ThatPointsToTheApi(client_for, headers):
    response = client_for("api_only").get("/random", headers=headers)

    assert response.status_code == 404
    assert "API only" in response.get_json()["message"]


def test_When_WebUiAndPublicApiOff_Expect_OnlyTheStartPageButton(client_for):
    page = client_for("default").get("/random", headers=BROWSER).get_data(as_text=True)

    assert HOME in page
    assert DOCS not in page


def test_When_WebUiAndPublicApiOn_Expect_StartPageAndDocs(client_for):
    page = client_for("public").get("/api/foo", headers=BROWSER).get_data(as_text=True)

    assert HOME in page
    assert DOCS in page


def test_When_ApiOnly_Expect_OnlyTheDocsLink(client_for):
    page = client_for("api_only").get("/random", headers=BROWSER).get_data(as_text=True)

    assert DOCS in page
    assert HOME not in page
    assert "API only" in page


@pytest.mark.parametrize("mode", MODES)
def test_When_404PageIsShown_Expect_NoDashesNoLocalhostOnlyRelativeLinks(client_for, mode):
    page = client_for(mode).get("/random", headers=BROWSER).get_data(as_text=True)

    assert "\u2014" not in page and "\u2013" not in page
    assert "localhost" not in page and "127.0.0.1" not in page
    for link in re.findall(r'(?:href|src)="([^"]+)"', page):
        assert link.startswith("/"), link


@pytest.mark.parametrize("mode", MODES)
@pytest.mark.parametrize("name", sorted(PAGE_ASSETS))
def test_When_404PageLoadsItsFiles_Expect_TheyAreServedInEveryMode(client_for, mode, name):
    response = client_for(mode).get(f"/api/v1/docs/{name}", headers={"Sec-Fetch-Site": "same-origin"})

    assert response.status_code == 200
    assert response.data


def test_When_PublicApiOff_Expect_SwaggerFilesStillHidden(client_for):
    client = client_for("default")

    assert client.get("/api/v1/docs/swagger-ui-init.js").status_code == 404
    assert client.get("/api/v1/docs").status_code == 404


def test_When_PublicApiOffAndBrowserOpensDocs_Expect_404PageWithoutDocsLink(client_for):
    response = client_for("default").get("/api/v1/docs", headers=BROWSER)

    assert response.status_code == 404
    assert DOCS not in response.get_data(as_text=True)


def test_When_KnownJobIsMissing_Expect_TheEndpointsOwnJson404EvenForBrowsers(client_for):
    response = client_for("default").get("/api/v1/jobs/" + "a" * 22, headers=BROWSER)

    assert response.status_code in (401, 404)
    assert response.is_json
