"""One rembg session per process and model, shared by all requests.

Loading the model costs hundreds of MB and seconds of CPU, so creating it per
image would multiply both by the number of parallel users. ONNX Runtime
sessions are safe to run from several threads; only creation needs the lock.
"""

import threading

_sessions: dict[str, object] = {}
_lock = threading.Lock()


def get_rembg_session(model_name: str):
    with _lock:
        session = _sessions.get(model_name)
        if session is None:
            from rembg import new_session

            session = new_session(model_name)
            _sessions[model_name] = session
        return session


def clear_rembg_sessions() -> None:
    """Drops cached sessions (tests swap the rembg module)."""
    with _lock:
        _sessions.clear()
