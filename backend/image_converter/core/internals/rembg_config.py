from backend.image_converter.config import settings


def load_rembg_model_name() -> str:
    return settings.rembg_model_name()
