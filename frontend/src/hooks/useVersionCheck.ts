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

export function useVersionCheck(installedVersion?: string): VersionInfo {
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchVersionInfo = async () => {
      try {
        let rawCurrent = installedVersion;
        if (!rawCurrent) {
          const releaseNotesResponse = await fetch("/release-notes.md", { cache: "no-store" });
          if (releaseNotesResponse.ok) {
            rawCurrent = extractCurrentVersion(await releaseNotesResponse.text()) ?? undefined;
          }
        }
        if (rawCurrent) {
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
  }, [installedVersion]);

  // Metadata and notes can arrive in either order. Compare against the same
  // installed version used in the footer, rather than retaining a stale result.
  const effectiveCurrent = installedVersion ? normalizeVersion(installedVersion) : currentVersion;

  return {
    currentVersion: effectiveCurrent,
    latestVersion,
    updateAvailable: !!effectiveCurrent && !!latestVersion && compareVersions(effectiveCurrent, latestVersion),
    isLoading,
  };
}
