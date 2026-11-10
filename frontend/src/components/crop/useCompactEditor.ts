"use client";

import { useEffect, useState } from "react";

/**
 * Below the desktop layout (lg, 1024 px wide) the editor keeps to crop and size.
 * Only the width counts, so tablets in landscape (iPad Pro 1194 / 1366 px) get the
 * full editor with touch, and phones or tablets in portrait get the small one.
 */
export const COMPACT_EDITOR_QUERY = "(max-width: 1023px)";

export function useCompactEditor(): boolean {
  const [compact, setCompact] = useState(
    () => typeof window !== "undefined" && !!window.matchMedia?.(COMPACT_EDITOR_QUERY).matches,
  );
  useEffect(() => {
    const query = window.matchMedia?.(COMPACT_EDITOR_QUERY);
    if (!query) return;
    const update = () => setCompact(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return compact;
}
