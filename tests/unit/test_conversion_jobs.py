"""Background conversion jobs: POST /api/jobs, then poll GET /api/jobs/<id>.

The browser may leave (iPhone app switch, reload, proxy timeout) while a job
runs; it comes back with the job id and its secret token. Jobs of other users
must stay invisible: wrong token, missing token and unknown id look the same.
"""

import json
import os
import threading
import time
from io import BytesIO

import pytest
from flask import Flask
from PIL import Image

from backend.image_converter.application.dtos import CompressResult
from backend.image_converter.infrastructure import job_progress
from backend.image_converter.infrastructure.cleanup_service import CleanupService
from backend.image_converter.infrastructure.conversion_job_store import (
    INTERRUPTED_MESSAGE,
    ConversionJobStore,
)
from backend.image_converter.presentation.web.services.compression_service import CompressionService
from backend.image_converter.presentation.web.services.conversion_job_service import ConversionJobService
from backend.image_converter.presentation.web.services.temporary_folder_service import TemporaryFolderService


class _Logger:
    def __init__(self):
        self.lines = []

    def log(self, message, level="info"):
        self.lines.append(str(message))


class _ScriptedUseCase:
    """Writes one output per upload, reports tiles, and can wait or fail on cue."""

    def __init__(self):
        self.release = threading.Event()
        self.release.set()
        self.started = threading.Event()
        self.fail = False

    def execute(self, req):
        self.started.set()
        job_progress.report(files_done=0, tiles_done=10, tiles_total=36)
        assert self.release.wait(10)
        if self.fail:
            return CompressResult(processed_files=[], errors=["photo.png: model missing"])
        names = []
        for name in sorted(os.listdir(req.source_folder)):
            out = os.path.splitext(name)[0] + ".jpg"
            with open(os.path.join(req.dest_folder, out), "wb") as f:
                f.write(b"converted " + name.encode())
            names.append(out)
        return CompressResult(processed_files=names, errors=[])


def _png() -> bytes:
    buffer = BytesIO()
    Image.new("RGB", (4, 4), (200, 10, 10)).save(buffer, format="PNG")
    return buffer.getvalue()


@pytest.fixture
def setup(tmp_path, monkeypatch):
    from backend.image_converter.presentation.web import routes

    logger = _Logger()
    folders = TemporaryFolderService(str(tmp_path), 3600, logger)
    use_case = _ScriptedUseCase()
    compression = CompressionService(logger, use_case, folders)
    threads = []

    def start_thread(target):
        thread = threading.Thread(target=target, daemon=True)
        threads.append(thread)
        thread.start()

    jobs = ConversionJobService(logger, compression, ConversionJobStore(str(tmp_path)), start_thread=start_thread)
    monkeypatch.setattr(routes, "temp_folder_service", folders)
    monkeypatch.setattr(routes, "compression_service", compression)
    monkeypatch.setattr(routes, "conversion_jobs", jobs)
    monkeypatch.setattr(folders, "cleanup", lambda force=False: None)
    app = Flask(__name__)
    app.register_blueprint(routes.api_blueprint, url_prefix="/api")

    class Setup:
        client = app.test_client()

        def __init__(self):
            self.tmp_path = tmp_path
            self.logger = logger
            self.use_case = use_case

        def start(self, name="photo.png"):
            response = self.client.post(
                "/api/jobs",
                data={"files[]": (BytesIO(_png()), name), "format": "jpeg"},
                content_type="multipart/form-data",
            )
            return response

        def status(self, job_id, token):
            headers = {"X-Job-Token": token} if token is not None else {}
            return self.client.get(f"/api/jobs/{job_id}", headers=headers)

        def wait_done(self):
            for thread in threads:
                thread.join(10)

    return Setup()


def _started(setup, name="photo.png"):
    response = setup.start(name)
    assert response.status_code == 202, response.get_json()
    body = response.get_json()
    return body["id"], body["token"]


def test_When_JobStarts_Expect_202WithIdAndTokenRightAway(setup):
    setup.use_case.release.clear()
    response = setup.start()
    assert response.status_code == 202
    body = response.get_json()
    assert len(body["id"]) == 22 and len(body["token"]) >= 43
    assert body["status"] == "queued"
    assert response.headers["Location"].endswith(f"/api/jobs/{body['id']}")
    assert "token_sha256" not in body and "dest_folder" not in body
    setup.use_case.release.set()
    setup.wait_done()


def test_When_JobRuns_Expect_ProgressThenResultAndOwnDownloads(setup):
    setup.use_case.release.clear()
    job_id, token = _started(setup)
    assert setup.use_case.started.wait(5)
    deadline = time.time() + 5
    while time.time() < deadline:
        running = setup.status(job_id, token).get_json()
        if running["status"] == "running" and running["progress"].get("tiles_done") == 10:
            break
        time.sleep(0.05)
    assert running["status"] == "running"
    assert running["progress"]["tiles_total"] == 36
    assert running["progress"]["files_total"] == 1

    setup.use_case.release.set()
    setup.wait_done()
    done = setup.status(job_id, token).get_json()
    assert done["status"] == "done"
    assert done["result"]["converted_files"] == ["photo.jpg"]
    assert "dest_folder" not in done["result"]

    file = setup.client.get(f"/api/jobs/{job_id}/files/photo.jpg", headers={"X-Job-Token": token})
    assert file.status_code == 200 and file.data == b"converted photo.png"
    archive = setup.client.get(f"/api/jobs/{job_id}/zip", headers={"X-Job-Token": token})
    assert archive.status_code == 200 and archive.mimetype == "application/zip"


def test_When_ConversionFails_Expect_FailedWithMessage(setup):
    setup.use_case.fail = True
    job_id, token = _started(setup)
    setup.wait_done()
    state = setup.status(job_id, token).get_json()
    assert state["status"] == "failed"
    assert "model missing" in state["error"]
    leftovers = [n for n in os.listdir(setup.tmp_path) if n.startswith(("source_", "converted_"))]
    assert leftovers == []


def test_When_OptionsAreInvalid_Expect_400AndNoJob(setup):
    response = setup.client.post(
        "/api/jobs",
        data={"files[]": (BytesIO(_png()), "a.png"), "format": "pdf", "upscale": "2x"},
        content_type="multipart/form-data",
    )
    assert response.status_code == 400
    assert "upscaling" in response.get_json()["message"]
    assert not [n for n in os.listdir(setup.tmp_path) if n.startswith("job_")]


@pytest.mark.parametrize("job_id", ["A" * 22, "unknown", "..%2F..%2Fetc", "a" * 21 + "/", "%2e%2e"])
def test_When_IdIsUnknownOrMalformed_Expect_404(setup, job_id):
    assert setup.status(job_id, "whatever").status_code == 404


def test_When_PathTraversalIsTriedAsId_Expect_NoFileOutsideTheJob(setup):
    _, token = _started(setup)
    setup.wait_done()
    for path in ("/api/jobs/../download", "/api/jobs/..%2F..%2Fetc%2Fpasswd/zip", "/api/jobs/x/files/..%2F..%2Fstatus.json"):
        assert setup.client.get(path, headers={"X-Job-Token": token}).status_code in (400, 404)


def test_When_TokenIsMissingWrongOrFromAnotherJob_Expect_TheSame404(setup):
    job_a, token_a = _started(setup, "a.png")
    job_b, token_b = _started(setup, "b.png")
    setup.wait_done()
    unknown = setup.status("Z" * 22, token_a)
    answers = [
        setup.status(job_a, None),             # missing token
        setup.status(job_a, ""),               # empty token
        setup.status(job_a, "x" * 43),         # another user's guess
        setup.status(job_a, token_b),          # token of job B on job A
        setup.status(job_b, token_a),          # token of job A on job B
    ]
    for response in answers:
        assert response.status_code == 404
        assert response.get_json() == unknown.get_json()
    for path in (f"/api/jobs/{job_a}/files/a.jpg", f"/api/jobs/{job_a}/zip"):
        assert setup.client.get(path, headers={"X-Job-Token": token_b}).status_code == 404
        assert setup.client.get(path).status_code == 404
    # A token in the query string is ignored; it belongs in the header only.
    assert setup.client.get(f"/api/jobs/{job_a}?token={token_a}").status_code == 404
    assert setup.status(job_a, token_a).status_code == 200


def test_When_JobIsStored_Expect_OnlyTheTokenHashOnDiskAndNothingInLogs(setup):
    job_id, token = _started(setup)
    setup.wait_done()
    status_file = setup.tmp_path / f"job_{job_id}" / "status.json"
    raw = status_file.read_text()
    assert token not in raw
    assert len(json.loads(raw)["token_sha256"]) == 64
    assert not any(token in line for line in setup.logger.lines)


def test_When_WorkerDiedMidJob_Expect_FailedInsteadOfRunningForever(tmp_path):
    store = ConversionJobStore(str(tmp_path))
    job = store.create(progress={})
    job.update(status="running")
    from backend.image_converter.infrastructure import job_folder_lock

    job_folder_lock.release(job._lock_fd)  # what the kernel does when the process dies
    job._lock_fd = None
    state = store.read(job.job_id, job.token)
    assert state["status"] == "failed" and state["error"] == INTERRUPTED_MESSAGE


def test_When_JobIsRunning_Expect_CleanupKeepsItAndRemovesItLater(tmp_path):
    store = ConversionJobStore(str(tmp_path))
    job = store.create(progress={})
    cleanup = CleanupService(str(tmp_path), 0, _Logger())
    time.sleep(0.01)
    cleanup.cleanup_temp_folders(force=True)
    assert store.read(job.job_id, job.token) is not None
    job.finish("done", result={})
    old = time.time() - 10
    os.utime(tmp_path / f"job_{job.job_id}", (old, old))
    os.utime(tmp_path / f"job_{job.job_id}" / "status.json", (old, old))
    cleanup.cleanup_temp_folders()
    assert store.read(job.job_id, job.token) is None
    assert not os.listdir(tmp_path)


def test_When_FinishedJobIsPolled_Expect_ItsResultFolderStaysFresh(setup):
    job_id, token = _started(setup)
    setup.wait_done()
    (dest,) = [p for p in setup.tmp_path.iterdir() if p.name.startswith("converted_")]
    old = time.time() - 3000
    os.utime(dest, (old, old))
    assert setup.status(job_id, token).status_code == 200
    assert time.time() - dest.stat().st_mtime < 60


def test_When_JobFolderIsALinkToSomewhereElse_Expect_ItIsNeverReadOrTouched(tmp_path):
    temp_dir = tmp_path / "temp"
    temp_dir.mkdir()
    outside = tmp_path / "outside"
    outside.mkdir()
    store = ConversionJobStore(str(temp_dir))
    job = store.create()
    job.finish("done")
    # Someone swaps the job folder for a link to a folder outside the temp dir.
    os.rename(temp_dir / f"job_{job.job_id}" / "status.json", outside / "status.json")
    os.rmdir(temp_dir / f"job_{job.job_id}")
    os.symlink(outside, temp_dir / f"job_{job.job_id}")
    before = os.stat(outside).st_mtime_ns

    assert store.read(job.job_id, job.token) is None
    store.touch(job.job_id)
    assert os.stat(outside).st_mtime_ns == before


def test_When_ManyJobsRunAndArePolledAtOnce_Expect_EveryReadReturnsOnlyItsOwnCompleteState(tmp_path):
    store = ConversionJobStore(str(tmp_path))
    count = 24
    jobs = [None] * count
    created = threading.Barrier(count)
    problems = []

    def owner(index):
        job = store.create(owner=index)
        jobs[index] = job
        created.wait(10)
        for step in range(30):
            job.update(status="running", progress={"owner": index, "step": step})
        job.finish("done", result={"owner": index})

    def poller(index):
        while jobs[index] is None:
            time.sleep(0.001)
        job = jobs[index]
        other = jobs[(index + 1) % count]
        while True:
            state = store.read(job.job_id, job.token)
            # A torn or foreign status file would show up here as None or a wrong owner.
            if state is None or state.get("owner") != index or state["id"] != job.job_id:
                problems.append(f"job {index}: {state}")
                return
            if other is not None and store.read(job.job_id, other.token) is not None:
                problems.append(f"job {index}: readable with job {(index + 1) % count}'s token")
                return
            if state["status"] == "done":
                if state["result"] != {"owner": index}:
                    problems.append(f"job {index}: result {state['result']}")
                return

    threads = [threading.Thread(target=owner, args=(i,)) for i in range(count)]
    threads += [threading.Thread(target=poller, args=(i,)) for i in range(count)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(30)

    assert not any(thread.is_alive() for thread in threads)
    assert problems == []
    assert len({job.job_id for job in jobs}) == count
    assert len({job.token for job in jobs}) == count
