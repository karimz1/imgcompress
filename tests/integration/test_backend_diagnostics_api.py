import pytest

from backend.image_converter.config import settings
from backend.image_converter.presentation.web import routes
from backend.image_converter.presentation.web.server import app
from backend.image_converter.presentation.web.services.storage_management_service import (
    StorageManagementService,
)


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


def test_backend_logs_endpoint_respects_storage_management_flag(client, monkeypatch):
    monkeypatch.setenv("DISABLE_STORAGE_MANAGEMENT", "true")
    settings.reset_cache()
    monkeypatch.setattr(
        routes,
        "storage_management_service",
        StorageManagementService(
            is_enabled=settings.get().features.is_storage_management_enabled,
        ),
    )

    response = client.get("/api/logs/backend")

    assert response.status_code == 403
    settings.reset_cache()
