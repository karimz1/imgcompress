# Backend configuration (`app.json`)

`app.json` is the single source of truth for backend deployment configuration. Every value used at runtime is read from this file through the typed accessors in `settings.py`. Code never hardcodes operational values and never invents defaults — if a key is missing or malformed, `settings.validate_all()` raises `ConfigError` at startup so the process refuses to serve traffic.

## Layered overrides

A small set of operator-facing feature flags also accept an environment variable override at container start, so operators can flip behavior without rebuilding the image. The env var, when set, wins; otherwise the JSON value is used. All other keys are JSON-only.

| JSON key | Env override | Notes |
| --- | --- | --- |
| `features.show_logo` | `DISABLE_LOGO` | Env value is the inverse: `DISABLE_LOGO=true` ⇒ `show_logo=false`. |
| `features.storage_management_enabled` | `DISABLE_STORAGE_MANAGEMENT` | Inverse: `DISABLE_STORAGE_MANAGEMENT=true` disables the storage panel and its endpoints. |
| `features.dev_mode` | `DEV_MODE` | Enables the in-app developer panel for error-surface testing. Never enable in production. |

Accepted env-var truthy values: `true`, `1`, `yes`, `on` (case-insensitive). Accepted falsy values: `false`, `0`, `no`, `off`. An empty string falls back to `app.json`; any other value raises `ConfigError`.

## Keys

### Top-level

- **`temp_dir`** (string, required) — Directory the backend uses for upload spool files, compression output, and crop temp files. Must be writable. The cleanup scheduler operates inside this directory.
- **`temp_expiration_seconds`** (int ≥ 1, required) — How long a compression output folder lives before the background cleanup job removes it. Also the interval at which the cleanup job runs.
- **`max_upload_bytes`** (int ≥ 1024, required) — Flask `MAX_CONTENT_LENGTH`. Requests larger than this are rejected with HTTP 413.

### `web`

- **`web.host`** (string, required) — Bind address for granian and the Flask dev server. `0.0.0.0` listens on all interfaces (the only sensible value inside a container).
- **`web.port`** (int 1–65535, required) — Bind port.
- **`web.workers`** (int ≥ 1 or `"auto"`, required) — granian worker count. `"auto"` resolves to `os.cpu_count()`.

### `logging`

- **`logging.backend_log_file`** (string, required) — Path of the backend log file. The TeeStream writes here when stdout/stderr capture is enabled in the Python process.

### `crop_preview`

- **`crop_preview.max_attempts`** (int ≥ 1, required) — Number of decode attempts the crop preview service makes before returning a failure. Transient PSD/PIL decode failures retry with backoff; permanent failures (`UnidentifiedImageError`) short-circuit.
- **`crop_preview.unsupported_extensions`** (list of strings, required) — File extensions that the crop editor should reject before decoding because the preview pipeline cannot faithfully render them. Each extension must start with `.` and is normalized to lowercase.

### `storage`

- **`storage.bytes_per_megabyte`** (int ≥ 1, required) — Conversion factor used when the backend reports disk usage to the storage UI. Set to `1048576` (binary MiB, `1024 × 1024`) to match the values shown by `du`, `df`, and Docker's storage panels. Set to `1000000` if you want decimal megabytes. The frontend labels these as "MB" regardless; this key decides what "MB" means in the response.

### `features`

- **`features.storage_management_enabled`** (bool, required) — Master switch for the storage UI (`/storage_info`, `/container_files`, `/force_cleanup`, `/logs/backend`). When `false`, those endpoints return HTTP 403 and the frontend hides the storage drawer.
- **`features.show_logo`** (bool, required) — When `true`, the homepage and crop loading state render the mascot. When `false`, a text-only header is shown.
- **`features.dev_mode`** (bool, required) — When `true`, the floating developer panel renders so you can trigger synthetic API and runtime errors to test error surfaces. Always `false` in production.

### `rembg`

- **`rembg.model_name`** (string, required) — Name of the rembg model to use for background removal (e.g. `u2net`, `isnet-general-use`). Passed to `rembg.new_session()`.

## Adding a new tunable

1. Add the key (with a real value) to `app.json`.
2. Add a typed accessor in `settings.py` using `_require_str` / `_require_int` / `_require_bool` / `_require_int_or_auto` / `_require_str_list` with appropriate bounds.
3. Append the accessor to `_REQUIRED_GETTERS` so `validate_all()` checks it.
4. Inject the value at the composition root (constructor arg or function parameter) — never read `settings` from inside a service.
5. Document the key in this README.
6. Add unit-test cases in `tests/unit/test_settings.py` covering: happy path, missing key, wrong type, out-of-range, and bool-as-int rejection where applicable.

## Process-IPC env vars (not config)

The following env vars exist but are *not* deployment config — they coordinate between a launcher shell or parent process and the granian child:

- `IMGCOMPRESS_STDIO_CAPTURE_INSTALLED` — the parent process tells the child "I already installed the stdout tee, don't install it twice."
- `IMGCOMPRESS_PARENT_STDOUT_CAPTURE` — the parent process tells the child "I'm capturing your stdout, don't write the log file yourself."

These do not belong in `app.json`. They are part of the IPC contract, not user-facing configuration.
