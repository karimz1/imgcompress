export type LatestReleasePayload = {
  tag_name: string;
  published_at: string;
  html_url: string;
  name?: string;
};

const normalizeVersion = (version: string) => version.replace(/^v/i, "");

export const UpdateBannerTestData = {
  createLatestReleasePayload: (version: string): LatestReleasePayload => {
    const normalized = normalizeVersion(version);
    const tag = `v${normalized}`;
    return {
      tag_name: tag,
      published_at: "2026-01-04T00:00:00Z",
      html_url: `https://github.com/karimz1/imgcompress/releases/tag/${tag}`,
      name: tag,
    };
  },
  getTagFromVersion: (version: string) => `v${normalizeVersion(version)}`,
  bumpPatchVersion: (version: string): string => {
    const match = version.match(/(\d+\.\d+\.\d+(?:\.\d+)?)/);
    const parts = match ? match[1].split(".").map(Number) : [0, 0, 0];
    parts[parts.length - 1] += 1;
    return parts.join(".");
  },
  releaseNotesUrl: "https://imgcompress.karimzouine.com/release-notes/",
} as const;
