import { useState, useEffect } from "react";
import { coerce, gt } from "semver";
import { APP_CONFIG } from "@/lib/config";

interface VersionInfo {
  currentVersion: string | null;
  latestVersion: string | null;
  updateAvailable: boolean;
  isLoading: boolean;
}

const normalizeVersion = (value: string): string | null => {
  const parsed = coerce(value);
  return parsed ? parsed.version : null;
};

const compareVersions = (current: string, latest: string): boolean => {
  const normalizedCurrent = normalizeVersion(current);
  const normalizedLatest = normalizeVersion(latest);
  if (!normalizedCurrent || !normalizedLatest) return false;
  return gt(normalizedLatest, normalizedCurrent);
};

const extractMaxVersion = (markdown: string): string | null => {
  const versionPattern =
    /##\s+v?(\d+\.\d+\.\d+(?:\.\d+)?)\s+[—-]\s+\d{4}-\d{2}-\d{2}/g;
  const matches = Array.from(markdown.matchAll(versionPattern), (match) => match[1]);
  const normalized = matches
    .map((version) => normalizeVersion(version))
    .filter((version): version is string => Boolean(version));
  if (normalized.length === 0) return null;
  return normalized.reduce((max, current) => (gt(current, max) ? current : max));
};

export function useVersionCheck(): VersionInfo {
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchVersionInfo = async () => {
      try {
        // Fetch current version from local release notes
        const releaseNotesResponse = await fetch("/release-notes.md", { cache: "no-store" });
        if (releaseNotesResponse.ok) {
          const markdown = await releaseNotesResponse.text();
          const current = extractMaxVersion(markdown);
          setCurrentVersion(current);

          // Fetch latest version from API
          if (current) {
            try {
              const apiResponse = await fetch(APP_CONFIG.LATEST_VERSION_API, {
                cache: "no-store",
              });
              if (apiResponse.ok) {
                const data = await apiResponse.json();
                const rawLatest =
                  data.version ?? data.tag_name ?? data.name ?? data.release_tag;
                const latest =
                  typeof rawLatest === "string" ? normalizeVersion(rawLatest) : null;
                if (latest) {
                  setLatestVersion(latest);
                  if (compareVersions(current, latest)) {
                    setUpdateAvailable(true);
                  }
                }
              }
            } catch (apiError) {
              console.warn("Failed to fetch latest version from API:", apiError);
            }
          }
        }
      } catch (error) {
        console.warn("Failed to fetch version info:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchVersionInfo();
  }, []);

  return {
    currentVersion,
    latestVersion,
    updateAvailable,
    isLoading,
  };
}
