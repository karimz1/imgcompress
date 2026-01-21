import { useState, useEffect } from "react";
import { APP_CONFIG } from "@/lib/config";

interface VersionInfo {
  currentVersion: string | null;
  latestVersion: string | null;
  updateAvailable: boolean;
  isLoading: boolean;
}

const extractLatestVersion = (markdown: string): string | null => {
  const versionPattern = /##\s+v?(\d+\.\d+\.\d+(?:\.\d+)?)\s+[—-]\s+\d{4}-\d{2}-\d{2}/;
  const match = markdown.match(versionPattern);
  return match ? match[1] : null;
};

const compareVersions = (current: string, latest: string): boolean => {
  const parseCurrent = current.split('.').map(Number);
  const parseLatest = latest.split('.').map(Number);

  for (let i = 0; i < Math.max(parseCurrent.length, parseLatest.length); i++) {
    const currentPart = parseCurrent[i] || 0;
    const latestPart = parseLatest[i] || 0;

    if (latestPart > currentPart) return true;
    if (latestPart < currentPart) return false;
  }

  return false;
};

export function useVersionCheck(): VersionInfo {
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchVersionInfo = async () => {
      try {
        const releaseNotesResponse = await fetch("/release-notes.md", { cache: "no-store" });
        if (releaseNotesResponse.ok) {
          const markdown = await releaseNotesResponse.text();
          const current = extractLatestVersion(markdown);
          setCurrentVersion(current);

          // Fetch latest version from API
          if (current) {
            try {
              const apiResponse = await fetch(APP_CONFIG.LATEST_VERSION_API, {
                cache: "no-store",
              });

              console.log("Version check - API response status:", apiResponse.status);

              if (apiResponse.ok) {
                const data = await apiResponse.json();
                console.log("Version check - API data:", data);

                const latest = data.version?.replace(/^v/, "");
                setLatestVersion(latest);

                console.log("Version check - Current:", current, "Latest:", latest);

                if (latest && compareVersions(current, latest)) {
                  console.log("Version check - Update available!");
                  setUpdateAvailable(true);
                } else {
                  console.log("Version check - No update available");
                }
              } else {
                console.warn("Version check - API response not OK:", apiResponse.status);
              }
            } catch (apiError) {
              console.error("Failed to fetch latest version from API:", apiError);
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
