# Backend Config

`app.json` is the wire format. `loader.py` materializes it into a typed
`AppConfig` (a frozen value-object tree, see `app_config.py`). Feature code
reads `AppConfig` — never JSON strings, never `os.environ` — and the
composition root injects each typed section into the services that need it
via constructor arguments.

The loader is the *only* module that knows JSON key paths and env-var names.
It runs once at startup, validates everything, and either returns an
`AppConfig` or raises a single `ConfigError` listing every problem.

## Keys

| Key | Type | Bounds | Default | Purpose |
| --- | --- | --- | --- | --- |
| `temporary_storage.directory` | string | non-empty | `/tmp` | Root directory for uploaded, converted, diagnostic, and temporary crop preview files. |
| `temporary_storage.max_age_seconds` | integer | `>= 1` | `3600` | Maximum age for managed temporary conversion artifacts before scheduled cleanup may delete them. |
| `uploads.max_file_size_mebibytes` | integer | `>= 1` | `40960` | Flask upload limit, in mebibytes. `UploadsConfig.max_file_size_bytes` converts to bytes for Flask. |
| `web.host` | string | non-empty | `0.0.0.0` | Bind address for Flask dev and Granian production. |
| `web.port` | integer | `1..65535` | `5000` | Bind port for Flask dev and Granian production. |
| `web.workers` | integer or `"auto"` | integer `>= 1` | `auto` | Granian worker count. Loader materializes this as a `WebWorkerCount` value object; consumers call `resolve(fallback_when_auto=os.cpu_count() or 1)`. |
| `logging.backend_log_file` | string | non-empty | `/tmp/imgcompress-backend.log` | File used for backend diagnostics capture. |
| `crop_preview.max_retry_attempts` | integer | `>= 1` | `3` | Maximum backend decode attempts for crop preview bitmap generation. |
| `crop_preview.unsupported_input_extensions` | string array | non-empty dot-prefixed extensions | listed in JSON | Input extensions intentionally excluded from the crop preview flow. |
| `features.is_storage_management_enabled` | boolean | — | `true` | Enables storage management and backend diagnostics endpoints. |
| `features.is_logo_enabled` | boolean | — | `true` | Shows the app logo/mascot in supported frontend states. |
| `features.is_dev_mode_enabled` | boolean | — | `false` | Enables developer-only frontend tools exposed through runtime config. |
| `rembg.model_name` | string | non-empty | `u2net` | Background-removal model name. |

## Environment Overrides

Only operator-facing feature flags accept environment overrides at container
startup:

| Env var | JSON key | Mapping |
| --- | --- | --- |
| `DISABLE_LOGO` | `features.is_logo_enabled` | Inverted: truthy disables the logo. |
| `DISABLE_STORAGE_MANAGEMENT` | `features.is_storage_management_enabled` | Inverted: truthy disables storage management. |
| `DEV_MODE` | `features.is_dev_mode_enabled` | Direct: truthy enables developer mode. |

Accepted truthy values: `true`, `1`, `yes`, `on`. Accepted falsy values:
`false`, `0`, `no`, `off`. Empty strings fall back to JSON. Any other value
raises `ConfigError` during startup validation.

## Adding a new tunable

1. Add the key (with a real default value) to `app.json`.
2. Add a typed field on the appropriate `*Config` dataclass in `app_config.py`.
   If the value is enum-like or has invariants (range, normalization), model it
   as a domain value object first and use that as the field type.
3. Extend `_Reader` in `loader.py` to materialize the new field. Add the
   `reader.require_*` call to the section's constructor.
4. Document the key in this README.
5. Add tests in `tests/unit/test_settings.py` covering: happy path, missing
   key, wrong type, out-of-range, and (for int) bool-as-int rejection.
6. Pass the typed value from the composition root (`routes.py`, `server.py`,
   `bootstraper.py`) into the service that needs it. Never reach into
   `settings.get()` from inside a service.
