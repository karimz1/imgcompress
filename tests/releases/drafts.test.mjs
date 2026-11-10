import assert from 'node:assert/strict';
import test from 'node:test';
import { addIssueLinks, createDraft, formatReleaseNotes, isNewestStable, parseReleaseTag, previousStableRelease, githubRequest, releaseNotes } from '../../scripts/prepare-release.mjs';
import { imageTags, latestPromotion } from '../../scripts/docker-image-tags.mjs';

test('release tags support stable, RC, and historical four-part versions', () => {
  assert.deepEqual(parseReleaseTag('release_0.10.0-rc.1'), { version: '0.10.0-rc.1', prerelease: true });
  assert.equal(parseReleaseTag('release_0.2.7.2').prerelease, false);
  for (const tag of ['v0.10.0', 'release_1.0', 'release_1.0.0\n', 'release_1.0.0-']) {
    assert.throws(() => parseReleaseTag(tag));
  }
});

test('builds push only the version or nightly tag, never latest', () => {
  assert.deepEqual(imageTags({ owner: 'KarimZ1', tag: 'release_1.0.0-rc.1' }),
    { version: '1.0.0-rc.1', prerelease: true, tags: ['karimz1/imgcompress:1.0.0-rc.1', 'ghcr.io/karimz1/imgcompress:1.0.0-rc.1'] });
  assert.deepEqual(imageTags({ owner: 'karimz1', tag: 'release_1.0.0' }).tags,
    ['karimz1/imgcompress:1.0.0', 'ghcr.io/karimz1/imgcompress:1.0.0']);
  assert.ok(imageTags({ owner: 'karimz1' }).tags.every((tag) => tag.endsWith(':nightly')));
  assert.throws(() => imageTags({ owner: 'karimz1', tag: 'v1.0.0' }));
});

test('publishing moves latest for the newest stable only, never for RCs', () => {
  const stable = latestPromotion({ owner: 'karimz1', tag: 'release_1.0.0' });
  assert.equal(stable.latest, true);
  assert.deepEqual(stable.retags, [
    { from: 'karimz1/imgcompress:1.0.0', to: 'karimz1/imgcompress:latest' },
    { from: 'ghcr.io/karimz1/imgcompress:1.0.0', to: 'ghcr.io/karimz1/imgcompress:latest' },
  ]);
  assert.deepEqual(latestPromotion({ owner: 'karimz1', tag: 'release_1.0.0-rc.1' }).retags, []);
  // Marked as pre-release on GitHub even though the tag looks stable.
  assert.equal(latestPromotion({ owner: 'karimz1', tag: 'release_1.0.0', prerelease: true }).latest, false);
});

test('only the newest stable release moves latest, so backports and reruns cannot roll it back', () => {
  const releases = [
    { tag_name: 'release_0.10.0' },
    { tag_name: 'release_0.11.0-rc.1', prerelease: true },
    { tag_name: 'release_0.12.0', draft: true },
    { tag_name: 'release_0.9.1' },
  ];
  assert.equal(isNewestStable(releases, 'release_0.10.0'), true);
  assert.equal(isNewestStable(releases, 'release_0.9.1'), false);
  assert.equal(isNewestStable(releases, 'release_0.11.0-rc.1'), false);
  const backport = latestPromotion({ owner: 'karimz1', tag: 'release_0.9.1', releases });
  assert.equal(backport.latest, false);
  assert.deepEqual(backport.retags, []);
  const current = latestPromotion({ owner: 'karimz1', tag: 'release_0.10.0', releases });
  assert.equal(current.latest, true);
  assert.ok(current.retags.some((retag) => retag.to === 'karimz1/imgcompress:latest'));
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

const generated = [
  '<!-- Release notes generated using configuration in .github/release.yml at main -->',
  '',
  "## What's Changed",
  '### Features',
  '* Fit images to an exact output size by @karimz1 in https://github.com/karimz1/imgcompress/pull/908 (Closes [#906](https://github.com/karimz1/imgcompress/issues/906))',
  '### Bug Fixes',
  '* fix(footer): show the build version by @karimz1 in https://github.com/karimz1/imgcompress/pull/920',
  '### Security Patches',
  '* chore(docker): refresh 2 DHI base image digests by @imgcompress-chan in https://github.com/karimz1/imgcompress/pull/965',
  '### Dependencies',
  ...Array.from({ length: 7 }, (_, i) => `* chore(deps): bump lib${i} by @dependabot[bot] in https://github.com/karimz1/imgcompress/pull/${970 + i}`),
  '### Other Changes',
  '* feat: add SVG import by @karimz1 in https://github.com/karimz1/imgcompress/pull/938',
  '* docs: tidy the README by @karimz1 in https://github.com/karimz1/imgcompress/pull/940',
  '',
  '## New Contributors',
  '* @someone made their first contribution in https://github.com/karimz1/imgcompress/pull/799',
  '',
  '**Full Changelog**: https://github.com/karimz1/imgcompress/compare/release_0.9.0...release_1.0.0',
].join('\n');
const meta = { version: '1.0.0', prerelease: false, date: '2026-10-27', repository: 'karimz1/imgcompress' };

test('draft notes follow the v0.9.0 layout', () => {
  const body = formatReleaseNotes(generated, meta);
  const headings = body.split('\n').filter((line) => line.startsWith('#'));
  assert.deepEqual(headings, ['## v1.0.0 — 2026-10-27', '### Changelog', '#### Features', '#### Bug Fixes', '#### Other Changes',
    '#### Security Patches', '#### New Contributors', '### Setup & Updates', '### Pinned Version']);
  assert.match(body, /^- Fit images to an exact output size \[#908\]\(https:\/\/github\.com\/karimz1\/imgcompress\/pull\/908\) \(Closes \[#906\]/m);
  // A feat: prefix counts as a feature even without a label.
  assert.match(body, /#### Features\n\n- Fit images.*\n- feat: add SVG import \[#938\]/);
  assert.match(body, /^- \[chore\(docker\): refresh 2 DHI base image digests - #965\]\(https:\/\/github\.com\/karimz1\/imgcompress\/pull\/965\)$/m);
  assert.match(body, /- and 7 dependency updates, see the \[full changelog\]/);
  assert.match(body, /https:\/\/hub\.docker\.com\/r\/karimz1\/imgcompress\/tags/);
  assert.match(body, /\[Installation & Update Guide\]\(https:\/\/imgcompress\.karimzouine\.com\/docs\/installation\)/);
  assert.doesNotMatch(body, /karimzouine\.com\/installation/);
  assert.match(body, /```\nkarimz1\/imgcompress:1\.0\.0\n```/);
  assert.doesNotMatch(body, /<!--|What's Changed|release candidate|Pre-release/);
});

const RC_NOTICE = "> **Pre-release for testing.** This release candidate is for people who want to try what's coming in the next stable version early. I'm still testing it myself, so you may run into bugs. If you just want a stable app, keep using `karimz1/imgcompress:latest`. This RC doesn't change `latest`. Found a bug? Please [open an issue](https://github.com/karimz1/imgcompress/issues).";

test('RC drafts open with the pre-release notice for testers', () => {
  const body = formatReleaseNotes(generated, { ...meta, version: '1.0.0-rc.1', prerelease: true });
  assert.deepEqual(body.split('\n').slice(0, 4), ['## v1.0.0-rc.1 — 2026-10-27', '', RC_NOTICE, '']);
  assert.match(body, /karimz1\/imgcompress:1\.0\.0-rc\.1/);
});

test('a release without security changes has no security section', () => {
  const body = formatReleaseNotes('### Features\n* New thing by @karimz1 in https://github.com/karimz1/imgcompress/pull/1', meta);
  assert.doesNotMatch(body, /Security Patches/);
  assert.match(body, /- New thing \[#1\]/);
});

test('an existing reviewed draft is returned without changing it', async () => {
  const existing = { tag_name: 'release_0.10.0', draft: true, body: 'My reviewed wording' };
  const methods = [];
  const result = await createDraft({ repository: 'karimz1/imgcompress', tag: existing.tag_name, body: 'new text', request: async (route, options) => {
    methods.push(options?.method ?? 'GET');
    return [existing];
  } });
  assert.equal(result.body, existing.body);
  assert.deepEqual(methods, ['GET']);
});

test('new RC notes compare with the last stable release and the draft stays unpublished', async () => {
  const request = async (route, options) => {
    if (route.includes('/git/ref/')) return {};
    if (route.includes('/releases?')) return [{ tag_name: 'release_0.9.0' }, { tag_name: 'release_0.10.0-rc.1', prerelease: true }];
    if (route.includes('/compare/')) return { status: 'ahead' };
    if (route === 'graphql') return { data: { repository: { pullRequest: { closingIssuesReferences: { nodes: [], pageInfo: { hasNextPage: false } } } } } };
    if (route.endsWith('/generate-notes')) {
      assert.equal(options.body.previous_tag_name, 'release_0.9.0');
      return { body: generated };
    }
    return options.body;
  };
  const body = await releaseNotes({ repository: 'karimz1/imgcompress', tag: 'release_0.10.0-rc.2', request, now: new Date('2026-10-27T10:00:00Z') });
  assert.match(body, /^## v0\.10\.0-rc\.2 — 2026-10-27\n\n> \*\*Pre-release for testing\.\*\*/);
  const created = await createDraft({ repository: 'karimz1/imgcompress', tag: 'release_0.10.0-rc.2', body, request });
  assert.equal(created.draft, true);
  assert.equal(created.prerelease, true);
  assert.equal(created.make_latest, 'false');
  assert.equal(created.body, body);
});

test('a backport draft is not marked as the latest release', async () => {
  let created;
  await createDraft({ repository: 'karimz1/imgcompress', tag: 'release_0.9.2', body: '- Fix', request: async (route, options) => {
    if (route.includes('/releases?')) return [{ tag_name: 'release_0.10.0' }, { tag_name: 'release_0.9.1' }];
    created = options.body;
    return created;
  } });
  assert.equal(created.prerelease, false);
  assert.equal(created.make_latest, 'false');
});

test('first release omits the comparison base, empty notes and failed API calls fail', async () => {
  await releaseNotes({ repository: 'karimz1/imgcompress', tag: 'release_0.1.0', request: async (route, options) => {
    if (route.includes('/releases?')) return [];
    if (route.endsWith('/generate-notes')) {
      assert.equal('previous_tag_name' in options.body, false);
      return { body: 'First release' };
    }
    return {};
  } });
  await assert.rejects(() => createDraft({ repository: 'karimz1/imgcompress', tag: 'release_0.1.0', body: ' ', request: async () => [] }), /empty/);
  const request = githubRequest('test', async () => ({ ok: false, status: 403 }));
  await assert.rejects(() => request('repos/karimz1/imgcompress/releases'), /HTTP 403/);
});

test('the top entry of the tagged version leads the draft, dated or not', async () => {
  const notes = (header) => `${header}\n\n### Features\n\n- Hand-written editor note.\n\n\`\`\`\n## v0.0.1 — 2026-01-01\n\`\`\`\n\n## v0.9.0 — 2026-08-22\n\n- PDF quality presets.\n`;
  const request = async (route) => {
    if (route.includes('/releases?')) return [{ tag_name: 'release_0.9.0' }];
    if (route.includes('/compare/')) return { status: 'ahead' };
    if (route === 'graphql') return { data: { repository: { pullRequest: { closingIssuesReferences: { nodes: [], pageInfo: { hasNextPage: false } } } } } };
    if (route.endsWith('/generate-notes')) return { body: generated };
    return {};
  };
  for (const header of ['## v1.0.0 — DateNeedsToBeReplaced', '## v1.0.0 — 2026-10-26']) {
    for (const tag of ['release_1.0.0', 'release_1.0.0-rc.1']) {
      const body = await releaseNotes({ repository: 'karimz1/imgcompress', tag, request, pending: notes(header) });
      assert.match(body, /### Changelog\n\n#### Features\n\n- Hand-written editor note\.\n\n```\n## v0\.0\.1 — 2026-01-01\n```\n\n#### Bug Fixes/, `${header} / ${tag}`);
      assert.doesNotMatch(body, /Fit images to an exact output size|PDF quality presets/);
    }
  }
  // Another version on top, or only an older entry for it: GitHub's notes are used.
  for (const [tag, pending] of [['release_1.0.1', notes('## v1.0.0 — 2026-10-26')], ['release_0.9.0', notes('## v1.0.0 — 2026-10-26')]]) {
    const body = await releaseNotes({ repository: 'karimz1/imgcompress', tag, request, pending });
    assert.match(body, /#### Features\n\n- Fit images to an exact output size/);
    assert.doesNotMatch(body, /Hand-written/);
  }
});

test('hand-written sections merge with the generated ones, so no heading or PR shows up twice', async () => {
  const pending = [
    '## v1.0.0 — DateNeedsToBeReplaced', '',
    '### Features', '', '- Image editor.', '',
    '### Bug Fixes', '', '- Cleanup keeps running jobs.', '- Footer version [#920](https://github.com/karimz1/imgcompress/pull/920)', '',
    '### Security Patches', '',
    'This release also includes **security fixes** to keep `imgcompress` up to date with the latest CVE reports and security alerts from Docker Hub and GitHub.', '',
    '- [chore(docker): refresh 2 DHI base image digests - #965](https://github.com/karimz1/imgcompress/pull/965)',
    '- [chore(deps): bump next from 16.3.8 to 16.4.1 - #967](https://github.com/karimz1/imgcompress/pull/967)',
    '- More dependency updates for the frontend and Python packages.', '',
    'You can review the latest Docker image tags and related security information here:',
    'https://hub.docker.com/r/karimz1/imgcompress/tags', '',
    '## v0.9.0 — 2026-08-22', '', '- Old.', '',
  ].join('\n');
  const extra = generated.replace('### Bug Fixes\n', '### Bug Fixes\n* fix: keep EXIF orientation by @karimz1 in https://github.com/karimz1/imgcompress/pull/921\n')
    .replace('### Security Patches\n', '### Security Patches\n* chore(docker): refresh 1 DHI base image digest by @imgcompress-chan in https://github.com/karimz1/imgcompress/pull/939\n');
  const request = async (route) => {
    if (route.includes('/releases?')) return [{ tag_name: 'release_0.9.0' }];
    if (route.includes('/compare/')) return { status: 'ahead' };
    if (route === 'graphql') return { data: { repository: { pullRequest: { closingIssuesReferences: { nodes: [], pageInfo: { hasNextPage: false } } } } } };
    if (route.endsWith('/generate-notes')) return { body: extra };
    return {};
  };
  for (const tag of ['release_1.0.0-rc.1', 'release_1.0.0']) {
    const body = await releaseNotes({ repository: 'karimz1/imgcompress', tag, request, pending });
    const headings = body.split('\n').filter((line) => line.startsWith('#'));
    assert.deepEqual(headings.slice(1), ['### Changelog', '#### Features', '#### Bug Fixes', '#### Other Changes',
      '#### Security Patches', '#### New Contributors', '### Setup & Updates', '### Pinned Version'], tag);
    const count = (pattern) => body.split('\n').filter((line) => pattern.test(line)).length;
    for (const number of [920, 921, 939, 965, 967]) assert.equal(count(new RegExp(`/pull/${number}\\)`)), 1, `#${number} in ${tag}`);
    assert.equal(count(/security fixes/), 1);
    assert.equal(count(/^You can review the latest Docker image tags/), 1);
    assert.equal(count(/^https:\/\/hub\.docker\.com\/r\/karimz1\/imgcompress\/tags$/), 1);
    assert.match(body, /#### Bug Fixes\n\n- Cleanup keeps running jobs\.\n- Footer version \[#920\].*\n- fix: keep EXIF orientation \[#921\]/);
    assert.match(body, /#### Security Patches\n\nThis release also includes[^\n]*\n\n- \[chore\(docker\): refresh 2 DHI base image digests - #965\]/);
    // The hand-written line about dependency updates gets the changelog link instead of a second summary.
    assert.match(body, /pull\/967\)\n- \[chore\(docker\): refresh 1 DHI base image digest - #939\]\(.*\)\n- More dependency updates for the frontend and Python packages, see the \[full changelog\]\(https:\/\/github\.com\/karimz1\/imgcompress\/compare\/release_0\.9\.0\.\.\.release_1\.0\.0\)\.\n\nYou can review/);
    assert.doesNotMatch(body, /and 7 dependency updates|Old\./);
    assert.equal(body.includes('Pre-release for testing'), tag.includes('-rc'));
  }
});
