Keep your response concise. Do not write long explanations or token-heavy summaries.

After making changes, only tell me:
1. Root cause
2. Files changed
3. Tests run
4. Whether all tests pass

Also follow the repo’s AGENTS.md instructions.

Act as a senior developer:
- Preserve separation of concerns.
- Keep code quality high.
- Use unit tests, integration tests, and existing E2E tests where relevant.
- Add a new E2E use case only if the UI behavior is user-visible and not already covered.
- Keep Flask routes as transport adapters only. They may read request data, call a service/use case, and translate the result to HTTP. They must not assemble documents, format diagnostics, spool uploads, implement retry logic, perform conversion/crop logic, or own business decisions.
- Put request orchestration and web-specific workflows under `backend/image_converter/presentation/web/services/`. Put reusable application behavior under `backend/image_converter/application/`. Keep pure image/domain logic out of Flask and React components.
- Keep the frontend dumb for backend-owned capabilities. The frontend should ask backend capability/config endpoints instead of hardcoding backend-supported formats or backend limits.
- Avoid hardcoded operational ceilings in feature code. Prefer streaming/temp files, backend configuration, or environment-driven settings when limits are genuinely needed.
- Preserve existing public/API contracts unless there is a clear migration reason. When renaming endpoints or concepts, update tests and user-facing diagnostics together.
- Keep diagnostics downloadable and useful, but build diagnostic content in services, not routes or UI event handlers.
- Format support is backend-owned and dynamic. Treat Pillow's registered decoders, plus deliberate custom pipelines such as PDF/PSD/HEIF where configured, as the source of truth. Do not hardcode short format allowlists in the frontend or crop UI.
- Docker images should stay lean and secure. Add native/system packages only when a specific supported format needs them to work reliably in the container; otherwise prefer the existing Pillow/plugin capability detection.

Testing workflow:
- Prefer running tests and local app scripts in the devcontainer/Docker environment. That is the safe path because the scripts assume container paths, native packages, and `/venv`.
- `./runUnitTests.sh`, `./runIntegrationTests.sh`, `./runStartLocalBackend.sh`, `./runStartLocalFrontend.sh`, and `./run-e2e.sh` assume the devcontainer environment. Outside the devcontainer they can fail even when the code is fine.
- In the devcontainer, run backend unit tests with `./runUnitTests.sh`.
- In the devcontainer, run backend integration tests with `./runIntegrationTests.sh`.
- In the devcontainer, E2E tests need three running processes: `./runStartLocalBackend.sh`, `./runStartLocalFrontend.sh`, then `./run-e2e.sh`.
- Production image smoke test: `PORT_HOST=8080 DISABLE_LOGO=false DISABLE_STORAGE_MANAGEMENT=true ./runLocalDockerBuildTester.sh`, then open `http://localhost:8080`.
- Full CI simulation: prefer `./simulateCiTests.sh`. It builds the devcontainer, runs unit and integration tests in Docker, builds the app image, starts it, and runs E2E against `PLAYWRIGHT_BASE_URL=http://localhost:5000`.
- If running the CI stages manually, use the same Docker commands encoded in `./simulateCiTests.sh` instead of inventing variants.
- Dependabot lockfile failures are usually invalid YAML from merged lockfile edits. Do not hand-edit `frontend/pnpm-lock.yaml`; regenerate it from `frontend/` with the repo's configured pnpm version, then commit the regenerated lockfile.
- For frontend dependency install issues, respect `frontend/pnpm-workspace.yaml` approved builds. `sharp` is needed for E2E image inspection, and `unrs-resolver` is used by the Next/ESLint TypeScript import resolver tooling.

Code style requirements:
- Do not add code comments unless they are truly necessary to explain non-obvious behavior.
- Prefer self-explanatory names, small functions, and clear structure over comments.
- Follow SRP, clean code, and DDD principles.
- Keep domain logic separated from UI, infrastructure, and framework-specific code.
- Do not mix unrelated concerns in the same component, service, or module.
- Refactor only where it improves clarity or is needed for the requested fix.

Project context:
This is an image compression/conversion web app built with Next.js/React on the frontend and a Python/Flask backend for image processing. Users can upload images, prepare crop bitmaps, convert/compress them, and download the result.

The app targets 70+ input formats through Pillow-supported decoders and explicit backend pipelines for formats that need specialized handling. Background removal is available where the selected output pipeline supports it.

The mascot/logo is part of the app branding and appears on the homepage, crop editor loading state, and conversion splash/loading screens. It should feel persistent and stable across UI transitions.
