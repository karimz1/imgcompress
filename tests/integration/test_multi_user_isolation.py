"""Multi-user isolation for one shared container.

Several people use the same instance at the same time. Each test drives the
Flask app from parallel threads (one thread = one user) and checks that every
user only ever gets their own pixels back, and that one user's actions never
delete or expose another user's files.

The tests in the second half reproduced real races and leaks (shared ZIP name,
temp root served by /api/download, cleanup deleting running jobs, name
collisions in one batch) and guard their fixes.
"""

import io
import os
import shutil
import threading
import time
import zipfile
from concurrent.futures import ThreadPoolExecutor

import pytest
from PIL import Image

from backend.image_converter.application.dtos import CompressResult
from backend.image_converter.presentation.web import routes
from backend.image_converter.presentation.web.server import app

USERS = 8
# One distinct colour per user, so a mix-up is visible in the pixels.
COLOURS = [
    (255, 0, 0), (0, 255, 0), (0, 0, 255), (255, 255, 0),
    (255, 0, 255), (0, 255, 255), (128, 64, 0), (0, 64, 128),
]


def _png(colour, size=(64, 48)) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", size, colour).save(buffer, format="PNG")
    return buffer.getvalue()


def _centre_colour(data: bytes):
    with Image.open(io.BytesIO(data)) as img:
        rgb = img.convert("RGB")
        return rgb.getpixel((rgb.width // 2, rgb.height // 2))


def _close(a, b, tolerance=12) -> bool:
    return all(abs(x - y) <= tolerance for x, y in zip(a, b))


def _compress(client, files, fmt="png"):
    data = {"format": fmt, "files[]": [(io.BytesIO(raw), name) for name, raw in files]}
    return client.post("/api/compress", data=data, content_type="multipart/form-data")


def _run_parallel(fn, count=USERS):
    barrier = threading.Barrier(count)

    def wrapped(index):
        barrier.wait()
        return fn(index)

    with ThreadPoolExecutor(max_workers=count) as pool:
        return list(pool.map(wrapped, range(count)))


@pytest.fixture
def client():
    app.config["TESTING"] = True
    # No ``with`` block: a test client used as a context manager keeps one
    # pushed app context, which cannot be shared between user threads.
    return app.test_client()


@pytest.fixture
def forget_outputs():
    folders = []
    yield folders
    for folder in folders:
        shutil.rmtree(folder, ignore_errors=True)


# --------------------------------------------------------------------------
# Expected to pass: per-request temp folders keep users apart
# --------------------------------------------------------------------------


def test_parallel_compress_with_same_filename_returns_each_users_own_image(client, forget_outputs):
    def user(index):
        client = app.test_client()  # one browser per user
        res = _compress(client, [("photo.png", _png(COLOURS[index], (40 + index, 30)))])
        assert res.status_code == 200, res.get_json()
        body = res.get_json()
        forget_outputs.append(body["dest_folder"])
        assert body["converted_files"] == ["photo.png"]
        download = client.get(
            "/api/download",
            query_string={"folder": body["dest_folder"], "file": "photo.png"},
        )
        assert download.status_code == 200
        return body["dest_folder"], download.data

    results = _run_parallel(user)

    assert len({folder for folder, _ in results}) == USERS
    for index, (_, data) in enumerate(results):
        with Image.open(io.BytesIO(data)) as img:
            assert img.size == (40 + index, 30), f"user {index} got someone else's size"
        assert _close(_centre_colour(data), COLOURS[index]), f"user {index} got someone else's pixels"


def test_parallel_jpeg_compress_with_same_filename_returns_each_users_own_image(client, forget_outputs):
    def user(index):
        client = app.test_client()  # one browser per user
        res = _compress(client, [("IMG_0001.png", _png(COLOURS[index]))], fmt="jpeg")
        assert res.status_code == 200, res.get_json()
        body = res.get_json()
        forget_outputs.append(body["dest_folder"])
        name = body["converted_files"][0]
        download = client.get("/api/download", query_string={"folder": body["dest_folder"], "file": name})
        assert download.status_code == 200
        return download.data

    for index, data in enumerate(_run_parallel(user)):
        assert _close(_centre_colour(data), COLOURS[index], tolerance=20)


def test_parallel_fit_previews_do_not_mix(client):
    def user(index):
        client = app.test_client()
        res = client.post(
            "/api/crop/fit",
            data={
                "file": (io.BytesIO(_png(COLOURS[index], (100, 50))), "same.png"),
                "fit_width": str(60 + index),
                "fit_height": "60",
                "fit_mode": "solid",
                "fit_color": "#{:02x}{:02x}{:02x}".format(*COLOURS[(index + 1) % USERS]),
                "render": "true",
            },
            content_type="multipart/form-data",
        )
        assert res.status_code == 200, res.get_json()
        return res.data

    for index, data in enumerate(_run_parallel(user)):
        with Image.open(io.BytesIO(data)) as img:
            rgb = img.convert("RGB")
            assert rgb.size == (60 + index, 60)
            assert _close(rgb.getpixel((rgb.width // 2, rgb.height // 2)), COLOURS[index])
            # Padding above the image uses this user's fill colour.
            assert _close(rgb.getpixel((rgb.width // 2, 1)), COLOURS[(index + 1) % USERS])


def test_parallel_fit_background_images_do_not_mix(client):
    """Same file names, different background pictures: nobody sees another user's backdrop."""
    before = _temp_root_entries()

    def user(index):
        client = app.test_client()
        res = client.post(
            "/api/crop/fit",
            data={
                "file": (io.BytesIO(_png(COLOURS[index], (40, 40))), "same.png"),
                "fit_background": (io.BytesIO(_png(COLOURS[(index + 3) % USERS], (30, 20))), "background.png"),
                "fit_width": "80",
                "fit_height": "40",
                "fit_mode": "image",
                "fit_scale": "0.5",
                "render": "true",
            },
            content_type="multipart/form-data",
        )
        assert res.status_code == 200, res.get_json()
        return res.data

    for index, data in enumerate(_run_parallel(user)):
        with Image.open(io.BytesIO(data)) as img:
            rgb = img.convert("RGB")
            assert _close(rgb.getpixel((40, 20)), COLOURS[index])
            assert _close(rgb.getpixel((2, 2)), COLOURS[(index + 3) % USERS])
            assert _close(rgb.getpixel((77, 37)), COLOURS[(index + 3) % USERS])
    # Backgrounds stay in memory: no file or folder is left for cleanup to find.
    assert _temp_root_entries() == before


def test_parallel_crop_bitmaps_with_same_filename_do_not_mix(client):
    def user(index):
        client = app.test_client()
        res = client.post(
            "/api/crop/bitmap",
            data={"file": (io.BytesIO(_png(COLOURS[index], (30 + index, 20))), "same.png")},
            content_type="multipart/form-data",
        )
        assert res.status_code == 200, res.get_json()
        return res.data

    for index, data in enumerate(_run_parallel(user)):
        with Image.open(io.BytesIO(data)) as img:
            assert img.size == (30 + index, 20)
        assert _close(_centre_colour(data), COLOURS[index])


def test_download_rejects_path_traversal(client, forget_outputs):
    res = _compress(client, [("a.png", _png(COLOURS[0]))])
    folder = res.get_json()["dest_folder"]
    forget_outputs.append(folder)
    for params in (
        {"folder": folder, "file": "../../etc/passwd"},
        {"folder": "/etc", "file": "passwd"},
        {"folder": "../etc", "file": "passwd"},
        {"folder": folder + "/../..", "file": "etc/passwd"},
    ):
        assert client.get("/api/download", query_string=params).status_code == 404, params


# --------------------------------------------------------------------------
# Regression tests for races and leaks found in the multi-user audit
# --------------------------------------------------------------------------


def _temp_root_entries():
    return set(os.listdir(routes.TEMP_DIR))


def test_parallel_download_all_returns_each_users_own_zip(client, forget_outputs):
    folders = []
    for index in range(USERS):
        res = _compress(client, [("photo.png", _png(COLOURS[index]))])
        folders.append(res.get_json()["dest_folder"])
    forget_outputs.extend(folders)

    def user(index):
        client = app.test_client()
        res = client.get("/api/download_all", query_string={"folder": folders[index]})
        assert res.status_code == 200
        assert res.mimetype == "application/zip"
        return res.data

    zips = _run_parallel(user)
    mixed = []
    for index, data in enumerate(zips):
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                colour = _centre_colour(archive.read("photo.png"))
        except (zipfile.BadZipFile, KeyError) as exc:
            mixed.append((index, f"broken zip: {exc}"))
            continue
        if not _close(colour, COLOURS[index]):
            mixed.append((index, colour))
    assert not mixed, f"users received another user's ZIP: {mixed}"


def test_download_all_leaves_no_zip_in_the_temp_dir(client, forget_outputs):
    res = _compress(client, [("private.png", _png(COLOURS[0]))])
    folder = res.get_json()["dest_folder"]
    forget_outputs.append(folder)
    before = _temp_root_entries()

    download = client.get("/api/download_all", query_string={"folder": folder})

    assert download.status_code == 200
    assert "compressed_images.zip" in download.headers["Content-Disposition"]
    assert not {e for e in _temp_root_entries() - before if e.endswith(".zip")}
    assert sorted(os.listdir(folder)) == ["private.png"]


def test_other_user_cannot_fetch_zip_by_guessing_its_name(client, forget_outputs):
    res = _compress(client, [("private.png", _png(COLOURS[0]))])
    folder = res.get_json()["dest_folder"]
    forget_outputs.append(folder)
    before = int(time.time())
    assert client.get("/api/download_all", query_string={"folder": folder}).status_code == 200

    temp_root = routes.TEMP_DIR
    hits = [
        ts for ts in range(before - 1, int(time.time()) + 2)
        if client.get(
            "/api/download", query_string={"folder": temp_root, "file": f"converted_{ts}.zip"}
        ).status_code == 200
    ]
    assert not hits, f"guessed another user's ZIP: converted_{hits[0]}.zip"


def test_download_does_not_serve_arbitrary_files_from_temp_root(client):
    secret = os.path.join(routes.TEMP_DIR, "imgcompress-isolation-secret.txt")
    with open(secret, "w") as f:
        f.write("not yours")
    try:
        res = client.get(
            "/api/download",
            query_string={"folder": routes.TEMP_DIR, "file": os.path.basename(secret)},
        )
        assert res.status_code == 404
    finally:
        os.remove(secret)


def test_download_does_not_serve_uploads_of_a_running_job(client, monkeypatch):
    entered, release, _ = _block_inside_conversion(monkeypatch)
    with ThreadPoolExecutor(max_workers=1) as pool:
        running = pool.submit(_compress, app.test_client(), [("upload.png", _png(COLOURS[5]))])
        assert entered.wait(30)
        try:
            sources = [e for e in _temp_root_entries() if e.startswith("source_")]
            assert sources
            for source in sources:
                res = client.get(
                    "/api/download",
                    query_string={"folder": os.path.join(routes.TEMP_DIR, source), "file": "upload.png"},
                )
                assert res.status_code == 404
        finally:
            release.set()
        res = running.result(30)
    shutil.rmtree(res.get_json()["dest_folder"], ignore_errors=True)


def _block_inside_conversion(monkeypatch):
    """Pause the first conversion after its upload is on disk."""
    entered, release = threading.Event(), threading.Event()
    original = routes.use_case.execute

    def slow_execute(req):
        entered.set()
        assert release.wait(30)
        return original(req)

    monkeypatch.setattr(routes.use_case, "execute", slow_execute)
    return entered, release, original


BATCH = [("a.png", COLOURS[0]), ("b.png", COLOURS[1]), ("c.png", COLOURS[2])]


def _run_blocked_batch(monkeypatch, while_blocked):
    """Runs a 3-file conversion and calls ``while_blocked()`` while it is in progress."""
    entered, release, _ = _block_inside_conversion(monkeypatch)
    with ThreadPoolExecutor(max_workers=1) as pool:
        running = pool.submit(
            _compress, app.test_client(), [(name, _png(colour)) for name, colour in BATCH]
        )
        assert entered.wait(30)
        try:
            while_blocked()
        finally:
            release.set()
        return running.result(30)


def test_force_cleanup_keeps_a_running_job_and_it_completes_with_all_outputs(client, monkeypatch, forget_outputs):
    def force_cleanup():
        res = client.post("/api/force_cleanup")
        assert res.status_code == 200
        assert res.get_json()["status"] == "ok"

    res = _run_blocked_batch(monkeypatch, force_cleanup)

    assert res.status_code == 200, res.get_json()
    body = res.get_json()
    forget_outputs.append(body["dest_folder"])
    assert sorted(body["converted_files"]) == ["a.png", "b.png", "c.png"]
    for name, colour in BATCH:
        download = client.get("/api/download", query_string={"folder": body["dest_folder"], "file": name})
        assert download.status_code == 200
        assert _close(_centre_colour(download.data), colour)


def test_force_cleanup_still_deletes_finished_results(client, forget_outputs):
    res = _compress(client, [("done.png", _png(COLOURS[3]))])
    folder = res.get_json()["dest_folder"]
    forget_outputs.append(folder)
    listed = client.get("/api/container_files").get_json()["files"]
    assert any(f["filename"] == "done.png" and f["folder_path"] == folder for f in listed)

    assert client.post("/api/force_cleanup").status_code == 200

    assert not os.path.exists(folder)
    download = client.get("/api/download", query_string={"folder": folder, "file": "done.png"})
    assert download.status_code == 404
    listed = client.get("/api/container_files").get_json()["files"]
    assert not any(f["folder_path"] == folder for f in listed)


def test_age_cleanup_skips_folders_of_running_conversions(client, monkeypatch, forget_outputs):
    monkeypatch.setattr(routes.temp_folder_service.cleanup_service, "expiration_time", 1)

    def trigger_age_cleanup():
        time.sleep(1.5)  # the running job is now "older" than max_age
        # Any other user's request triggers the cleanup.
        client.get("/api/download", query_string={"folder": "x", "file": "y"})

    res = _run_blocked_batch(monkeypatch, trigger_age_cleanup)

    assert res.status_code == 200, res.get_json()
    body = res.get_json()
    forget_outputs.append(body["dest_folder"])
    assert sorted(body["converted_files"]) == ["a.png", "b.png", "c.png"]


def test_age_cleanup_still_deletes_expired_finished_results(client, monkeypatch, forget_outputs):
    res = _compress(client, [("old.png", _png(COLOURS[6]))])
    folder = res.get_json()["dest_folder"]
    forget_outputs.append(folder)
    old = time.time() - 120
    for path in (os.path.join(folder, "old.png"), folder):
        os.utime(path, (old, old))
    monkeypatch.setattr(routes.temp_folder_service.cleanup_service, "expiration_time", 60)

    client.get("/api/download", query_string={"folder": "x", "file": "y"})

    assert not os.path.exists(folder)


def test_download_counts_as_activity_for_age_cleanup(client, monkeypatch, forget_outputs):
    res = _compress(client, [("recent.png", _png(COLOURS[7]))])
    folder = res.get_json()["dest_folder"]
    forget_outputs.append(folder)
    old = time.time() - 120
    for path in (os.path.join(folder, "recent.png"), folder):
        os.utime(path, (old, old))
    # Downloaded just now, so it is no longer idle.
    routes.temp_folder_service.mark_activity(folder)
    monkeypatch.setattr(routes.temp_folder_service.cleanup_service, "expiration_time", 60)

    client.get("/api/download", query_string={"folder": "x", "file": "y"})

    assert os.path.isdir(folder)


def _open_fds():
    return len(os.listdir("/proc/self/fd"))


@pytest.mark.skipif(not os.path.isdir("/proc/self/fd"), reason="needs /proc")
@pytest.mark.parametrize("outcome", ["success", "no_output", "exception"])
def test_job_lock_is_released_when_the_job_ends(client, monkeypatch, forget_outputs, outcome):
    if outcome == "no_output":
        monkeypatch.setattr(
            routes.use_case, "execute",
            lambda req: CompressResult(processed_files=[], errors=["boom"]),
        )
    elif outcome == "exception":
        def explode(req):
            raise RuntimeError("converter crashed")
        monkeypatch.setattr(routes.use_case, "execute", explode)
    before_entries, before_fds = _temp_root_entries(), _open_fds()

    res = _compress(client, [("x.png", _png(COLOURS[0]))])

    assert _open_fds() == before_fds, "job folder lock leaked"
    if outcome == "success":
        assert res.status_code == 200
        folder = res.get_json()["dest_folder"]
        forget_outputs.append(folder)
        # Unlocked, so a forced cleanup can delete the finished result.
        assert client.post("/api/force_cleanup").status_code == 200
        assert not os.path.exists(folder)
    else:
        assert res.status_code == 500
        leftovers = {
            e for e in _temp_root_entries() - before_entries
            if e.startswith(("source_", "converted_"))
        }
        assert not leftovers


@pytest.mark.parametrize("names", [("photo.png", "photo.png"), ("фото.png", "картинка.png")])
def test_same_batch_files_with_colliding_names_are_all_converted(client, forget_outputs, names):
    res = _compress(client, [(names[0], _png(COLOURS[0])), (names[1], _png(COLOURS[1]))])
    assert res.status_code == 200, res.get_json()
    body = res.get_json()
    forget_outputs.append(body["dest_folder"])
    files = os.listdir(body["dest_folder"])
    assert len(files) == 2, f"expected two outputs, got {files}"
    colours = set()
    for name in files:
        with open(os.path.join(body["dest_folder"], name), "rb") as f:
            colours.add(_centre_colour(f.read()))
    assert colours == {COLOURS[0], COLOURS[1]}


def test_same_stem_different_extension_are_both_kept(client, forget_outputs):
    jpeg = io.BytesIO()
    Image.new("RGB", (20, 20), COLOURS[1]).save(jpeg, format="JPEG")
    res = _compress(client, [("photo.png", _png(COLOURS[0])), ("photo.jpg", jpeg.getvalue())], fmt="jpeg")
    assert res.status_code == 200, res.get_json()
    body = res.get_json()
    forget_outputs.append(body["dest_folder"])
    assert sorted(body["converted_files"]) == ["photo.jpg", "photo_1.jpg"]
