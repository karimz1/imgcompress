import urllib.request
import sys


BASE_URL = "http://localhost:5000"


def _get(url: str):
    try:
        with urllib.request.urlopen(url, timeout=5) as response:
            return response.status, response.headers, response.read(512)
    except Exception as exc:
        raise RuntimeError(f"{url} failed: {exc}") from exc


def check_health():
    backend_status, _, _ = _get(f"{BASE_URL}/api/health/backend")
    if backend_status != 200:
        raise RuntimeError(f"Backend health failed with status {backend_status}.")

    frontend_status, frontend_headers, frontend_body = _get(f"{BASE_URL}/")
    frontend_content_type = frontend_headers.get("Content-Type", "")
    if frontend_status != 200 or b"<html" not in frontend_body.lower():
        raise RuntimeError(
            "Frontend health failed "
            f"(status={frontend_status}, content-type={frontend_content_type!r})."
        )


if __name__ == "__main__":
    try:
        check_health()
    except Exception as exc:
        print(f"Healthcheck failed: {exc}")
        sys.exit(1)

    print("Healthcheck passed.")
    sys.exit(0)
