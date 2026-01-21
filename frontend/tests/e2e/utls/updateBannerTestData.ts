export type LatestReleasePayload = {
  tag_name: string;
  published_at: string;
  html_url: string;
  name?: string;
};

const normalizeVersion = (version: string) => version.replace(/^v/, "");

export const UpdateBannerTestData = {
  newerVersion: {
    tag_name: "v99.99.99",
    published_at: "2026-12-31T00:00:00Z",
    html_url: "https://github.com/karimz1/imgcompress/releases/tag/v99.99.99",
    name: "v99.99.99",
  } satisfies LatestReleasePayload,
  createCurrentVersionPayload: (version: string): LatestReleasePayload => {
    const normalized = normalizeVersion(version);
    return {
      tag_name: `v${normalized}`,
      published_at: "2026-01-04T00:00:00Z",
      html_url: `https://github.com/karimz1/imgcompress/releases/tag/v${normalized}`,
      name: `v${normalized}`,
    };
  },
  releaseNotesUrl: "https://imgcompress.karimzouine.com/release-notes/",
} as const;
