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

export const FIT_MODES = ["crop", "blur", "solid", "transparent", "image"] as const;
export type FitMode = (typeof FIT_MODES)[number];

/** Patterns drawn over a solid colour. Mirrors FitPattern in the backend. */
export const FIT_PATTERNS = ["none", "checker", "dots", "stripes", "grid"] as const;
export type FitPattern = (typeof FIT_PATTERNS)[number];

/** Same limit as MAX_BACKGROUND_DIM in the backend. */
export const MAX_BACKGROUND_DIM = 0.9;
/** Same limit as MAX_BACKGROUND_BYTES in the backend. */
export const MAX_BACKGROUND_BYTES = 25 * 1024 * 1024;
export const BACKGROUND_IMAGE_ACCEPT =
  "image/png,image/jpeg,image/webp,image/gif,image/bmp,image/tiff,image/avif,image/heic,image/heif";

/**
 * Picture behind the image in "image" mode. It only lives in this browser tab
 * and is sent along with every preview and export request; the server never
 * keeps it. ``id`` changes with every new pick, so previews notice the swap.
 */
export interface FitBackgroundImage {
  id: string;
  file: File;
}

export interface FitBackground {
  pattern: FitPattern;
  /** 0 to MAX_BACKGROUND_DIM: how much black is laid over the background. */
  dim: number;
  image?: FitBackgroundImage;
}

export function patternSupported(mode: FitMode): boolean {
  return mode === "solid";
}

export function dimSupported(mode: FitMode): boolean {
  return mode === "blur" || mode === "solid" || mode === "image";
}

/**
 * Where the whole image sits on the canvas in blur, solid and transparent
 * modes. ``scale`` is relative to the size that just fits the canvas
 * (1 = the default layout); ``x``/``y`` are the image centre as a share of the
 * canvas width and height, so the same placement works at any resolution.
 * Mirrors FitPlacement in the backend.
 */
export interface FitPlacement {
  scale: number;
  x: number;
  y: number;
}

export interface FitOutput {
  width: number;
  height: number;
  mode: FitMode;
  color?: string;
  placement?: FitPlacement;
  /** Left out when the background is plain, so older saved fits stay equal. */
  background?: FitBackground;
}

/** Same limits as the backend FitPlacement parser. */
export const MIN_PLACEMENT_SCALE = 0.01;
export const MAX_PLACEMENT_SCALE = 20;
export const MIN_PLACEMENT_POSITION = -1;
export const MAX_PLACEMENT_POSITION = 2;

export const DEFAULT_PLACEMENT: FitPlacement = { scale: 1, x: 0.5, y: 0.5 };

export function placementSupported(mode: FitMode): boolean {
  return mode !== "crop";
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** Rounds and keeps a placement inside the limits the backend accepts. */
export function clampPlacement(placement: FitPlacement): FitPlacement {
  const round = (value: number) => Math.round(value * 1e6) / 1e6;
  return {
    scale: round(clamp(placement.scale, MIN_PLACEMENT_SCALE, MAX_PLACEMENT_SCALE)),
    x: round(clamp(placement.x, MIN_PLACEMENT_POSITION, MAX_PLACEMENT_POSITION)),
    y: round(clamp(placement.y, MIN_PLACEMENT_POSITION, MAX_PLACEMENT_POSITION)),
  };
}

/**
 * The image rectangle on a ``width`` x ``height`` canvas, in canvas units.
 * Same formula as ImageResizer.placement_box in the backend.
 */
export function placementRect(
  source: { width: number; height: number },
  canvas: { width: number; height: number },
  placement: FitPlacement,
): { left: number; top: number; width: number; height: number } {
  const ratio =
    Math.min(canvas.width / source.width, canvas.height / source.height) *
    placement.scale;
  const width = source.width * ratio;
  const height = source.height * ratio;
  return {
    left: placement.x * canvas.width - width / 2,
    top: placement.y * canvas.height - height / 2,
    width,
    height,
  };
}

/**
 * Scales the placement by ``factor`` while the canvas point ``anchor`` stays
 * under the cursor (Photoshop-style zoom). Positions are in canvas units.
 */
export function zoomPlacementAt(
  placement: FitPlacement,
  factor: number,
  anchor: { x: number; y: number },
  canvas: { width: number; height: number },
): FitPlacement {
  const scale = clamp(placement.scale * factor, MIN_PLACEMENT_SCALE, MAX_PLACEMENT_SCALE);
  const applied = scale / placement.scale;
  const centerX = placement.x * canvas.width;
  const centerY = placement.y * canvas.height;
  return clampPlacement({
    scale,
    x: (anchor.x + (centerX - anchor.x) * applied) / canvas.width,
    y: (anchor.y + (centerY - anchor.y) * applied) / canvas.height,
  });
}

/** Scale at which the image covers the whole canvas (no background visible). */
export function coverScale(
  source: { width: number; height: number },
  canvas: { width: number; height: number },
): number {
  const contain = Math.min(canvas.width / source.width, canvas.height / source.height);
  const cover = Math.max(canvas.width / source.width, canvas.height / source.height);
  return cover / contain;
}

/** "#abc", "#aabbcc" or "#aabbccdd" in lower case, or null if it is not a hex colour. */
export function normalizeHexColor(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  const hex = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
  if (!/^[0-9a-f]+$/.test(hex) || ![3, 4, 6, 8].includes(hex.length)) return null;
  return `#${hex}`;
}

/** Same limit as MAX_FIT_DIMENSION in the backend. */
export const MAX_FIT_DIMENSION = 8192;

export interface FitSettings {
  preset: FitPreset;
  customWidth: string;
  customHeight: string;
  mode: FitMode;
  color: string;
  pattern: FitPattern;
  dim: number;
}

export const DEFAULT_FIT_SETTINGS: FitSettings = {
  preset: "github-social",
  customWidth: String(FIT_PRESETS["github-social"].width),
  customHeight: String(FIT_PRESETS["github-social"].height),
  mode: "crop",
  color: "#ffffff",
  pattern: "none",
  dim: 0,
};

/**
 * The background a fit is rendered with, or undefined for a plain one.
 * Settings that do not apply to ``mode`` are left out.
 */
export function resolveFitBackground(
  mode: FitMode,
  pattern: FitPattern,
  dim: number,
  image: FitBackgroundImage | null,
): FitBackground | undefined {
  const usedPattern = patternSupported(mode) ? pattern : "none";
  const usedDim = dimSupported(mode) ? Math.round(clamp(dim, 0, MAX_BACKGROUND_DIM) * 100) / 100 : 0;
  const usedImage = mode === "image" && image ? image : undefined;
  if (usedPattern === "none" && usedDim === 0 && !usedImage) return undefined;
  return { pattern: usedPattern, dim: usedDim, ...(usedImage ? { image: usedImage } : {}) };
}

export function sameBackground(a?: FitBackground, b?: FitBackground): boolean {
  return (
    (a?.pattern ?? "none") === (b?.pattern ?? "none") &&
    (a?.dim ?? 0) === (b?.dim ?? 0) &&
    a?.image?.id === b?.image?.id
  );
}

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
