# Releasing

1. Tag the commit and push the tag:
   ```bash
   git tag release_0.10.0-rc.1   # stable: release_0.10.0
   git push origin release_0.10.0-rc.1
   ```
2. **Prepare release draft** creates a draft with the changes since the last stable release.
3. Review the draft under **Releases** and publish it.
4. Publishing builds the tagged commit for Docker Hub and GHCR:
   - RC: version tag only, e.g. `0.10.0-rc.1`
   - stable: version tag, plus `latest` unless a newer stable release exists
   - `main`: `nightly`

- Put `Closes #123` in PR descriptions so the ticket shows up in the notes.
- Label a PR `skip-release-notes` to leave it out.
- No draft? `make release-draft RELEASE_TAG=release_0.10.0-rc.1`
- Tests: `make release-tests` (Node 24)
