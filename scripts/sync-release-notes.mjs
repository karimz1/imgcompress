import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const VERSION_PATTERN = '\\d+\\.\\d+\\.\\d+(?:\\.\\d+)?(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?';
const HEADER = new RegExp(`^##\\s+v?(${VERSION_PATTERN})\\s+[—-]\\s+\\d{4}-\\d{2}-\\d{2}\\s*$`, 'gm');

function compareVersions(a, b) {
  const left = a.split('-')[0].split('.').map(Number);
  const right = b.split('-')[0].split('.').map(Number);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const difference = (left[i] || 0) - (right[i] || 0);
    if (difference) return difference;
  }
  return 0;
}

export function releaseEntry(release) {
  const match = new RegExp(`^release_(${VERSION_PATTERN})$`).exec(release.tag_name);
  if (!match) throw new Error(`Invalid release tag: ${release.tag_name}`);
  if (release.draft || !release.published_at) throw new Error('Only published releases can be synced');
  if (!release.body?.trim()) throw new Error('Release notes are empty');
  const date = new Date(release.published_at);
  if (Number.isNaN(date.valueOf())) throw new Error('Invalid publication date');
  const version = match[1];
  const prerelease = Boolean(release.prerelease || version.includes('-'));
  const lines = release.body.replace(/\r\n/g, '\n').trim().split('\n');
  const first = new RegExp(`^##\\s+v?(${VERSION_PATTERN})\\s+[—-]\\s+\\d{4}-\\d{2}-\\d{2}\\s*$`).exec(lines[0]);
  if (first?.[1] === version) lines.shift();
  let fence = null;
  const body = lines.map((line) => {
    const marker = /^\s*(`{3,}|~{3,})/.exec(line);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = null;
      return line;
    }
    // GitHub's sections belong inside the app's h2 release entry.
    return !fence ? line.replace(/^(#{1,5})\s/, '#$1 ') : line;
  }).join('\n').trim();
  return { version, prerelease, markdown: `## v${version} — ${date.toISOString().slice(0, 10)}\n\n${body}\n` };
}

export function upsertReleaseNotes(markdown, release, { includePrerelease = false, promote = false } = {}) {
  const entry = releaseEntry(release);
  if (entry.prerelease && !includePrerelease) return markdown;
  const headers = [...markdown.matchAll(HEADER)];
  const preamble = headers.length ? markdown.slice(0, headers[0].index).trim() : markdown.trim();
  const entries = headers.map((header, index) => ({
    version: header[1],
    markdown: markdown.slice(header.index, headers[index + 1]?.index ?? markdown.length).trim(),
  })).filter((existing) => existing.version !== entry.version);
  entries.push(entry);
  entries.sort((a, b) => {
    if (promote && a.version === entry.version) return -1;
    if (promote && b.version === entry.version) return 1;
    return compareVersions(b.version, a.version);
  });
  return [preamble, ...entries.map((item) => item.markdown.trim())].filter(Boolean).join('\n\n') + '\n';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const release = process.env.RELEASE_JSON_PATH
    ? JSON.parse(readFileSync(process.env.RELEASE_JSON_PATH, 'utf8'))
    : JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')).release;
  const filename = 'frontend/public/release-notes.md';
  const markdown = readFileSync(filename, 'utf8');
  const updated = upsertReleaseNotes(markdown, release, {
    includePrerelease: process.env.INCLUDE_PRERELEASE === 'true',
    promote: process.env.INCLUDE_PRERELEASE === 'true',
  });
  if (updated !== markdown) writeFileSync(filename, updated);
  console.log(`${updated === markdown ? 'Already current' : 'Updated'}: ${filename}`);
}
