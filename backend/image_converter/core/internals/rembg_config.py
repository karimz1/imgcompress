from typing import Optional

from backend.image_converter.config import settings


def load_default_rembg_model() -> str:
    """Return the configured default rembg model name."""
    return settings.get().rembg.default_model


def load_rembg_available_models() -> list[str]:
    """Return the allowlist of selectable rembg models."""
    return list(settings.get().rembg.available_models)


def resolve_rembg_model(requested: Optional[str]) -> str:
    """Resolve a user-requested model to a safe value.

    Returns ``requested`` when it is a member of the configured allowlist,
    otherwise falls back to the configured default model. This is the single
    place that enforces the allowlist for incoming requests.
    """
    default = load_default_rembg_model()
    if not requested:
        return default
    requested = requested.strip()
    return requested if requested in load_rembg_available_models() else default
