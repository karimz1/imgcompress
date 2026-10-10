import { useState, useEffect } from "react";
import { coerce, gt, valid } from "semver";
import { APP_CONFIG } from "@/lib/config";
import { extractCurrentVersion } from "@/lib/release-version";

interface VersionInfo {
  currentVersion: string | null;
  latestVersion: string | null;
  updateAvailable: boolean;
  isLoading: boolean;
}

const normalizeVersion = (value: string): string | null => {
  const exact = valid(value.replace(/^(?:release_|v)/, ""));
  if (exact) return exact;
  const parsed = coerce(value);
  return parsed ? parsed.version : null;
};

const compareVersions = (current: string, latest: string): boolean => {
  const normalizedCurrent = normalizeVersion(current);
  const normalizedLatest = normalizeVersion(latest);
  if (!normalizedCurrent || !normalizedLatest) return false;
  return gt(normalizedLatest, normalizedCurrent);
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
          const rawCurrent = extractCurrentVersion(markdown);
          const current = rawCurrent ? normalizeVersion(rawCurrent) : null;
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
