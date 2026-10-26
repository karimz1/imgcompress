import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function parseReleaseTag(tag) {
  const match = /^release_(\d+\.\d+\.\d+(?:\.\d+)?)(-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/.exec(tag);
  if (!match || tag.length > 128) throw new Error(`Invalid release tag: ${tag}`);
  return { version: `${match[1]}${match[2] || ''}`, prerelease: Boolean(match[2]) };
}

function compareVersions(a, b) {
  const left = a.split('-')[0].split('.').map(Number);
  const right = b.split('-')[0].split('.').map(Number);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const difference = (left[i] || 0) - (right[i] || 0);
    if (difference) return difference;
  }
  return 0;
}

export function githubRequest(token, fetcher = fetch) {
  if (!token) throw new Error('GH_TOKEN is required');
  return async (route, { method = 'GET', body } = {}) => {
    const response = await fetcher(`https://api.github.com/${route}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) throw new Error(`GitHub ${method} ${route}: HTTP ${response.status}`);
    return response.json();
  };
}

export async function listReleases(repository, request) {
  const releases = [];
  for (let page = 1; ; page++) {
    const batch = await request(`repos/${repository}/releases?per_page=100&page=${page}`);
    releases.push(...batch);
    if (batch.length < 100) break;
  }
  return releases;
}

// Backports and reruns of older releases must not move `latest` back.
export function isNewestStable(releases, tag) {
  const current = parseReleaseTag(tag);
  if (current.prerelease) return false;
  return releases.every((release) => {
    if (release.draft || release.prerelease || release.tag_name === tag) return true;
    try {
      const parsed = parseReleaseTag(release.tag_name);
      return parsed.prerelease || compareVersions(parsed.version, current.version) <= 0;
    } catch {
      return true;
    }
  });
}

export async function previousStableRelease(releases, tag, repository, request) {
  const current = parseReleaseTag(tag);
  const candidates = releases.filter((release) => {
    if (release.draft || release.prerelease) return false;
    try {
      const parsed = parseReleaseTag(release.tag_name);
      return !parsed.prerelease && compareVersions(parsed.version, current.version) < 0;
    } catch {
      return false;
    }
  }).sort((a, b) => compareVersions(parseReleaseTag(b.tag_name).version, parseReleaseTag(a.tag_name).version));

  // Backports need the previous release on their own history, not a newer tag
  // from another maintenance branch.
  for (const release of candidates) {
    const comparison = await request(`repos/${repository}/compare/${encodeURIComponent(release.tag_name)}...${encodeURIComponent(tag)}`);
    if (['ahead', 'identical'].includes(comparison.status)) return release.tag_name;
  }
  return undefined;
}

export async function addIssueLinks(body, repository, request) {
  const prefix = `https://github.com/${repository}/pull/`;
  const numbers = [...new Set([...body.matchAll(/https:\/\/github\.com\/[^\s/]+\/[^\s/]+\/pull\/(\d+)\b/g)]
    .filter((match) => match[0].startsWith(prefix)).map((match) => Number(match[1])))];
  const [owner, name] = repository.split('/');
  const issues = new Map();
  for (const number of numbers) {
    const links = [];
    let cursor = null;
    do {
      const result = await request('graphql', {
        method: 'POST',
        body: {
          query: `query($owner: String!, $name: String!, $number: Int!, $cursor: String) {
            repository(owner: $owner, name: $name) {
              pullRequest(number: $number) {
                closingIssuesReferences(first: 100, after: $cursor) {
                  nodes { number url repository { nameWithOwner } }
                  pageInfo { hasNextPage endCursor }
                }
              }
            }
          }`,
          variables: { owner, name, number, cursor },
        },
      });
      if (result.errors?.length) throw new Error(`Cannot read linked issues for PR #${number}`);
      const connection = result.data?.repository?.pullRequest?.closingIssuesReferences;
      if (!connection) throw new Error(`Cannot read PR #${number}`);
      links.push(...connection.nodes.map((issue) => {
        const label = issue.repository.nameWithOwner === repository
          ? `#${issue.number}` : `${issue.repository.nameWithOwner}#${issue.number}`;
        return `[${label}](${issue.url})`;
      }));
      cursor = connection.pageInfo.hasNextPage ? connection.pageInfo.endCursor : null;
    } while (cursor);
    if (links.length) issues.set(number, [...new Set(links)].join(', '));
  }
  return body.split('\n').map((line) => {
    // Only annotate change bullets, leaving contributor and comparison links alone.
    if (!/^\s*[-*] /.test(line)) return line;
    const number = numbers.find((value) => new RegExp(`${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${value}\\b`).test(line));
    return issues.has(number) ? `${line} (Closes ${issues.get(number)})` : line;
  }).join('\n');
}

const PULL_LINE = /^\s*[-*]\s+(.+?)\s+by\s+@[\w.-]+(?:\[bot\])?\s+in\s+(https:\/\/github\.com\/[^\s/]+\/[^\s/]+\/pull\/(\d+))(?:\s+\(Closes (.+)\))?\s*$/;
const SECURITY_TITLE = /^(?:chore|fix|build)\((?:docker|security)\)|^fix\(deps\)|\bCVE-\d{4}-\d+/i;
const DEPENDENCY_TITLE = /^(?:chore|build)\((?:deps|deps-dev)\)|^bump /i;

// Sorts GitHub's generated bullets into the sections of earlier releases
// (see v0.9.0). Labels decide first, conventional commit prefixes second.
function sectionFor(category, title) {
  if (category === 'Security Patches' || SECURITY_TITLE.test(title)) return 'security';
  if (category === 'Dependencies' || DEPENDENCY_TITLE.test(title)) return 'dependencies';
  if (category === 'Bug Fixes' || /^fix(?:\(|:)/i.test(title)) return 'fixes';
  if (category === 'Features' || /^feat(?:\(|:)/i.test(title)) return 'features';
  return 'other';
}

// Notes written by hand in frontend/public/release-notes.md before tagging,
// under a "## v1.0.0 — DateNeedsToBeReplaced" header. RCs of 1.0.0 use them too.
export function pendingEntry(markdown, version) {
  const escaped = version.split('-')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((line) => new RegExp(`^##\\s+v?${escaped}\\s+[—-]\\s+DateNeedsToBeReplaced\\s*$`).test(line));
  if (start < 0) return '';
  const end = lines.findIndex((line, index) => index > start && /^##\s/.test(line));
  return lines.slice(start + 1, end < 0 ? undefined : end).join('\n').trim();
}

function nestUnder(markdown, level) {
  const levels = [...markdown.matchAll(/^(#{1,6})\s/gm)].map((match) => match[1].length);
  const shift = levels.length ? level - Math.min(...levels) : 0;
  return markdown.replace(/^(#{1,6})(?=\s)/gm, (hashes) => '#'.repeat(Math.min(6, hashes.length + shift)));
}

export function formatReleaseNotes(generated, { version, prerelease, date, repository, highlights = '' }) {
  const sections = { features: [], fixes: [], security: [], dependencies: [], other: [] };
  const contributors = [];
  let category = '';
  let fullChangelog = '';
  let inContributors = false;
  for (const line of generated.replace(/\r\n/g, '\n').split('\n')) {
    if (/^<!--.*-->\s*$/.test(line) || !line.trim()) continue;
    const heading = /^(#{2,3})\s+(.+?)\s*$/.exec(line);
    if (heading) {
      inContributors = heading[2] === 'New Contributors';
      category = heading[1] === '###' ? heading[2] : '';
      continue;
    }
    const changelog = /^\*\*Full Changelog\*\*:\s*(\S+)/.exec(line);
    if (changelog) { fullChangelog = changelog[1]; continue; }
    if (inContributors) { contributors.push(line.replace(/^\s*\*\s+/, '- ')); continue; }
    const pull = PULL_LINE.exec(line);
    if (!pull) { if (/^\s*[-*]\s/.test(line)) sections.other.push(line.replace(/^\s*\*\s+/, '- ')); continue; }
    const [, title, url, number, closes] = pull;
    const section = sectionFor(category, title);
    const suffix = closes ? ` (Closes ${closes})` : '';
    sections[section].push(section === 'security' || section === 'dependencies'
      ? `- [${title} - #${number}](${url})`
      : `- ${title} [#${number}](${url})${suffix}`);
  }

  const out = [`## v${version} — ${date}`, ''];
  if (prerelease) out.push('This is a release candidate for testing. The stable release follows once it has been tested.', '');
  out.push('### Changelog', '');
  const list = (title, items) => { if (items.length) out.push(`#### ${title}`, '', ...items, ''); };
  // Hand-written notes replace the PR titles of the features.
  if (highlights) out.push(nestUnder(highlights, 4), '');
  else list('Features', sections.features);
  list('Bug Fixes', sections.fixes);
  list('Other Changes', sections.other);
  const dependencies = sections.dependencies.length > 5
    ? [`- and ${sections.dependencies.length} dependency updates${fullChangelog ? `, see the [full changelog](${fullChangelog})` : ''}`]
    : sections.dependencies;
  if (sections.security.length || dependencies.length) {
    out.push('#### Security Patches', '',
      'This release also includes **security fixes** to keep `imgcompress` up to date with the latest CVE reports and security alerts from Docker Hub and GitHub.', '',
      ...sections.security, ...dependencies, '',
      'You can review the latest Docker image tags and related security information here:',
      `https://hub.docker.com/r/${repository.split('/')[0].toLowerCase()}/imgcompress/tags`, '');
  }
  if (contributors.length) out.push('#### New Contributors', '', ...contributors, '');
  if (fullChangelog) out.push(`**Full Changelog**: ${fullChangelog}`, '');
  out.push('### Setup & Updates', '',
    'To install the latest version or learn how to update `imgcompress`, follow the official guide:', '',
    '[Installation & Update Guide](https://imgcompress.karimzouine.com/installation/)', '',
    '### Pinned Version', '',
    'If you need to pin your deployment to this specific release, use:', '',
    '```', `karimz1/imgcompress:${version}`, '```', '');
  return out.join('\n');
}

function validRepository(repository) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository || '')) throw new Error('Invalid repository');
}

// Notes are generated once, before the build, so the image and the draft
// start from the same text.
export async function releaseNotes({ repository, tag, request, now = new Date(), pending = '' }) {
  validRepository(repository);
  const parsed = parseReleaseTag(tag);
  await request(`repos/${repository}/git/ref/tags/${encodeURIComponent(tag)}`);
  const releases = await listReleases(repository, request);
  const previous = await previousStableRelease(releases, tag, repository, request);
  const generated = await request(`repos/${repository}/releases/generate-notes`, {
    method: 'POST',
    body: { tag_name: tag, ...(previous ? { previous_tag_name: previous } : {}), configuration_file_path: '.github/release.yml' },
  });
  const linked = await addIssueLinks(generated.body, repository, request);
  return formatReleaseNotes(linked, { version: parsed.version, prerelease: parsed.prerelease, date: now.toISOString().slice(0, 10), repository, highlights: pendingEntry(pending, parsed.version) });
}

// Runs only after the version image is pushed. Never publishes.
export async function createDraft({ repository, tag, body, request }) {
  validRepository(repository);
  const parsed = parseReleaseTag(tag);
  if (!body?.trim()) throw new Error('Release notes are empty');
  const releases = await listReleases(repository, request);
  const existing = releases.find((release) => release.tag_name === tag);
  if (existing) return existing; // Never replace reviewed text on a retry.
  return request(`repos/${repository}/releases`, {
    method: 'POST',
    body: { tag_name: tag, name: `v${parsed.version}`, body, draft: true, prerelease: parsed.prerelease, make_latest: isNewestStable(releases, tag) ? 'true' : 'false' },
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options = {
    repository: process.env.GITHUB_REPOSITORY,
    tag: process.env.RELEASE_TAG,
    request: githubRequest(process.env.GH_TOKEN),
  };
  const bodyPath = process.env.RELEASE_BODY_PATH;
  if (!bodyPath) throw new Error('RELEASE_BODY_PATH is required');
  if (process.argv[2] === 'notes') {
    const pending = readFileSync(new URL('../frontend/public/release-notes.md', import.meta.url), 'utf8');
    writeFileSync(bodyPath, await releaseNotes({ ...options, pending }));
    console.log(`Notes written: ${bodyPath}`);
  } else if (process.argv[2] === 'draft') {
    const release = await createDraft({ ...options, body: readFileSync(bodyPath, 'utf8') });
    console.log(`${release.draft ? 'Draft ready' : 'Release already published'}: ${release.html_url}`);
  } else {
    throw new Error('Usage: node scripts/prepare-release.mjs notes|draft');
  }
}
