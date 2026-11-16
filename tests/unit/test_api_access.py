"""Who may call /api/v1: the web UI, scripts, other websites, with and without PUBLIC_API_KEY.

The browser marks where a request comes from (Sec-Fetch-Site, else Origin);
other websites cannot fake those headers. Each test drives the real app.
"""

import pytest

from backend.image_converter.config import settings
from backend.image_converter.presentation.web.server import app

KEY = "correct horse battery staple"
SAME_ORIGIN = {"Sec-Fetch-Site": "same-origin"}
CROSS_SITE = {"Sec-Fetch-Site": "cross-site", "Origin": "https://blog.example"}
# A POST that passes the gate answers 404 (no such job); a refused one 401/403.
GATED_POST = "/api/v1/jobs/aaaaaaaaaaaaaaaaaaaaaa/cancel"


@pytest.fixture
def configure(monkeypatch):
    def apply(public=None, key=None, base_url=None):
        for name, value in (("ENABLE_PUBLIC_API", public), ("PUBLIC_API_KEY", key), ("PUBLIC_BASE_URL", base_url)):
            if value is None:
                monkeypatch.delenv(name, raising=False)
            else:
                monkeypatch.setenv(name, value)
        settings.reset_cache()
        return app.test_client()

    yield apply
    settings.reset_cache()


# --- ENABLE_PUBLIC_API off (default) -----------------------------------------------

def test_When_Default_Expect_WebUiRequestsWorkWithoutCorsHeaders(configure):
    client = configure()
    response = client.get("/api/v1/formats", headers=SAME_ORIGIN)
    assert response.status_code == 200
    assert "Access-Control-Allow-Origin" not in response.headers
    assert client.post(GATED_POST, headers=SAME_ORIGIN).status_code == 404


def test_When_Default_Expect_ScriptsOnTheNetworkStillWork(configure):
    client = configure()
    assert client.get("/api/v1/formats").status_code == 200
    assert client.post(GATED_POST).status_code == 404


@pytest.mark.parametrize("headers", [
    {"Sec-Fetch-Site": "cross-site"},
    {"Sec-Fetch-Site": "same-site"},
    {"Origin": "https://evil.example"},
    {"Origin": "null"},
])
def test_When_Default_Expect_OtherWebsitesAreRefused(configure, headers):
    client = configure()
    for response in (client.post(GATED_POST, headers=headers), client.get("/api/v1/formats", headers=headers)):
        assert response.status_code == 403
        assert response.get_json()["error"] == "Forbidden"
        assert "ENABLE_PUBLIC_API" in response.get_json()["message"]
        assert "Access-Control-Allow-Origin" not in response.headers


def test_When_Default_Expect_CrossSitePreflightIsRefused(configure):
    client = configure()
    response = client.options("/api/v1/convert", headers={
        **CROSS_SITE, "Access-Control-Request-Method": "POST",
    })
    assert response.status_code == 403
    assert "Access-Control-Allow-Origin" not in response.headers


@pytest.mark.parametrize("origin, extra", [
    ("http://localhost", {}),
    ("https://img.example.com", {"X-Forwarded-Host": "img.example.com"}),
    ("https://img.example.com:443", {"X-Forwarded-Host": "img.example.com"}),
])
def test_When_OnlyOriginIsSent_Expect_OwnHostIsTheWebUi(configure, origin, extra):
    """Older browsers send Origin but no Sec-Fetch-Site; behind Traefik the host comes forwarded."""
    client = configure()
    assert client.post(GATED_POST, headers={"Origin": origin, **extra}).status_code == 404


def test_When_PublicBaseUrlIsSet_Expect_ItsOriginIsTheWebUi(configure):
    client = configure(base_url="https://photos.example.org/imgcompress")
    assert client.post(GATED_POST, headers={"Origin": "https://photos.example.org"}).status_code == 404


def test_When_Default_Expect_DocsAndSpecAreNotExposed(configure):
    client = configure()
    for path in ("/api/v1/docs", "/api/v1/openapi.json", "/api/v1/docs/swagger-ui-init.js"):
        assert client.get(path, headers=SAME_ORIGIN).status_code == 404, path


# --- ENABLE_PUBLIC_API on -------------------------------------------------------------

def test_When_PublicApiIsOn_Expect_DocsSpecAndCors(configure):
    client = configure(public="true")
    docs = client.get("/api/v1/docs")
    assert docs.status_code == 200
    assert b"/api/v1/openapi.json" in docs.data
    assert client.get("/api/v1/openapi.json").get_json()["openapi"].startswith("3.1")

    response = client.get("/api/v1/formats", headers=CROSS_SITE)
    assert response.status_code == 200
    assert response.headers["Access-Control-Allow-Origin"] == "*"
    # No cookies are ever used, so credentials are never allowed.
    assert "Access-Control-Allow-Credentials" not in response.headers
    assert "X-Converted-Count" in response.headers["Access-Control-Expose-Headers"]


def test_When_PublicApiIsOn_Expect_PreflightAllowsTheKeyHeaders(configure):
    client = configure(public="true", key=KEY)
    response = client.options("/api/v1/convert", headers={
        **CROSS_SITE, "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization, x-api-key",
    })
    assert response.status_code == 204
    assert response.headers["Access-Control-Allow-Origin"] == "*"
    allowed = response.headers["Access-Control-Allow-Headers"].lower()
    assert "authorization" in allowed and "x-api-key" in allowed and "x-job-token" in allowed


def test_When_PublicApiIsOnWithoutKey_Expect_OtherWebsitesMayCall(configure):
    client = configure(public="true")
    assert client.post(GATED_POST, headers=CROSS_SITE).status_code == 404


# --- PUBLIC_API_KEY ---------------------------------------------------------------------------

@pytest.mark.parametrize("public", ["true", None])
def test_When_KeyIsSet_Expect_CallsWithoutItAreRefused(configure, public):
    client = configure(public=public, key=KEY)
    headers = CROSS_SITE if public else {}
    for response in (client.post(GATED_POST, headers=headers), client.get("/api/v1/info", headers=headers)):
        assert response.status_code == 401
        assert response.headers["WWW-Authenticate"].startswith("Bearer")
        assert KEY not in response.get_data(as_text=True)


@pytest.mark.parametrize("auth", [
    {"Authorization": f"Bearer {KEY}"},
    {"Authorization": f"bearer {KEY}"},
    {"X-API-Key": KEY},
])
def test_When_KeyIsSet_Expect_BothHeadersWork(configure, auth):
    client = configure(public="true", key=KEY)
    assert client.post(GATED_POST, headers={**CROSS_SITE, **auth}).status_code == 404
    assert client.get("/api/v1/info", headers=auth).status_code == 200


@pytest.mark.parametrize("auth", [
    {"Authorization": "Bearer wrong"},
    {"X-API-Key": KEY + "x"},
    {"Authorization": KEY},
    {"Authorization": "Bearer "},
])
def test_When_KeyIsWrong_Expect_401(configure, auth):
    client = configure(public="true", key=KEY)
    assert client.get("/api/v1/info", headers=auth).status_code == 401


def test_When_KeyIsSet_Expect_WebUiNeverNeedsIt(configure):
    client = configure(public="true", key=KEY)
    assert client.get("/api/v1/info", headers=SAME_ORIGIN).status_code == 200
    assert client.post(GATED_POST, headers=SAME_ORIGIN).status_code == 404
    # A bookmark or typed URL ("none") is the user, not another website.
    assert client.get("/api/v1/formats", headers={"Sec-Fetch-Site": "none"}).status_code == 200


def test_When_KeyIsSet_Expect_HealthChecksAndDocsStayOpen(configure):
    client = configure(public="true", key=KEY)
    for path in ("/api/v1/health", "/api/v1/health/internet", "/api/health/backend",
                 "/api/v1/docs", "/api/v1/openapi.json"):
        assert client.get(path).status_code == 200, path


def test_When_PublicApiIsOff_Expect_LegacyHealthAliasStaysOpen(configure):
    """The alias follows /api/v1/health: no key, works with the public API off."""
    client = configure(key=KEY)
    response = client.get("/api/health/backend")
    current = client.get("/api/v1/health")
    assert response.status_code == 200
    body, expected = response.get_json(), current.get_json()
    assert body["status"] == expected["status"]
    assert body["api_version"] == expected["api_version"]
    assert "utc_time" in body


def test_When_KeyIsSetButPublicApiIsOff_Expect_OtherWebsitesStillRefusedEvenWithKey(configure):
    client = configure(key=KEY)
    response = client.post(GATED_POST, headers={**CROSS_SITE, "X-API-Key": KEY})
    assert response.status_code == 403


def test_When_KeyIsSet_Expect_ItNeverShowsInConfigRepr(configure):
    configure(public="true", key=KEY)
    assert KEY not in repr(settings.get())
    assert settings.get().public_api.requires_key


def test_When_KeyIsBlank_Expect_NoKeyRequired(configure):
    client = configure(public="true", key="   ")
    assert client.get("/api/v1/info", headers=CROSS_SITE).status_code == 200


def test_When_RefusedUploadIsSent_Expect_TheAnswerArrivesInsteadOfAReset(configure):
    """The 401 drains the upload first, like the 413 does, so clients see the status."""
    client = configure(public="true", key=KEY)
    response = client.post(
        "/api/v1/convert", data={"files[]": (__import__("io").BytesIO(b"x" * 4096), "a.png")},
        content_type="multipart/form-data",
    )
    assert response.status_code == 401
