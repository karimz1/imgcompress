import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function createBuildInfo({ markdown, commit = '', date = '', ref = '', version = '', prerelease = false, now = new Date() }) {
  const versionPattern = '\\d+\\.\\d+\\.\\d+(?:\\.\\d+)?(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?';
  const stableHeader = /^##\s+v?(\d+\.\d+\.\d+(?:\.\d+)?)\s+[—-]\s+\d{4}-\d{2}-\d{2}\s*$/m;
  const baseVersion = markdown.match(stableHeader)?.[1];
  const tagVersion = ref.replace(/^refs\/tags\//, '').match(new RegExp(`^release_(${versionPattern})$`))?.[1];
  const installedVersion = version || tagVersion || baseVersion;
  if (!installedVersion || !new RegExp(`^${versionPattern}$`).test(installedVersion)) throw new Error('A valid build version is required');
  if (commit && !/^[a-f0-9]{7,64}$/i.test(commit)) throw new Error('Invalid source commit');
  const builtAt = date ? new Date(date) : now;
  if (Number.isNaN(builtAt.valueOf())) throw new Error('Invalid build date');
  const channel = tagVersion
    ? (prerelease || tagVersion.includes('-') ? 'rc' : 'stable')
    : (commit ? 'nightly' : 'local');
  const timestamp = builtAt.toISOString();
  const buildId = `${installedVersion}-${channel}.${timestamp.replace(/[-:T]/g, '').slice(0, 14)}${commit ? `+${commit.slice(0, 7)}` : ''}`;
  return {
    schemaVersion: 1, version: installedVersion, baseVersion: baseVersion || installedVersion,
    channel, commit: commit || null, builtAt: timestamp, buildId, ref: ref || null,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const info = createBuildInfo({
    markdown: readFileSync(new URL('../public/release-notes.md', import.meta.url), 'utf8'),
    commit: process.env.BUILD_COMMIT,
    date: process.env.BUILD_DATE,
    ref: process.env.BUILD_REF,
    version: process.env.BUILD_VERSION,
    prerelease: process.env.BUILD_PRERELEASE === 'true',
  });
  writeFileSync(new URL('../public/build-info.json', import.meta.url), JSON.stringify(info, null, 2) + '\n');
  console.log(`Build: ${info.buildId}`);
}
