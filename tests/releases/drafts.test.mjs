import assert from 'node:assert/strict';
import test from 'node:test';
import { addIssueLinks, parseReleaseTag, prepareRelease, previousStableRelease, githubRequest } from '../../scripts/prepare-release.mjs';
import { imageTags } from '../../scripts/docker-image-tags.mjs';

test('release tags support stable, RC, and historical four-part versions', () => {
  assert.deepEqual(parseReleaseTag('release_0.10.0-rc.1'), { version: '0.10.0-rc.1', prerelease: true });
  assert.equal(parseReleaseTag('release_0.2.7.2').prerelease, false);
  for (const tag of ['v0.10.0', 'release_1.0', 'release_1.0.0\n', 'release_1.0.0-']) {
    assert.throws(() => parseReleaseTag(tag));
  }
});

test('RCs never update latest, even if the release was incorrectly marked stable', () => {
  assert.deepEqual(imageTags({ owner: 'KarimZ1', tag: 'release_0.10.0-rc.1' }).tags,
    ['karimz1/imgcompress:0.10.0-rc.1', 'ghcr.io/karimz1/imgcompress:0.10.0-rc.1']);
  assert.equal(imageTags({ owner: 'karimz1', tag: 'release_0.10.0', prerelease: true }).tags.length, 2);
  assert.equal(imageTags({ owner: 'karimz1', tag: 'release_0.10.0' }).tags.filter((tag) => tag.endsWith(':latest')).length, 2);
  assert.ok(imageTags({ owner: 'karimz1', ref: 'refs/heads/main' }).tags.every((tag) => tag.endsWith(':nightly')));
  assert.throws(() => imageTags({ owner: 'karimz1', ref: 'refs/tags/release_0.10.0' }));
});

test('comparison skips RCs, drafts, future versions, and unrelated histories', async () => {
  const releases = [
    { tag_name: 'release_0.10.0-rc.1', prerelease: true },
    { tag_name: 'release_0.11.0' },
    { tag_name: 'release_0.9.1', draft: true },
    { tag_name: 'release_0.9.0' },
    { tag_name: 'release_0.8.3' },
  ];
  const compared = [];
  const previous = await previousStableRelease(releases, 'release_0.10.0', 'karimz1/imgcompress', async (route) => {
    compared.push(route);
    return { status: route.includes('release_0.9.0') ? 'diverged' : 'ahead' };
  });
  assert.equal(previous, 'release_0.8.3');
  assert.equal(compared.length, 2);
});

test('linked tickets are added to PR bullets with paginated GraphQL results', async () => {
  const body = '* Better cropping by @karimz1 in https://github.com/karimz1/imgcompress/pull/90\n* No ticket in https://github.com/karimz1/imgcompress/pull/900\n**Full Changelog**: https://github.com/karimz1/imgcompress/compare/release_0.9.0...release_0.10.0';
  const result = await addIssueLinks(body, 'karimz1/imgcompress', async (route, { body }) => {
    const { number, cursor } = body.variables;
    return { data: { repository: { pullRequest: { closingIssuesReferences: {
      nodes: number === 90 ? [{ number: cursor ? 2 : 1, url: `https://github.com/karimz1/imgcompress/issues/${cursor ? 2 : 1}`, repository: { nameWithOwner: 'karimz1/imgcompress' } }] : [],
      pageInfo: { hasNextPage: number === 90 && !cursor, endCursor: 'next' },
    } } } } };
  });
  assert.match(result.split('\n')[0], /Closes \[#1\].*\[#2\]/);
  assert.equal(result.split('\n')[1], body.split('\n')[1]);
  assert.equal(result.split('\n')[2], body.split('\n')[2]);
});

test('an existing reviewed draft is returned without generating or changing notes', async () => {
  const existing = { tag_name: 'release_0.10.0', draft: true, body: 'My reviewed wording' };
  const routes = [];
  const result = await prepareRelease({ repository: 'karimz1/imgcompress', tag: existing.tag_name, request: async (route, options) => {
    routes.push(route);
    assert.equal(options, undefined);
    return route.includes('/releases?') ? [existing] : {};
  } });
  assert.equal(result.body, existing.body);
  assert.equal(routes.length, 2);
});

test('new RC draft uses the stable comparison and keeps the native changelog', async () => {
  let created;
  await prepareRelease({ repository: 'karimz1/imgcompress', tag: 'release_0.10.0-rc.2', request: async (route, options) => {
    if (route.includes('/git/ref/')) return {};
    if (route.includes('/releases?')) return [{ tag_name: 'release_0.9.0' }, { tag_name: 'release_0.10.0-rc.1', prerelease: true }];
    if (route.includes('/compare/')) return { status: 'ahead' };
    if (route.endsWith('/generate-notes')) {
      assert.equal(options.body.previous_tag_name, 'release_0.9.0');
      return { body: "## What's Changed\n* New feature\n\n## New Contributors\n* @someone\n\n**Full Changelog**: https://github.com/karimz1/imgcompress/compare/release_0.9.0...release_0.10.0-rc.2" };
    }
    created = options.body;
    return created;
  } });
  assert.equal(created.draft, true);
  assert.equal(created.prerelease, true);
  assert.equal(created.make_latest, 'false');
  assert.match(created.body, /Full Changelog/);
  assert.match(created.body, /New Contributors/);
  assert.match(created.body, /imgcompress:0.10.0-rc.2/);
});

test('first release omits the comparison base and failed API calls are surfaced', async () => {
  await prepareRelease({ repository: 'karimz1/imgcompress', tag: 'release_0.1.0', request: async (route, options) => {
    if (route.includes('/releases?')) return [];
    if (route.endsWith('/generate-notes')) {
      assert.equal('previous_tag_name' in options.body, false);
      return { body: 'First release' };
    }
    return {};
  } });
  const request = githubRequest('test', async () => ({ ok: false, status: 403 }));
  await assert.rejects(() => request('repos/karimz1/imgcompress/releases'), /HTTP 403/);
});
