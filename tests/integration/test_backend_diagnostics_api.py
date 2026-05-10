import pytest

from backend.image_converter.presentation.web.server import app


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


def test_backend_logs_endpoint_respects_storage_management_flag(client, monkeypatch):
    monkeypatch.setenv("DISABLE_STORAGE_MANAGEMENT", "true")

    response = client.get("/api/logs/backend")

    assert response.status_code == 403
