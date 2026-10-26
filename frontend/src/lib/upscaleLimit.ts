import { useSyncExternalStore } from "react";
import { DEFAULT_MAX_OUTPUT_MEGAPIXELS } from "./upscalePlan";

/**
 * The largest upscale output the server allows (upscaling.max_output_megapixels,
 * from /config/runtime.json). The size preview warns before the server refuses.
 */

let maxOutputMegapixels = DEFAULT_MAX_OUTPUT_MEGAPIXELS;
const listeners = new Set<() => void>();

/** Takes the value from the runtime config; anything that is not a whole number keeps the default. */
export function setMaxOutputMegapixels(value: unknown): void {
  const text = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
  maxOutputMegapixels = /^\d+$/.test(text) && Number(text) >= 1 ? Number(text) : DEFAULT_MAX_OUTPUT_MEGAPIXELS;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The limit in megapixels; components re-render once the runtime config has arrived. */
export function useMaxOutputMegapixels(): number {
  return useSyncExternalStore(subscribe, () => maxOutputMegapixels, () => maxOutputMegapixels);
}
