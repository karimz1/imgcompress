"""Pictures for the editor (background, picture layers), uploaded once per session.

The editor would otherwise send every picture with every preview. Instead
each one is uploaded once and referenced by id:

- A session is a folder ``source_editor_<token>`` in the temp dir, with a
  random token from ``secrets``. Nothing lists the sessions, and downloads
  only ever serve ``converted_*`` folders, so a token cannot be found or a
  picture fetched; it can only be used to draw.
- Ids are checked against a strict pattern and the file must lie directly
  in that session's folder, so no path from a request reaches the disk.
- Requests hold the session folder with ``job_folder_lock`` and mark it as
  used. The normal temp cleanup removes idle sessions after the usual
  expiry and never touches one that is in use; the editor uploads again
  when its session is gone.
- Each picture is kept as uploaded plus a small proxy for scaled previews.
- Pictures may be as large as any other upload (``MAX_UPLOAD_SIZE_MB``). They
  are streamed to disk and decoded from there, never held twice in memory.
"""

import os
import re
import secrets
import shutil
import tempfile
from contextlib import contextmanager
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from typing import Iterator, Optional

from PIL import Image, ImageOps, UnidentifiedImageError

from backend.image_converter.config import settings
from backend.image_converter.core.internals.utilities import Result
from backend.image_converter.domain.smart_crop import to_8bit
from backend.image_converter.infrastructure import job_folder_lock

SESSION_PREFIX = "source_editor_"
_SESSION_TOKEN = re.compile(r"[A-Za-z0-9_-]{32}")
_ASSET_ID = re.compile(r"[A-Za-z0-9_-]{22}")

# No byte total per session: each picture may be as large as any upload, and
# the count keeps one session from piling up files.
MAX_ASSETS_PER_SESSION = 24
PROXY_MAX_SIDE = 2048
_CHUNK_BYTES = 1024 * 1024

# Raster formats Pillow decodes itself. No SVG, PSD or PDF: those need their
# own renderers and are not worth that for a backdrop or a logo.
PICTURE_FORMATS = ("PNG", "JPEG", "WEBP", "GIF", "BMP", "TIFF", "AVIF", "HEIF")

# Returned when a session or picture is gone (expired or never existed). The
# editor answers by uploading its pictures again.
EXPIRED_ERROR = "The editor pictures expired. Please try again."
# Returned when a session holds too many pictures. The editor starts a new
# session and uploads the pictures it still uses.
SESSION_FULL_ERROR = "This editor session has too many pictures."


@dataclass(frozen=True)
class StoredAsset:
    asset_id: str
    width: int
    height: int


def max_upload_bytes() -> int:
    """The configured upload limit (app.json or MAX_UPLOAD_SIZE_MB), the same for every upload."""
    return settings.get().uploads.max_file_size_bytes


def too_large_error(what: str, limit: int) -> str:
    return f"The {what} is too large (max {limit // (1024 * 1024)} MB)."


def decode_picture(source, what: str = "picture") -> Result[Image.Image]:
    """Decodes a picture (bytes, a path or a file) with the allowed formats only."""
    Image.init()
    # Only formats whose plugin is installed; Pillow fails on unknown names.
    formats = [name for name in PICTURE_FORMATS if name in Image.OPEN]
    if isinstance(source, (bytes, bytearray)):
        source = BytesIO(source)
    try:
        with Image.open(source, formats=formats) as opened:
            image = to_8bit(ImageOps.exif_transpose(opened))
            image.load()
            return Result.success(image)
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
        return Result.failure(
            f"Could not read the {what}. Use a PNG, JPEG, WebP, GIF, BMP, TIFF or AVIF file."
        )


def open_limited(upload, what: str = "picture") -> Result[Image.Image]:
    """Decodes an upload of at most the upload limit straight from its stream."""
    limit = max_upload_bytes()
    stream = getattr(upload, "stream", upload)
    try:
        start = stream.tell()
        size = stream.seek(0, os.SEEK_END) - start
        stream.seek(start)
    except (AttributeError, OSError, ValueError):
        size = None
    if size is None:
        # Not seekable: spool it to a temporary file and stop past the limit.
        with tempfile.TemporaryFile() as spooled:
            written = 0
            while chunk := stream.read(_CHUNK_BYTES):
                written += len(chunk)
                if written > limit:
                    return Result.failure(too_large_error(what, limit))
                spooled.write(chunk)
            spooled.seek(0)
            return decode_picture(spooled, what)
    if size > limit:
        return Result.failure(too_large_error(what, limit))
    return decode_picture(stream, what)


class EditorSession:
    """A session folder held for one request; pictures are read from it."""

    def __init__(self, path: Path):
        self.path = path

    def load(self, asset_id: object, full_size: bool) -> Result[Image.Image]:
        if not isinstance(asset_id, str) or not _ASSET_ID.fullmatch(asset_id):
            return Result.failure("Invalid picture id.")
        name = f"{asset_id}.src" if full_size else f"{asset_id}.proxy.png"
        target = self.path / name
        # Only regular files directly in this folder; never follow links.
        if target.parent != self.path or not target.is_file() or target.is_symlink():
            return Result.failure(EXPIRED_ERROR)
        try:
            handle = open(target, "rb")
        except OSError:
            return Result.failure(EXPIRED_ERROR)
        with handle:
            return decode_picture(handle)


class EditorAssetStore:
    def __init__(self, temp_dir: str):
        self.base_dir = Path(temp_dir).resolve()

    def add(self, session: Optional[str], upload) -> Result[tuple[str, StoredAsset]]:
        """Stores a picture; without a session a new one is started."""
        if upload is None:
            return Result.failure("Choose a picture.")
        if session:
            return self._store(session, upload)
        # A forced cleanup may remove a brand-new, still empty folder; take another.
        for _ in range(3):
            created = self._create_session()
            stored = self._store(created, upload)
            if not stored.is_successful:
                # Only this request knows the new token, so nobody else uses the folder.
                self.remove_session(created)
            if stored.is_successful or stored.error != EXPIRED_ERROR:
                return stored
            stream = getattr(upload, "stream", upload)
            try:
                stream.seek(0)
            except (AttributeError, OSError, ValueError):
                return stored
        return stored

    def _store(self, session: str, upload) -> Result[tuple[str, StoredAsset]]:
        with self.open(session) as opened:
            if not opened.is_successful:
                return Result.failure(opened.error)
            folder = opened.value.path
            if len(list(folder.glob("*.src"))) >= MAX_ASSETS_PER_SESSION:
                return Result.failure(SESSION_FULL_ERROR)

            asset_id = secrets.token_urlsafe(16)
            # Stream to a hidden part file, decode from disk, publish last.
            part = folder / f".{asset_id}.src.{secrets.token_hex(4)}.part"
            try:
                copied = self._copy_limited(upload, part)
                if not copied.is_successful:
                    return Result.failure(copied.error)
                picture_res = decode_picture(part)
                if not picture_res.is_successful:
                    return Result.failure(picture_res.error)
                picture = picture_res.value
                width, height = picture.size
                proxy = picture
                proxy.thumbnail((PROXY_MAX_SIDE, PROXY_MAX_SIDE), Image.Resampling.LANCZOS)
                del picture
                if proxy.mode not in ("RGB", "RGBA", "L", "LA"):
                    proxy = proxy.convert("RGBA" if "A" in proxy.getbands() else "RGB")
                buffer = BytesIO()
                proxy.save(buffer, format="PNG", compress_level=1)
                self._write(folder / f"{asset_id}.proxy.png", buffer.getvalue())
                # The source last: an id is usable once its full picture exists.
                os.replace(part, folder / f"{asset_id}.src")
            finally:
                part.unlink(missing_ok=True)
            return Result.success((session, StoredAsset(asset_id, width, height)))

    @staticmethod
    def _copy_limited(upload, target: Path) -> Result[None]:
        """Copies the upload in chunks; stops as soon as it is above the upload limit."""
        limit = max_upload_bytes()
        stream = getattr(upload, "stream", upload)
        written = 0
        fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "wb") as handle:
            while chunk := stream.read(_CHUNK_BYTES):
                written += len(chunk)
                if written > limit:
                    return Result.failure(too_large_error("picture", limit))
                handle.write(chunk)
        return Result.success(None)

    @contextmanager
    def open(self, session: object) -> Iterator[Result[EditorSession]]:
        """Holds the session folder for the request; cleanup skips it meanwhile."""
        folder = self._session_folder(session)
        if folder is None:
            yield Result.failure(EXPIRED_ERROR)
            return
        try:
            fd = job_folder_lock.hold_shared(str(folder))
        except (FileNotFoundError, NotADirectoryError):
            yield Result.failure(EXPIRED_ERROR)
            return
        try:
            yield Result.success(EditorSession(folder))
            try:
                os.utime(folder)
            except OSError:
                pass
        finally:
            job_folder_lock.release(fd)

    def _session_folder(self, session: object) -> Optional[Path]:
        if not isinstance(session, str) or not _SESSION_TOKEN.fullmatch(session):
            return None
        folder = self.base_dir / f"{SESSION_PREFIX}{session}"
        if folder.parent != self.base_dir or folder.is_symlink() or not folder.is_dir():
            return None
        return folder

    def _create_session(self) -> str:
        self.base_dir.mkdir(parents=True, exist_ok=True)
        while True:
            token = secrets.token_urlsafe(24)
            try:
                (self.base_dir / f"{SESSION_PREFIX}{token}").mkdir(mode=0o700)
                return token
            except FileExistsError:
                continue

    @staticmethod
    def _write(path: Path, data: bytes) -> None:
        temporary = path.with_name(f".{path.name}.{secrets.token_hex(4)}.part")
        try:
            fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(fd, "wb") as handle:
                handle.write(data)
            os.replace(temporary, path)
        finally:
            if temporary.exists():
                temporary.unlink(missing_ok=True)

    def remove_session(self, session: str) -> None:
        """Only for tests and explicit resets: deletes a whole session folder."""
        folder = self._session_folder(session)
        if folder is not None:
            shutil.rmtree(folder, ignore_errors=True)
