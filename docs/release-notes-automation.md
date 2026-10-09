# App release notes

The tag-to-draft workflow writes the GitHub release text. When a stable release
is published, **Sync published release notes** copies that approved text into
`frontend/public/release-notes.md` on `main`. It runs again when a published
release is edited and replaces the entry for that version, so retries never add
a duplicate. Older entries stay as they are; a backport is inserted below newer
stable versions.

The workflow uses the repository's `GITHUB_TOKEN` with `contents: write` and
commits as `github-actions[bot]`, no extra secret needed. Runs are queued, so a
publish and a quick edit don't race each other. The token must be allowed to push
to `main`; if branch protection is added later, the sync needs an allowed bot or
a PR instead. Commits made with `GITHUB_TOKEN` don't trigger other workflows, so
this does not start a nightly build.

The tag is created before the draft is reviewed, so the Docker release workflow
writes the same approved notes into its checkout of the tag before building. The
tag itself is not changed. The app treats the first entry as the installed
version.

RC notes go into the RC image only, never into the archive on `main`. The footer
understands versions like `0.10.0-rc.1`, and an RC install shows the update
notice once `0.10.0` is out. Stable installs only compare against GitHub's latest
stable release.

Editing a release later updates `main`, but images that were already pushed keep
the notes they were built with. Rerun the deployment if the image needs the new
text too.

Needs #914 merged first: without it, deployment still runs on tag pushes and the
image step here never runs.

`node --test tests/release-notes/*.test.mjs` (Node 24) covers the sync, retries,
archive order and RC headers.
