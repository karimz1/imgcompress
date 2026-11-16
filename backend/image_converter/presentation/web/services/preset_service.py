from dataclasses import dataclass
from typing import Any, Optional

from backend.image_converter.domain.compression_presets import (
    MAX_PRESETS,
    parse_name,
    parse_settings,
)
from backend.image_converter.infrastructure.preset_store import (
    PresetLimitReachedError,
    PresetNameTakenError,
    PresetNotFoundError,
    PresetStorageUnavailableError,
    PresetStore,
    is_valid_preset_id,
)

_EDITABLE_FIELDS = frozenset({"name", "settings"})
# Set by the server only; a client sending them gets told so instead of
# having them silently ignored.
_SERVER_FIELDS = frozenset({"id", "created_at", "updated_at"})

# Every error answer has a readable "error" and a stable "code" the browser
# turns into a message in the user's language.
INVALID = "invalid"
DISABLED = "disabled"
NOT_FOUND = "not_found"
LIMIT_REACHED = "limit_reached"
NAME_TAKEN = "name_taken"
UNAVAILABLE = "unavailable"

DISABLED_ERROR = "Custom presets are disabled on this server."
NOT_FOUND_ERROR = "Preset not found."
UNAVAILABLE_ERROR = "Preset storage is unavailable. See the server log for details."
LIMIT_ERROR = f"You can save at most {MAX_PRESETS} presets. Delete one first."
NAME_TAKEN_ERROR = "A preset with this name already exists."


@dataclass(frozen=True)
class PresetResponse:
    body: dict
    status_code: int


class PresetService:
    """Turns preset API requests into store calls and HTTP answers."""

    def __init__(self, store: PresetStore, is_enabled: bool):
        self._store = store
        self.is_enabled = is_enabled

    def list_presets(self) -> PresetResponse:
        return self._run(lambda: PresetResponse({"presets": self._store.all()}, 200))

    def create(self, payload: Any) -> PresetResponse:
        def create() -> PresetResponse:
            fields = _parse_payload(payload, require_all=True)
            if isinstance(fields, PresetResponse):
                return fields
            name, settings = fields
            return PresetResponse(self._store.create(name, settings), 201)

        return self._run(create)

    def update(self, preset_id: str, payload: Any) -> PresetResponse:
        def update() -> PresetResponse:
            if not is_valid_preset_id(preset_id):
                return _error(NOT_FOUND_ERROR, 404, NOT_FOUND)
            fields = _parse_payload(payload, require_all=False)
            if isinstance(fields, PresetResponse):
                return fields
            name, settings = fields
            return PresetResponse(self._store.update(preset_id, name=name, settings=settings), 200)

        return self._run(update)

    def delete(self, preset_id: str) -> PresetResponse:
        def delete() -> PresetResponse:
            if not is_valid_preset_id(preset_id):
                return _error(NOT_FOUND_ERROR, 404, NOT_FOUND)
            self._store.delete(preset_id)
            return PresetResponse({}, 204)

        return self._run(delete)

    def _run(self, action) -> PresetResponse:
        # Checked first, so a disabled server never touches the preset file.
        if not self.is_enabled:
            return _error(DISABLED_ERROR, 403, DISABLED)
        try:
            return action()
        except PresetNotFoundError:
            return _error(NOT_FOUND_ERROR, 404, NOT_FOUND)
        except PresetLimitReachedError:
            return _error(LIMIT_ERROR, 409, LIMIT_REACHED)
        except PresetNameTakenError:
            return _error(NAME_TAKEN_ERROR, 409, NAME_TAKEN)
        except PresetStorageUnavailableError:
            return _error(UNAVAILABLE_ERROR, 503, UNAVAILABLE)


def _parse_payload(payload: Any, *, require_all: bool) -> "tuple[Optional[str], Optional[dict]] | PresetResponse":
    if not isinstance(payload, dict):
        return _error("Request body must be a JSON object.", 400, INVALID)
    server_fields = sorted(_SERVER_FIELDS & set(payload))
    if server_fields:
        return _error(f"These fields are set by the server: {', '.join(server_fields)}.", 400, INVALID)
    unknown = sorted(str(key) for key in payload if key not in _EDITABLE_FIELDS)
    if unknown:
        return _error(f"Unknown fields: {', '.join(unknown)}.", 400, INVALID)
    if require_all and not _EDITABLE_FIELDS <= set(payload):
        return _error("Send both name and settings.", 400, INVALID)
    if not payload:
        return _error("Send a name, settings or both.", 400, INVALID)

    name: Optional[str] = None
    if "name" in payload:
        parsed_name = parse_name(payload["name"])
        if not parsed_name.is_successful:
            return _error(parsed_name.error, 400, INVALID)
        name = parsed_name.value

    settings: Optional[dict] = None
    if "settings" in payload:
        parsed_settings = parse_settings(payload["settings"])
        if not parsed_settings.is_successful:
            return _error(parsed_settings.error, 400, INVALID)
        settings = parsed_settings.value

    return name, settings


def _error(message: str, status_code: int, code: str) -> PresetResponse:
    return PresetResponse({"error": message, "code": code}, status_code)
