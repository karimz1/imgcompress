# App release notes

The tag-to-draft workflow creates the GitHub release text. Once a stable release
is published, **Sync published release notes** copies that approved text into
`frontend/public/release-notes.md` on `main`. It also runs when a published
release is edited, replaces the matching entry on retries, and preserves the
archive. Older maintenance releases are inserted below newer stable versions.

The workflow uses the repository's `GITHUB_TOKEN` with `contents: write` and
commits as `github-actions[bot]`. No additional secret is needed. The repository
must permit that token to push to `main`; if branch protection is added later,
the sync will need an allowed bot or a pull-request path. The automatic commit
does not trigger more workflows because it uses `GITHUB_TOKEN`.

The Docker release workflow overlays the same approved notes into the checkout
of the release tag before building. That is necessary because the tag was
created before the draft was reviewed. The tag itself is unchanged. The app
shows the first release entry as its installed version.

RC notes are included in their versioned images, but are not committed to the
stable archive on `main`. The footer and release-notes viewer recognize versions
such as `0.10.0-rc.1`. Once `0.10.0` is published, an RC installation can offer
the stable update. Stable users only check GitHub's latest stable release.

Edits after publication update the file on `main`; already-published Docker
images retain the notes from their build. Rerun the original deployment if the
image also needs the updated text. Both release-automation PRs must be merged
before creating the first tag that uses this flow.

Run `node --test tests/release-notes/*.test.mjs` with Node 24 to check the notes
sync, retries, archive ordering, and RC headers.
