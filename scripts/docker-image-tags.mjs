import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { githubRequest, isNewestStable, listReleases, parseReleaseTag } from './prepare-release.mjs';

function images(owner) {
  return ['karimz1/imgcompress', `ghcr.io/${owner.toLowerCase()}/imgcompress`];
}

// A build never moves `latest`: a tag gets its version image, main gets nightly.
export function imageTags({ owner, tag = '' }) {
  if (!tag) return { version: '', prerelease: false, tags: images(owner).map((image) => `${image}:nightly`) };
  const { version, prerelease } = parseReleaseTag(tag);
  return { version, prerelease, tags: images(owner).map((image) => `${image}:${version}`) };
}

// Publishing points `latest` at the already pushed version image. RCs,
// releases marked as pre-release and backports keep the current `latest`.
export function latestPromotion({ owner, tag, prerelease = false, releases = [] }) {
  const { version } = parseReleaseTag(tag);
  const latest = !prerelease && isNewestStable(releases, tag);
  return {
    version,
    latest,
    retags: latest ? images(owner).map((image) => ({ from: `${image}:${version}`, to: `${image}:latest` })) : [],
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const owner = process.env.GITHUB_REPOSITORY_OWNER;
  const tag = process.env.RELEASE_TAG || '';
  if (process.argv[2] === 'promote') {
    const result = latestPromotion({
      owner,
      tag,
      prerelease: process.env.RELEASE_PRERELEASE === 'true',
      releases: await listReleases(process.env.GITHUB_REPOSITORY, githubRequest(process.env.GH_TOKEN)),
    });
    appendFileSync(process.env.GITHUB_OUTPUT, `latest=${result.latest}\nretags=${result.retags.map((r) => `${r.from}=${r.to}`).join(',')}\n`);
  } else {
    const result = imageTags({ owner, tag });
    appendFileSync(process.env.GITHUB_ENV, `VERSION=${result.version}\n`);
    appendFileSync(process.env.GITHUB_OUTPUT, `tags=${result.tags.join(',')}\nprerelease=${result.prerelease}\n`);
  }
}
