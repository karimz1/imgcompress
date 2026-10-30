import { useSyncExternalStore } from "react";

/**
 * The upload limit the server runs with (MAX_UPLOAD_SIZE_MB, from
 * /config/runtime.json). Editor pictures use the same limit as every upload.
 */

/** Same default as uploads.max_file_size_mebibytes in the backend app.json. */
export const DEFAULT_MAX_UPLOAD_SIZE_MB = 40960;

let maxUploadSizeMb = DEFAULT_MAX_UPLOAD_SIZE_MB;
const listeners = new Set<() => void>();

/** Takes the value from the runtime config; anything that is not a whole number keeps the default. */
export function setMaxUploadSizeMb(value: unknown): void {
  const text = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
  maxUploadSizeMb = /^\d+$/.test(text) && Number(text) >= 1 ? Number(text) : DEFAULT_MAX_UPLOAD_SIZE_MB;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The limit in MB; components re-render once the runtime config has arrived. */
export function useMaxUploadSizeMb(): number {
  return useSyncExternalStore(subscribe, () => maxUploadSizeMb, () => maxUploadSizeMb);
}

export function maxUploadBytes(): number {
  return maxUploadSizeMb * 1024 * 1024;
}

/** "512 MB" or "40 GB", with the unit as the language writes it. */
export function formatUploadLimit(locale: string): string {
  const [value, unit] =
    maxUploadSizeMb >= 1024 ? [maxUploadSizeMb / 1024, "gigabyte"] : [maxUploadSizeMb, "megabyte"];
  try {
    return new Intl.NumberFormat(locale, { style: "unit", unit, maximumFractionDigits: 1 }).format(value);
  } catch {
    return `${value} ${unit === "gigabyte" ? "GB" : "MB"}`;
  }
}
