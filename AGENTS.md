# AGENTS.md

This file is the single source of truth for AI coding agents working in this
repository. Do not add tool-specific instruction files unless there is a
confirmed platform requirement that cannot read `AGENTS.md`.

## Architecture

- Preserve separation of concerns.
- Keep code quality high.
- Use unit tests, integration tests, and existing E2E tests where relevant.
- Add a new E2E use case only if the UI behavior is user-visible and not already covered.
- Keep Flask routes as transport adapters only. They may read request data, call a service/use case, and translate the result to HTTP. They must not assemble documents, format diagnostics, spool uploads, implement retry logic, perform conversion/crop logic, or own business decisions.
- Put request orchestration and web-specific workflows under `backend/image_converter/presentation/web/services/`. Put reusable application behavior under `backend/image_converter/application/`. Keep pure image/domain logic out of Flask and React components.
- Keep the frontend dumb for backend-owned capabilities. The frontend should ask backend capability/config endpoints instead of hardcoding backend-supported formats or backend limits.
- Avoid hardcoded operational ceilings in feature code. Prefer streaming/temp files, backend configuration, or environment-driven settings when limits are genuinely needed.
- All non-secret backend deployment config lives in `backend/image_converter/config/app.json`. This is the baseline source of truth. Read it through the typed accessors in `backend/image_converter/config/settings.py` — never via `os.environ` from feature code, never with fallback defaults in code, never duplicated across files, never as a magic literal (even unit-conversion constants like bytes-per-megabyte live in the config so the value and its meaning are documented in one place). Every key in `app.json` must be documented in `backend/image_converter/config/README.md`. Frontend runtime flags are served by the backend route `/config/runtime.json`, which projects the relevant keys; there is no separate frontend config file to keep in sync.
- Layered overrides for operator-facing feature flags only. A short whitelist of flags accepts an environment variable override at container start so operators can flip behavior without rebuilding the image: `DISABLE_LOGO` (→ `features.show_logo`, inverted), `DISABLE_STORAGE_MANAGEMENT` (→ `features.storage_management_enabled`, inverted), `DEV_MODE` (→ `features.dev_mode`). The accessor is the only place that knows about the env var — feature code calls the accessor, not `os.environ`. Accepted truthy values: `true`, `1`, `yes`, `on` (case-insensitive); accepted falsy: `false`, `0`, `no`, `off`; empty string falls back to JSON. Anything else raises `ConfigError`. All other config keys (ports, workers, paths, limits, MiB factor, rembg model, etc.) are JSON-only — do not add env overrides for them.
- Composition-root pattern: each call site receives the value as a constructor argument or function parameter; never reach into `settings` from deep inside a service. The composition root (`routes.py` module load, plus `bootstraper.main` before `launch_web_prod`) calls `settings.validate_all()` so missing or malformed config fails fast at startup, not at request time.
- Adding a new tunable: (1) add the key to `app.json` with a real value, (2) add a typed accessor in `settings.py` using `_require_str` / `_require_int` / `_require_bool` / `_require_int_or_auto` with appropriate bounds, (3) append the accessor to `_REQUIRED_GETTERS`, (4) inject it at the composition root, (5) document the key (purpose, type, bounds, default) in `backend/image_converter/config/README.md`, (6) add unit-test cases in `tests/unit/test_settings.py` covering happy path, missing key, wrong type, out-of-range, and bool-as-int rejection for int keys. If you also expose an env override (only for operator-facing flags), add tests for truthy parsing, falsy parsing, empty-string fallback, and garbage rejection. The PR is not done until those tests exist and pass.
- Distinguish deployment config from process IPC. Variables like `IMGCOMPRESS_STDIO_CAPTURE_INSTALLED`, `IMGCOMPRESS_PARENT_STDOUT_CAPTURE`, and `IMGCOMPRESS_EXTERNAL_STDOUT_TEE` coordinate between a launcher shell or parent Python process and the child granian process; they stay as env vars because that *is* the mechanism. They do not belong in `app.json`. If you find yourself adding a new env var, ask whether it is process-IPC (env is correct), an operator-facing flag (whitelisted env override of a JSON key is correct), or general deployment config (`app.json` only is correct) before writing it.
- Preserve existing public/API contracts unless there is a clear migration reason. When renaming endpoints or concepts, update tests and user-facing diagnostics together.
- Keep diagnostics downloadable and useful, but build diagnostic content in services, not routes or UI event handlers.
- Format support is backend-owned and dynamic. Treat Pillow's registered decoders, plus deliberate custom pipelines such as PDF/PSD/HEIF where configured, as the source of truth. Do not hardcode short format allowlists in the frontend or crop UI.
- Docker images should stay lean and secure. Add native/system packages only when a specific supported format needs them to work reliably in the container; otherwise prefer the existing Pillow/plugin capability detection.

## Security

- Keep runtime feature flags secure by default. Debug or developer-only UI must
  be disabled unless explicitly enabled by environment/runtime config.
- Do not commit secrets, API keys, credentials, private tokens, or local machine
  paths.
- Treat uploaded files and filenames as untrusted input. Use temp files,
  framework-safe response helpers, path validation, and backend-owned format
  detection.
- Do not weaken Docker, dependency, or CI security settings to make a test pass.

## Testing

- Prefer running tests and local app scripts in the devcontainer/Docker environment. That is the safe path because the scripts assume container paths, native packages, and `/venv`.
- `./runUnitTests.sh`, `./runIntegrationTests.sh`, `./runStartLocalBackend.sh`, `./runStartLocalFrontend.sh`, and `./run-e2e.sh` assume the devcontainer environment. Outside the devcontainer they can fail even when the code is fine.
- In the devcontainer, run backend unit tests with `./runUnitTests.sh`.
- In the devcontainer, run backend integration tests with `./runIntegrationTests.sh`.
- In the devcontainer, E2E tests need three running processes: `./runStartLocalBackend.sh`, `./runStartLocalFrontend.sh`, then `./run-e2e.sh`.
- Production image smoke test: `PORT_HOST=8080 DISABLE_LOGO=false DISABLE_STORAGE_MANAGEMENT=true ./runLocalDockerBuildTester.sh`, then open `http://localhost:8080`. `DISABLE_LOGO`, `DISABLE_STORAGE_MANAGEMENT`, and `DEV_MODE` are operator overrides of the matching `features.*` keys in `app.json`; values not listed there are JSON-only (rebuild or mount a customized `app.json` to change them).
- Full CI simulation: prefer `./simulateCiTests.sh`. It builds the devcontainer, runs unit and integration tests in Docker, builds the app image, starts it, and runs E2E against `PLAYWRIGHT_BASE_URL=http://localhost:5000`.
- If running the CI stages manually, use the same Docker commands encoded in `./simulateCiTests.sh` instead of inventing variants.
- Dependabot lockfile failures are usually invalid YAML from merged lockfile edits. Do not hand-edit `frontend/pnpm-lock.yaml`; regenerate it from `frontend/` with the repo's configured pnpm version, then commit the regenerated lockfile.
- For frontend dependency install issues, respect `frontend/pnpm-workspace.yaml` approved builds. `sharp` is needed for E2E image inspection, and `unrs-resolver` is used by the Next/ESLint TypeScript import resolver tooling.

## Code Style

- Do not add code comments unless they are truly necessary to explain non-obvious behavior.
- Prefer self-explanatory names, small functions, and clear structure over comments.
- Follow SRP, clean code, and DDD principles.
- Keep domain logic separated from UI, infrastructure, and framework-specific code.
- Do not mix unrelated concerns in the same component, service, or module.
- Refactor only where it improves clarity or is needed for the requested fix.

## Project Context

This is an image compression/conversion web app built with Next.js/React on the frontend and a Python/Flask backend for image processing. Users can upload images, prepare crop bitmaps, convert/compress them, and download the result.

The app targets 70+ input formats through Pillow-supported decoders and explicit backend pipelines for formats that need specialized handling. Background removal is available where the selected output pipeline supports it.

The mascot/logo is part of the app branding and appears on the homepage, crop editor loading state, and conversion splash/loading screens. It should feel persistent and stable across UI transitions.
