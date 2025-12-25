import json
import os
from typing import Optional


def load_rembg_model_name(config_path: Optional[str] = None) -> str:
    default_model = "u2net"
    path = config_path or os.environ.get("REMBG_CONFIG_PATH") or "backend/image_converter/config/rembg.json"
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        model = data.get("model_name", "").strip()
        return model or default_model
    except Exception:
        return default_model
