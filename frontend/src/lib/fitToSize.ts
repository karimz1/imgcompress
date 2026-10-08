/**
 * "Fit to exact size" settings. The mode and anchor strings mirror the backend
 * `FitMode` / `FitAnchor` enums (backend/image_converter/domain/fit_to_size.py)
 * and are sent as the `fit_mode` / `fit_anchor` form fields, together with
 * `fit_width` and `fit_height`.
 */
export const FIT_PRESETS = {
  "github-social": { width: 1280, height: 640 },
  "open-graph": { width: 1200, height: 630 },
} as const;

export type FitPreset = keyof typeof FIT_PRESETS | "custom";
export const FIT_PRESET_OPTIONS: readonly FitPreset[] = ["github-social", "open-graph", "custom"];

export const FIT_MODES = ["crop", "blur"] as const;
export type FitMode = (typeof FIT_MODES)[number];

export const FIT_ANCHORS = ["auto", "center", "top", "bottom", "left", "right"] as const;
export type FitAnchor = (typeof FIT_ANCHORS)[number];

/** Same limit as MAX_FIT_DIMENSION in the backend. */
export const MAX_FIT_DIMENSION = 8192;

export interface FitSettings {
  enabled: boolean;
  preset: FitPreset;
  customWidth: string;
  customHeight: string;
  mode: FitMode;
  anchor: FitAnchor;
}

export const DEFAULT_FIT_SETTINGS: FitSettings = {
  enabled: false,
  preset: "github-social",
  customWidth: String(FIT_PRESETS["github-social"].width),
  customHeight: String(FIT_PRESETS["github-social"].height),
  mode: "crop",
  anchor: "auto",
};

export function toFitPreset(value: string): FitPreset {
  return (FIT_PRESET_OPTIONS as readonly string[]).includes(value)
    ? (value as FitPreset)
    : DEFAULT_FIT_SETTINGS.preset;
}

export function toFitMode(value: string): FitMode {
  return (FIT_MODES as readonly string[]).includes(value) ? (value as FitMode) : DEFAULT_FIT_SETTINGS.mode;
}

export function toFitAnchor(value: string): FitAnchor {
  return (FIT_ANCHORS as readonly string[]).includes(value)
    ? (value as FitAnchor)
    : DEFAULT_FIT_SETTINGS.anchor;
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
