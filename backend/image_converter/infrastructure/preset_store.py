"""Compression presets in one JSON file, shared by every Granian worker.

Nothing is cached in memory: each worker reads the file for every request, so
a preset saved through one worker is seen by all others right away.

Changes take an exclusive ``flock`` on ``<file>.lock``, read the latest file
while holding it, write ``<file>.tmp``, flush and fsync it, and replace the
file in one step with ``os.replace``. Readers never see half a file, and two
workers saving at once cannot lose each other's change.

A file that is not valid JSON, has an unknown schema version or holds an
invalid preset is never overwritten. The problem is logged and every preset
call reports the storage as unavailable until someone fixes or removes the
file; image conversion does not depend on it and keeps working.
"""

import json
import os
import re
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Callable, Iterator, Optional

from backend.image_converter.core.internals.utilities import Result
from backend.image_converter.domain.compression_presets import (
    MAX_PRESETS,
    parse_name,
    parse_settings,
)

try:
    import fcntl
except ImportError:  # Not POSIX: no cross-process locking.
    fcntl = None

SCHEMA_VERSION = 1
_ID_PATTERN = re.compile(r"^[0-9a-f]{32}$")
_TIMESTAMP_FORMAT = "%Y-%m-%dT%H:%M:%SZ"


class PresetStorageUnavailableError(Exception):
    """The preset file cannot be read or written, or holds data this version does not understand."""


class PresetNotFoundError(Exception):
    pass


class PresetLimitReachedError(Exception):
    pass


class PresetNameTakenError(Exception):
    pass


def is_valid_preset_id(preset_id: Optional[str]) -> bool:
    return isinstance(preset_id, str) and _ID_PATTERN.fullmatch(preset_id) is not None


def _utc_now() -> str:
    return datetime.now(timezone.utc).strftime(_TIMESTAMP_FORMAT)


class PresetStore:
    def __init__(
        self,
        path: str,
        logger,
        *,
        max_presets: int = MAX_PRESETS,
        clock: Callable[[], str] = _utc_now,
    ):
        self._path = path
        self._lock_path = f"{path}.lock"
        self._tmp_path = f"{path}.tmp"
        self._logger = logger
        self._max_presets = max_presets
        self._clock = clock

    def list(self) -> list[dict]:
        return self._read()

    def create(self, name: str, settings: dict) -> dict:
        with self._locked():
            presets = self._read()
            if len(presets) >= self._max_presets:
                raise PresetLimitReachedError()
            self._ensure_name_free(presets, name)
            now = self._clock()
            preset = {
                "id": uuid.uuid4().hex,
                "name": name,
                "created_at": now,
                "updated_at": now,
                "settings": settings,
            }
            self._write([*presets, preset])
            return preset

    def update(self, preset_id: str, *, name: Optional[str] = None, settings: Optional[dict] = None) -> dict:
        with self._locked():
            presets = self._read()
            index = self._index_of(presets, preset_id)
            preset = dict(presets[index])
            if name is not None:
                self._ensure_name_free(presets, name, ignore_id=preset_id)
                preset["name"] = name
            if settings is not None:
                preset["settings"] = settings
            preset["updated_at"] = self._clock()
            presets[index] = preset
            self._write(presets)
            return preset

    def delete(self, preset_id: str) -> None:
        with self._locked():
            presets = self._read()
            index = self._index_of(presets, preset_id)
            del presets[index]
            self._write(presets)

    @staticmethod
    def _index_of(presets: list[dict], preset_id: str) -> int:
        for index, preset in enumerate(presets):
            if preset["id"] == preset_id:
                return index
        raise PresetNotFoundError()

    @staticmethod
    def _ensure_name_free(presets: list[dict], name: str, ignore_id: Optional[str] = None) -> None:
        # Case-insensitive, so the list never shows two presets that look alike.
        wanted = name.casefold()
        if any(p["name"].casefold() == wanted and p["id"] != ignore_id for p in presets):
            raise PresetNameTakenError()

    @contextmanager
    def _locked(self) -> Iterator[None]:
        try:
            os.makedirs(os.path.dirname(self._path) or ".", exist_ok=True)
            fd = os.open(self._lock_path, os.O_RDWR | os.O_CREAT, 0o644)
        except OSError as exc:
            self._unavailable(f"cannot open the preset lock file {self._lock_path}: {exc}")
        try:
            if fcntl is not None:
                fcntl.flock(fd, fcntl.LOCK_EX)
            yield
        finally:
            # Closing the descriptor releases the lock.
            os.close(fd)

    def _read(self) -> list[dict]:
        try:
            with open(self._path, "r", encoding="utf-8") as f:
                document = json.load(f)
        except FileNotFoundError:
            return []
        except (OSError, UnicodeDecodeError) as exc:
            self._unavailable(f"cannot read the preset file {self._path}: {exc}")
        except json.JSONDecodeError as exc:
            self._unavailable(f"the preset file {self._path} is not valid JSON: {exc}")

        parsed = _parse_document(document)
        if not parsed.is_successful:
            self._unavailable(f"the preset file {self._path} {parsed.error}")
        return parsed.value

    def _write(self, presets: list[dict]) -> None:
        document = {"version": SCHEMA_VERSION, "presets": presets}
        try:
            with open(self._tmp_path, "w", encoding="utf-8") as f:
                json.dump(document, f, ensure_ascii=False, indent=2)
                f.write("\n")
                f.flush()
                os.fsync(f.fileno())
            os.replace(self._tmp_path, self._path)
        except OSError as exc:
            try:
                os.remove(self._tmp_path)
            except OSError:
                pass
            self._unavailable(f"cannot write the preset file {self._path}: {exc}")
        self._sync_directory()

    def _sync_directory(self) -> None:
        """Makes the rename itself durable; not every file system supports it."""
        try:
            fd = os.open(os.path.dirname(self._path) or ".", os.O_RDONLY)
        except OSError:
            return
        try:
            os.fsync(fd)
        except OSError:
            pass
        finally:
            os.close(fd)

    def _unavailable(self, message: str):
        self._logger.log(f"Presets unavailable: {message}", "error")
        raise PresetStorageUnavailableError(message)


def _parse_document(document: object) -> Result[list[dict]]:
    """The presets of the file, normalized, or why the content cannot be used."""
    if not isinstance(document, dict):
        return Result.failure("must hold a JSON object")
    version = document.get("version")
    if isinstance(version, bool) or version != SCHEMA_VERSION:
        return Result.failure(f"has unsupported schema version {version!r} (expected {SCHEMA_VERSION})")
    stored = document.get("presets")
    if not isinstance(stored, list):
        return Result.failure("must hold a 'presets' list")
    presets: list[dict] = []
    seen: set[str] = set()
    for index, entry in enumerate(stored):
        parsed = _parse_preset(entry)
        if parsed.is_successful and parsed.value["id"] in seen:
            parsed = Result.failure("repeats an id")
        if not parsed.is_successful:
            return Result.failure(f"has an invalid preset at index {index}: {parsed.error}")
        seen.add(parsed.value["id"])
        presets.append(parsed.value)
    return Result.success(presets)


def _parse_preset(entry: object) -> Result[dict]:
    # Names and settings go through the same rules as the API, so a file
    # edited by hand works as long as it would have been accepted there.
    if not isinstance(entry, dict):
        return Result.failure("not an object")
    if set(entry) != {"id", "name", "created_at", "updated_at", "settings"}:
        return Result.failure("must have exactly id, name, created_at, updated_at and settings")
    if not is_valid_preset_id(entry["id"]):
        return Result.failure("id must be 32 lowercase hex characters")
    for key in ("created_at", "updated_at"):
        if not _is_timestamp(entry[key]):
            return Result.failure(f"{key} must be a UTC time like 2026-01-31T12:00:00Z")
    name = parse_name(entry["name"])
    if not name.is_successful:
        return Result.failure(name.error)
    settings = parse_settings(entry["settings"])
    if not settings.is_successful:
        return Result.failure(settings.error)
    return Result.success({**entry, "name": name.value, "settings": settings.value})


def _is_timestamp(value: object) -> bool:
    if not isinstance(value, str):
        return False
    try:
        datetime.strptime(value, _TIMESTAMP_FORMAT)
    except ValueError:
        return False
    return True
