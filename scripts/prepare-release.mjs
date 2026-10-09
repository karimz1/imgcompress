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

export async function prepareRelease({ repository, tag, request }) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error('Invalid repository');
  const parsed = parseReleaseTag(tag);
  await request(`repos/${repository}/git/ref/tags/${encodeURIComponent(tag)}`);
  const releases = [];
  for (let page = 1; ; page++) {
    const batch = await request(`repos/${repository}/releases?per_page=100&page=${page}`);
    releases.push(...batch);
    if (batch.length < 100) break;
  }
  const existing = releases.find((release) => release.tag_name === tag);
  if (existing) return existing; // Never replace reviewed text on a retry.

  const previous = await previousStableRelease(releases, tag, repository, request);
  const generated = await request(`repos/${repository}/releases/generate-notes`, {
    method: 'POST',
    body: { tag_name: tag, ...(previous ? { previous_tag_name: previous } : {}), configuration_file_path: '.github/release.yml' },
  });
  let body = await addIssueLinks(generated.body, repository, request);
  if (parsed.prerelease) body = `This is a release candidate for testing. Stable deployments should keep using \`latest\`.\n\n${body}`;
  body += `\n\n### Installation\n\n[Installation & update guide](https://imgcompress.karimzouine.com/installation/)\n\nPin this version with \`karimz1/imgcompress:${parsed.version}\`.\n`;
  return request(`repos/${repository}/releases`, {
    method: 'POST',
    body: { tag_name: tag, name: `v${parsed.version}`, body, draft: true, prerelease: parsed.prerelease, make_latest: parsed.prerelease ? 'false' : 'true' },
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const release = await prepareRelease({
    repository: process.env.GITHUB_REPOSITORY,
    tag: process.env.RELEASE_TAG,
    request: githubRequest(process.env.GH_TOKEN),
  });
  console.log(`${release.draft ? 'Draft ready' : 'Release already published'}: ${release.html_url}`);
}
