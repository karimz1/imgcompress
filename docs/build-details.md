# Identifying a build

- The footer shows the version. Nightly images add a **Nightly** badge, build date and short commit; RCs get a candidate badge.
- Click the label for build time, source link and build ID. **Copy details** puts them into a bug report.
- `frontend/public/build-info.json` is generated during the Docker build from the CI build args (`BUILD_COMMIT`, `BUILD_DATE`, `BUILD_REF`, `BUILD_VERSION`, `BUILD_PRERELEASE`). It is not committed.
- Builds without these args are labelled local. Don't pass `BUILD_COMMIT` locally, it marks the build as nightly.
- Tests: `node --test tests/build-info/*.test.mjs`
