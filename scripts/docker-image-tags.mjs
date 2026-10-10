import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { githubRequest, isNewestStable, listReleases, parseReleaseTag } from './prepare-release.mjs';

export function imageTags({ owner, tag = '', prerelease = false, ref = '', releases = [] }) {
  const images = ['karimz1/imgcompress', `ghcr.io/${owner.toLowerCase()}/imgcompress`];
  if (!tag) {
    if (ref.startsWith('refs/tags/release_')) throw new Error('Publish the GitHub release before deploying its tag');
    return { version: '', latest: false, tags: images.map((image) => `${image}:nightly`) };
  }
  const parsed = parseReleaseTag(tag);
  const latest = !parsed.prerelease && !prerelease && isNewestStable(releases, tag);
  const channels = latest ? [parsed.version, 'latest'] : [parsed.version];
  return { version: parsed.version, latest, tags: images.flatMap((image) => channels.map((channel) => `${image}:${channel}`)) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const tag = process.env.RELEASE_TAG;
  const result = imageTags({
    owner: process.env.GITHUB_REPOSITORY_OWNER,
    tag,
    prerelease: process.env.RELEASE_PRERELEASE === 'true',
    ref: process.env.DEPLOY_REF,
    releases: tag ? await listReleases(process.env.GITHUB_REPOSITORY, githubRequest(process.env.GH_TOKEN)) : [],
  });
  appendFileSync(process.env.GITHUB_ENV, `VERSION=${result.version}\n`);
  appendFileSync(process.env.GITHUB_OUTPUT, `tags=${result.tags.join(',')}\nlatest=${result.latest}\n`);
}
