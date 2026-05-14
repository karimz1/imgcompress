from backend.image_converter.config import settings


def load_rembg_model_name() -> str:
    """Composition-root convenience for converters built outside the Flask blueprint.

    Feature code should receive the model name as a constructor argument
    instead of calling this. The CLI / direct-converter entry points still
    use it because they have no service container of their own.
    """
    return settings.get().rembg.model_name
