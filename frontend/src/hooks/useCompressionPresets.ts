import { useCallback, useEffect, useState } from "react";
import { fetchPresets, type CompressionPreset } from "@/lib/presets";

/**
 * The presets saved on this server. `refresh` reloads them, e.g. after a
 * change or when the list opens, so presets saved in another browser show up.
 */
export function useCompressionPresets(enabled: boolean) {
  const [presets, setPresets] = useState<CompressionPreset[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      setPresets(await fetchPresets());
      setLoadFailed(false);
    } catch (err) {
      console.warn("Could not load presets", err);
      setLoadFailed(true);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { presets, loadFailed, refresh };
}
