import assert from 'node:assert/strict';
import test from 'node:test';
import { createBuildInfo } from '../../frontend/scripts/write-build-info.mjs';
import { parseBuildInfo } from '../../frontend/src/lib/build-info.ts';

const input = { markdown: '## v0.9.0 — 2026-08-22\n- Stable release', commit: '9db1e75049562d315e06eec95252c0e515b8c52a', date: '2026-10-09T11:00:00Z', ref: 'refs/heads/main' };

test('nightly records the stable base, actual source, and an immutable build ID', () => {
  const info = createBuildInfo(input);
  assert.equal(info.version, '0.9.0');
  assert.equal(info.channel, 'nightly');
  assert.equal(info.commit, input.commit);
  assert.equal(info.builtAt, input.date.replace('Z', '.000Z'));
  assert.equal(info.buildId, '0.9.0-nightly.20261009110000+9db1e75');
  assert.deepEqual(parseBuildInfo(info), info);
});

test('a later nightly and a different commit produce distinct identities', () => {
  const first = createBuildInfo(input);
  assert.notEqual(createBuildInfo({ ...input, date: '2026-10-09T12:00:00Z' }).buildId, first.buildId);
  assert.notEqual(createBuildInfo({ ...input, commit: 'abcdef0123456789012345678901234567890123' }).buildId, first.buildId);
});

test('release and RC metadata come from the checkout tag, not stale notes', () => {
  assert.equal(createBuildInfo({ ...input, ref: 'release_0.10.0' }).channel, 'stable');
  const rc = createBuildInfo({ ...input, ref: 'release_0.10.0-rc.1' });
  assert.equal(rc.version, '0.10.0-rc.1');
  assert.equal(rc.channel, 'rc');
  assert.equal(createBuildInfo({ ...input, ref: 'release_0.10.0', prerelease: true }).channel, 'rc');
});

test('local images get a build timestamp without pretending to be a nightly', () => {
  const info = createBuildInfo({ markdown: input.markdown, now: new Date(input.date) });
  assert.equal(info.channel, 'local');
  assert.equal(info.commit, null);
});

test('invalid metadata fails safely and a missing file can fall back to the old footer', () => {
  assert.throws(() => createBuildInfo({ ...input, commit: 'unknown' }));
  assert.throws(() => createBuildInfo({ ...input, date: 'bad date' }));
  assert.equal(parseBuildInfo(null), null);
  assert.equal(parseBuildInfo({ ...createBuildInfo(input), commit: 'javascript:bad' }), null);
  assert.equal(parseBuildInfo({ ...createBuildInfo(input), builtAt: 'invalid' }), null);
});
