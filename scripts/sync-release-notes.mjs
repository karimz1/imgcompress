import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const VERSION_PATTERN = '\\d+\\.\\d+\\.\\d+(?:\\.\\d+)?(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?';
// Notes written before tagging use DateNeedsToBeReplaced or a planned date; the release replaces them.
const HEADER = new RegExp(`^##\\s+v?(${VERSION_PATTERN})\\s+[—-]\\s+(?:\\d{4}-\\d{2}-\\d{2}|DateNeedsToBeReplaced)\\s*$`);

function releaseHeaders(markdown) {
  const headers = [];
  let fence = null;
  let offset = 0;
  for (const line of markdown.split('\n')) {
    const marker = /^\s*(`{3,}|~{3,})/.exec(line);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = null;
    } else if (!fence) {
      const header = HEADER.exec(line);
      if (header) headers.push({ version: header[1], index: offset, pending: line.includes('DateNeedsToBeReplaced') });
    }
    offset += line.length + 1;
  }
  return headers;
}

function isOutsideFence(lines, index) {
  let fence = null;
  for (let i = 0; i <= index; i++) {
    const marker = /^\s*(`{3,}|~{3,})/.exec(lines[i]);
    if (!marker) continue;
    if (i === index) return false;
    if (!fence) fence = marker[1];
    else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = null;
  }
  return !fence;
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

export function releaseEntry(release) {
  const match = new RegExp(`^release_(${VERSION_PATTERN})$`).exec(release.tag_name);
  if (!match) throw new Error(`Invalid release tag: ${release.tag_name}`);
  if (release.draft || !release.published_at) throw new Error('Only published releases can be synced');
  if (!release.body?.trim()) throw new Error('Release notes are empty');
  const date = new Date(release.published_at);
  if (Number.isNaN(date.valueOf())) throw new Error('Invalid publication date');
  const version = match[1];
  const prerelease = Boolean(release.prerelease || version.includes('-'));
  // GitHub adds a hidden "generated using configuration" comment; it means nothing in the app.
  const lines = release.body.replace(/\r\n/g, '\n').trim().split('\n')
    .filter((line) => !/^<!--\s*Release notes generated using configuration\b.*-->\s*$/.test(line));
  const first = new RegExp(`^##\\s+v?(${VERSION_PATTERN})\\s+[—-]\\s+\\d{4}-\\d{2}-\\d{2}\\s*$`).exec(lines[0]);
  if (first?.[1] === version) lines.shift();
  // The draft's "Changelog" wrapper is redundant inside the app's release entry;
  // drop it and lift its subsections by one level.
  const body = [];
  let wrapper = 0;
  lines.forEach((line, index) => {
    const heading = isOutsideFence(lines, index) && /^(#{1,6})\s+(.*?)\s*$/.exec(line);
    if (heading && heading[1].length <= (wrapper || 0)) wrapper = 0;
    if (heading && heading[2] === 'Changelog') { wrapper = heading[1].length; return; }
    body.push(wrapper && heading ? line.slice(1) : line);
  });
  // Sections sit at h3 inside the app's h2 release entry, like the hand-written ones.
  const levels = body.filter((line, index) => isOutsideFence(body, index))
    .map((line) => /^(#{1,6})\s/.exec(line)?.[1].length).filter(Boolean);
  const shift = levels.length ? 3 - Math.min(...levels) : 0;
  const nested = body.map((line, index) => (isOutsideFence(body, index)
    ? line.replace(/^(#{1,6})(?=\s)/, (hashes) => '#'.repeat(Math.max(1, Math.min(6, hashes.length + shift))))
    : line)).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return { version, prerelease, markdown: `## v${version} — ${date.toISOString().slice(0, 10)}\n\n${nested}\n` };
}

export function upsertReleaseNotes(markdown, release, { includePrerelease = false, promote = false } = {}) {
  const entry = releaseEntry(release);
  if (entry.prerelease && !includePrerelease) return markdown;
  const headers = releaseHeaders(markdown);
  const preamble = headers.length ? markdown.slice(0, headers[0].index).trim() : markdown.trim();
  const entries = headers.map((header, index) => ({
    version: header.version,
    pending: header.pending,
    markdown: markdown.slice(header.index, headers[index + 1]?.index ?? markdown.length).trim(),
  })).filter((existing) => existing.version !== entry.version
    // Notes written before tagging belong to this release, RCs included. An RC
    // also replaces a dated entry of its stable version, which is not out yet.
    && !((existing.pending || entry.prerelease) && existing.version === entry.version.split('-')[0]));
  entries.push(entry);
  entries.sort((a, b) => {
    if (promote && a.version === entry.version) return -1;
    if (promote && b.version === entry.version) return 1;
    return compareVersions(b.version, a.version);
  });
  return [preamble, ...entries.map((item) => item.markdown.trim())].filter(Boolean).join('\n\n') + '\n';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // A tag build has no release yet; it ships the notes the draft will start with.
  const release = process.env.RELEASE_BODY_PATH
    ? { tag_name: process.env.RELEASE_TAG, body: readFileSync(process.env.RELEASE_BODY_PATH, 'utf8'), published_at: new Date().toISOString() }
    : process.env.RELEASE_JSON_PATH
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
