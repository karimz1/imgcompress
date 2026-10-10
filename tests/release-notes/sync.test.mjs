import assert from 'node:assert/strict';
import test from 'node:test';
import { releaseEntry, upsertReleaseNotes } from '../../scripts/sync-release-notes.mjs';
import { extractCurrentVersion } from '../../frontend/src/lib/release-version.ts';

const release = {
  tag_name: 'release_0.10.0', draft: false, prerelease: false,
  published_at: '2026-10-09T12:00:00Z',
  body: "## What's Changed\n* Better cropping [#906](https://github.com/karimz1/imgcompress/issues/906)\n\n**Full Changelog**: https://github.com/karimz1/imgcompress/compare/release_0.9.0...release_0.10.0",
};
const archive = '## v0.9.0 — 2026-08-22\n\n- PDF quality presets.\n\n## v0.8.3 — 2026-07-01\n\n- Mobile crop editor.\n';

test('approved notes are prepended with publication date and nested headings', () => {
  const result = upsertReleaseNotes(archive, release);
  assert.ok(result.startsWith('## v0.10.0 — 2026-10-09\n'));
  assert.match(result, /### What's Changed/);
  assert.ok(result.endsWith(archive));
  assert.match(result, /Full Changelog/);
  assert.equal(extractCurrentVersion(result), '0.10.0');
});

test('retries and edited release text replace one entry and keep the archive', () => {
  const first = upsertReleaseNotes(archive, release);
  assert.equal(upsertReleaseNotes(first, release), first);
  const edited = upsertReleaseNotes(first, { ...release, body: '- Reviewed wording' });
  assert.equal([...edited.matchAll(/^## v0\.10\.0 /gm)].length, 1);
  assert.match(edited, /Reviewed wording/);
  assert.doesNotMatch(edited, /Better cropping/);
  assert.ok(edited.endsWith(archive));
});

test('a release header inside a code example stays in its own entry on retries', () => {
  const example = '```markdown\n## v99.0.0 — 2026-01-01\n\nExample, not a release.\n```';
  const reviewed = { ...release, body: '- Change\n\n' + example };
  const first = upsertReleaseNotes(archive, reviewed);
  assert.equal(upsertReleaseNotes(first, reviewed), first);
  const edited = upsertReleaseNotes(first, { ...release, body: '- Edited notes' });
  assert.doesNotMatch(edited, /99\.0\.0|Example, not a release/);
  assert.ok(edited.endsWith(archive));
});

test('RCs stay off main but identify their version in the released image', () => {
  const rc = { ...release, tag_name: 'release_0.10.0-rc.1', prerelease: true };
  assert.equal(upsertReleaseNotes(archive, rc), archive);
  assert.equal(upsertReleaseNotes(archive, { ...rc, prerelease: false }), archive);
  const image = upsertReleaseNotes(archive, rc, { includePrerelease: true, promote: true });
  assert.equal(extractCurrentVersion(image), '0.10.0-rc.1');
  assert.ok(image.endsWith(archive));
});

test('publishing an old maintenance release leaves the newest stable entry first', () => {
  const main = upsertReleaseNotes(archive, release);
  const backport = { ...release, tag_name: 'release_0.9.1', body: '- Maintenance fix' };
  assert.equal(extractCurrentVersion(upsertReleaseNotes(main, backport)), '0.10.0');
  assert.equal(extractCurrentVersion(upsertReleaseNotes(main, backport, { includePrerelease: true, promote: true })), '0.9.1');
});

test('legacy headers are not duplicated and fenced Markdown stays intact', () => {
  const body = '## v0.10.0 — 2026-10-01\r\n\r\n### Features\r\n- Change\r\n\r\n```markdown\r\n## Example heading\r\n```';
  const result = releaseEntry({ ...release, body }).markdown;
  assert.equal([...result.matchAll(/^## v0\.10\.0 /gm)].length, 1);
  assert.match(result, /#### Features/);
  assert.match(result, /```markdown\n## Example heading\n```/);
});

test('GitHub\'s generator comment is not copied into the app notes', () => {
  const body = '<!-- Release notes generated using configuration in .github/release.yml at main -->\n\n## What\'s Changed\n* Fix';
  const result = releaseEntry({ ...release, body }).markdown;
  assert.doesNotMatch(result, /<!--/);
  assert.ok(result.startsWith('## v0.10.0 — 2026-10-09\n\n### What\'s Changed\n* Fix'));
});

test('drafts, empty notes, invalid tags and dates fail before changing the file', () => {
  for (const override of [{ draft: true }, { published_at: null }, { published_at: 'invalid' }, { body: '' }, { tag_name: 'release_bad' }]) {
    assert.throws(() => upsertReleaseNotes(archive, { ...release, ...override }));
  }
});

test('the app uses the first release header and retains historical versions', () => {
  assert.equal(extractCurrentVersion('### v8.0.0 — 2026-10-09\n\n' + archive), '0.9.0');
  assert.equal(extractCurrentVersion('## 0.2.7.2 — 2025-12-20\n- Old patch'), '0.2.7.2');
  assert.equal(extractCurrentVersion('No release entries'), null);
});
