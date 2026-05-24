from backend.image_converter.config import settings


def load_rembg_model_name() -> str:
    """Return the configured rembg model name for non-container entry points."""
    return settings.get().rembg.model_name