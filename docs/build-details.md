# Identifying a build

Nightly images show the latest stable base version, a **Nightly** badge, build
date, and short source commit in the footer. Click the label for the precise
build time, source link, and build ID. **Copy details** includes those values in
a bug report. Release candidates show their own version with a candidate badge;
stable releases keep a quiet version label.

The metadata is generated as `frontend/public/build-info.json` during the Docker
frontend build. CI passes the commit resolved from the actual checkout, the
UTC build timestamp, the ref, and the release version. The date displayed in the
UI uses the user's locale and timezone. No network request to GitHub is needed
to identify the installed image. This works even if a tag such as `nightly` has
since moved to another build.

Local builds without CI arguments are labeled as local, and older images or dev
servers without the metadata file keep the existing footer version. To record
the source when building locally, pass `BUILD_COMMIT`, `BUILD_DATE`, and
`BUILD_REF` as Docker build arguments. The generated file is not committed.

Run `node --test tests/build-info/*.test.mjs` with Node 24 for the metadata checks.
The Playwright `buildDetails_Test.spec.ts` covers desktop/mobile layout, RCs,
source links, and the missing-file fallback.
