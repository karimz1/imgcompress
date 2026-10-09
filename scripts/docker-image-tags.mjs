import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parseReleaseTag } from './prepare-release.mjs';

export function imageTags({ owner, tag = '', prerelease = false, ref = '' }) {
  const images = ['karimz1/imgcompress', `ghcr.io/${owner.toLowerCase()}/imgcompress`];
  if (!tag) {
    if (ref.startsWith('refs/tags/release_')) throw new Error('Publish the GitHub release before deploying its tag');
    return { version: '', tags: images.map((image) => `${image}:nightly`) };
  }
  const parsed = parseReleaseTag(tag);
  const channels = parsed.prerelease || prerelease ? [parsed.version] : [parsed.version, 'latest'];
  return { version: parsed.version, tags: images.flatMap((image) => channels.map((channel) => `${image}:${channel}`)) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = imageTags({
    owner: process.env.GITHUB_REPOSITORY_OWNER,
    tag: process.env.RELEASE_TAG,
    prerelease: process.env.RELEASE_PRERELEASE === 'true',
    ref: process.env.DEPLOY_REF,
  });
  appendFileSync(process.env.GITHUB_ENV, `VERSION=${result.version}\n`);
  appendFileSync(process.env.GITHUB_OUTPUT, `tags=${result.tags.join(',')}\n`);
}
