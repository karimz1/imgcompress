export type LatestVersionPayload = {
  version: string;
  release_date: string;
  changelog: string[];
  url: string;
};

const normalizeVersion = (version: string) => version.replace(/^v/, "");

export const UpdateBannerTestData = {
  newerVersion: {
    version: "v99.99.99",
    release_date: "2026-12-31",
    changelog: ["Test update"],
    url: "https://github.com/karimz1/imgcompress/releases/tag/v99.99.99",
  } satisfies LatestVersionPayload,
  createCurrentVersionPayload: (version: string): LatestVersionPayload => {
    const normalized = normalizeVersion(version);
    return {
      version: `v${normalized}`,
      release_date: "2026-01-04",
      changelog: ["No new updates"],
      url: `https://github.com/karimz1/imgcompress/releases/tag/v${normalized}`,
    };
  },
  releaseNotesUrl: "https://imgcompress.karimzouine.com/release-notes/",
} as const;
