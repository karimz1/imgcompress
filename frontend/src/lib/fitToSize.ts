/**
 * Exact output sizes and modes used by the editor preview and saved exports.
 * Mode strings mirror the backend FitMode enum.
 */
export const FIT_PRESETS = {
  "github-social": { width: 1280, height: 640 },
  "open-graph": { width: 1200, height: 630 },
} as const;

export type FitPreset = keyof typeof FIT_PRESETS | "custom";
export const FIT_PRESET_OPTIONS: readonly FitPreset[] = ["github-social", "open-graph", "custom"];

export const FIT_MODES = ["crop", "blur"] as const;
export type FitMode = (typeof FIT_MODES)[number];

export interface FitOutput {
  width: number;
  height: number;
  mode: FitMode;
}

/** Same limit as MAX_FIT_DIMENSION in the backend. */
export const MAX_FIT_DIMENSION = 8192;

export interface FitSettings {
  preset: FitPreset;
  customWidth: string;
  customHeight: string;
  mode: FitMode;
}

export const DEFAULT_FIT_SETTINGS: FitSettings = {
  preset: "github-social",
  customWidth: String(FIT_PRESETS["github-social"].width),
  customHeight: String(FIT_PRESETS["github-social"].height),
  mode: "crop",
};

export function toFitPreset(value: string): FitPreset {
  return (FIT_PRESET_OPTIONS as readonly string[]).includes(value)
    ? (value as FitPreset)
    : DEFAULT_FIT_SETTINGS.preset;
}

function parseDimension(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = parseInt(trimmed, 10);
  return parsed >= 1 && parsed <= MAX_FIT_DIMENSION ? parsed : null;
}

/** The target size for the current settings, or null if the custom size is not valid. */
export function resolveFitSize(settings: FitSettings): { width: number; height: number } | null {
  if (settings.preset !== "custom") {
    return FIT_PRESETS[settings.preset];
  }
  const width = parseDimension(settings.customWidth);
  const height = parseDimension(settings.customHeight);
  return width !== null && height !== null ? { width, height } : null;
}
