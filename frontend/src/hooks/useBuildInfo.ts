import { useEffect, useState } from "react";
import { parseBuildInfo, type BuildInfo } from "@/lib/build-info";

// build-info.json is written into the image at build time. Dev servers and
// older images don't have it, so null just means "show the plain version".
export function useBuildInfo(): BuildInfo | null {
  const [info, setInfo] = useState<BuildInfo | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/build-info.json", { cache: "no-store", signal: controller.signal })
      .then(async (response) => (response.ok ? parseBuildInfo(await response.json()) : null))
      .then(setInfo)
      .catch(() => setInfo(null));
    return () => controller.abort();
  }, []);

  return info;
}
