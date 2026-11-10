/**
 * Exact output sizes and modes used by the editor preview and saved exports.
 * Mode strings mirror the backend FitMode enum.
 */
export const FIT_PRESETS = {
  "youtube-thumbnail": { width: 1280, height: 720 },
  // YouTube Shorts, Reels, TikTok and stories all use 9:16.
  "shorts-story": { width: 1080, height: 1920 },
  "instagram-post": { width: 1080, height: 1080 },
  "instagram-portrait": { width: 1080, height: 1350 },
  "open-graph": { width: 1200, height: 630 },
  "x-post": { width: 1600, height: 900 },
  "github-social": { width: 1280, height: 640 },
  "pinterest-pin": { width: 1000, height: 1500 },
  "full-hd": { width: 1920, height: 1080 },
  qhd: { width: 2560, height: 1440 },
  "uhd-4k": { width: 3840, height: 2160 },
} as const;

export type FitPreset = keyof typeof FIT_PRESETS | "custom";
/** The preset tiles in their groups. */
export const FIT_PRESET_GROUPS = [
  {
    id: "social",
    presets: [
      "youtube-thumbnail",
      "shorts-story",
      "instagram-post",
      "instagram-portrait",
      "open-graph",
      "x-post",
      "github-social",
      "pinterest-pin",
    ],
  },
  // "Custom" fills the last cell here.
  { id: "screen", presets: ["full-hd", "qhd", "uhd-4k", "custom"] },
] as const satisfies readonly { id: string; presets: readonly FitPreset[] }[];
export const FIT_PRESET_OPTIONS: readonly FitPreset[] = FIT_PRESET_GROUPS.flatMap(
  (group) => group.presets,
);
/** Translation key below form.fitSize.preset.short (and .details where there is one). */
export const FIT_PRESET_LABELS: Record<FitPreset, string> = {
  "youtube-thumbnail": "youtubeThumbnail",
  "shorts-story": "shortsStory",
  "instagram-post": "instagramPost",
  "instagram-portrait": "instagramPortrait",
  "open-graph": "openGraph",
  "x-post": "xPost",
  "github-social": "githubSocial",
  "pinterest-pin": "pinterestPin",
  "full-hd": "fullHd",
  qhd: "qhd",
  "uhd-4k": "uhd4k",
  custom: "custom",
};

export const FIT_MODES = ["crop", "blur", "solid", "transparent", "image"] as const;
export type FitMode = (typeof FIT_MODES)[number];

/** Patterns drawn over a solid colour. Mirrors FitPattern in the backend. */
export const FIT_PATTERNS = ["none", "checker", "dots", "stripes", "grid"] as const;
export type FitPattern = (typeof FIT_PATTERNS)[number];

/** Same limit as MAX_BACKGROUND_DIM in the backend. */
export const MAX_BACKGROUND_DIM = 0.9;
/**
 * Background blur strength, 0 (sharp) to 1. Mirrors DEFAULT_BLUR_STRENGTH:
 * blur mode keeps the look it always had, a background picture starts sharp.
 */
export function defaultBlur(mode: FitMode): number {
  return mode === "blur" ? 0.25 : 0;
}
export const TINT_SWATCHES = ["#000000", "#ffffff", "#2563eb", "#f97316", "#db2777"] as const;
export const DEFAULT_TINT_COLOR = "#2563eb";

/**
 * Two-colour linear gradients. ``angle`` uses the CSS convention (0 = up,
 * 90 = right, 180 = down), the same as backend gradient.py, so the CSS
 * preview and the export match pixel for pixel.
 */
export const DEFAULT_GRADIENT_ANGLE = 180;
export const GRADIENT_DIRECTIONS = [90, 180, 135, 45] as const;
/** One-click fills; the first colour also drives the pattern ink. */
export const GRADIENT_PRESETS = [
  { id: "sunset", from: "#f97316", to: "#db2777" },
  { id: "ocean", from: "#0ea5e9", to: "#6366f1" },
  { id: "mint", from: "#34d399", to: "#0ea5e9" },
  { id: "violet", from: "#8b5cf6", to: "#ec4899" },
  { id: "peach", from: "#fde68a", to: "#fca5a5" },
  { id: "night", from: "#0f172a", to: "#475569" },
] as const;
export const DEFAULT_GRADIENT_TO = "#2563eb";

export function normalizeGradientAngle(angle: number): number {
  if (!Number.isFinite(angle)) return DEFAULT_GRADIENT_ANGLE;
  const folded = angle % 360;
  return Math.round((folded < 0 ? folded + 360 : folded) * 100) / 100 + 0;
}

/** CSS for a two-colour gradient; mixes in sRGB like the backend. */
export function gradientCss(from: string, to: string, angle: number): string {
  return `linear-gradient(${normalizeGradientAngle(angle)}deg, ${from}, ${to})`;
}
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
  /** 0 to 1; left out when it is the mode's default. */
  blur?: number;
  /** Colour laid over the background; left out when off. ``colorTo`` makes it a gradient. */
  tint?: { color: string; opacity: number; colorTo?: string; angle?: number };
  /** Solid mode only: the fill runs from the fit colour to this one. */
  colorTo?: string;
  gradientAngle?: number;
  /**
   * Where the background picture sits ("image" mode). ``scale`` is relative to
   * the size that just covers the canvas; left out for the default cover fit.
   */
  imagePlacement?: FitPlacement;
}

export function patternSupported(mode: FitMode): boolean {
  return mode === "solid";
}

export function dimSupported(mode: FitMode): boolean {
  return mode === "blur" || mode === "solid" || mode === "image";
}

export function blurSupported(mode: FitMode): boolean {
  return mode === "blur" || mode === "image";
}

/** Tint works wherever darkening does. */
export const tintSupported = dimSupported;

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
  /** Clockwise degrees about the centre, -180 (exclusive) to 180; left out when 0. */
  rotation?: number;
}

/** Fonts bundled with the app (public/fonts and the backend). Same ids as the API. */
export const TEXT_FONTS = ["inter", "noto-serif", "jetbrains-mono", "caveat"] as const;
export type TextFont = (typeof TEXT_FONTS)[number];
/** Caveat ships without italics; the export would not slant it either. */
export const fontHasItalic = (font: TextFont) => font !== "caveat";
export const TEXT_FONT_LABELS: Record<TextFont, string> = {
  inter: "Inter",
  "noto-serif": "Noto Serif",
  "jetbrains-mono": "JetBrains Mono",
  caveat: "Caveat",
};
export const TEXT_ALIGNS = ["left", "center", "right"] as const;
export type TextAlign = (typeof TEXT_ALIGNS)[number];
export const MAX_TEXT_LENGTH = 200;
export const MAX_TEXT_LINES = 10;
export const MIN_TEXT_SIZE = 0.01;
export const MAX_TEXT_SIZE = 0.5;
/** Same as LINE_HEIGHT and the shadow in backend text_overlay.py. */
export const TEXT_LINE_HEIGHT = 1.2;
export const TEXT_SHADOW = "0.04em 0.04em 0.06em rgba(0,0,0,0.5)";

/**
 * Text drawn on top of the output. Keys match the API (``fit_text``), so a
 * saved fit can be sent again as is. ``size`` is the font size as a share of
 * the canvas height; ``x``/``y`` are the centre of the text block (0..1).
 */
export interface FitText {
  text: string;
  font_id: TextFont;
  bold: boolean;
  italic: boolean;
  size: number;
  color: string;
  opacity: number;
  x: number;
  y: number;
  shadow: boolean;
  /** How lines line up inside the block; the block itself stays centred on x/y. */
  align: TextAlign;
  /** Clockwise degrees about the block centre; left out when straight. */
  rotation?: number;
}

export const DEFAULT_TEXT: FitText = {
  text: "",
  font_id: "inter",
  bold: true,
  italic: false,
  size: 0.08,
  color: "#ffffff",
  opacity: 1,
  x: 0.5,
  y: 0.5,
  shadow: true,
  align: "center",
};

/** Keeps a text inside the limits the backend accepts. */
export function clampText(text: FitText): FitText {
  const round = (value: number) => Math.round(value * 1e4) / 1e4;
  const lines = text.text.replace(/\r\n?/g, "\n").split("\n").slice(0, MAX_TEXT_LINES).join("\n");
  const clamped: FitText = {
    ...text,
    text: lines.slice(0, MAX_TEXT_LENGTH),
    italic: text.italic && fontHasItalic(text.font_id),
    size: round(clamp(text.size, MIN_TEXT_SIZE, MAX_TEXT_SIZE)),
    opacity: round(clamp(text.opacity, 0, 1)),
    x: round(clamp(text.x, 0, 1)),
    y: round(clamp(text.y, 0, 1)),
    align: (TEXT_ALIGNS as readonly string[]).includes(text.align) ? text.align : "center",
  };
  const rotation = normalizeAngle(text.rotation ?? 0);
  if (rotation) clamped.rotation = rotation;
  else delete clamped.rotation;
  return clamped;
}

export const textVisible = (text: FitText | null | undefined): text is FitText =>
  !!text && text.text.trim() !== "" && text.opacity > 0;

/** Same limits as backend fit_layers.py. */
export const MAX_TEXT_LAYERS = 5;
export const MAX_IMAGE_LAYERS = 5;
export const MIN_LAYER_SIZE = 0.005;
export const MAX_LAYER_SIZE = 10;

/**
 * A picture added on top. It lives in this browser tab; the server gets it
 * once per editor session (lib/editorAssets) and only ever by id.
 */
export interface EditorPicture {
  id: string;
  file: File;
  name: string;
  /** Object URL for the stage and the layer list. */
  url: string;
  width: number;
  height: number;
}

export interface TextLayer extends FitText {
  kind: "text";
  id: string;
  hidden?: boolean;
}

/** ``x``/``y`` is the centre and ``width``/``height`` the size, as shares of the canvas. */
export interface PictureLayer {
  kind: "image";
  id: string;
  hidden?: boolean;
  picture: EditorPicture;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
}

export type FitLayer = TextLayer | PictureLayer;

export const layerVisible = (layer: FitLayer) =>
  !layer.hidden && (layer.kind === "image" ? layer.opacity > 0 : textVisible(layer));

export function clampPictureLayer(layer: PictureLayer): PictureLayer {
  const round = (value: number) => Math.round(value * 1e5) / 1e5;
  return {
    ...layer,
    x: round(clamp(layer.x, MIN_PLACEMENT_POSITION, MAX_PLACEMENT_POSITION)),
    y: round(clamp(layer.y, MIN_PLACEMENT_POSITION, MAX_PLACEMENT_POSITION)),
    width: round(clamp(layer.width, MIN_LAYER_SIZE, MAX_LAYER_SIZE)),
    height: round(clamp(layer.height, MIN_LAYER_SIZE, MAX_LAYER_SIZE)),
    rotation: normalizeAngle(layer.rotation),
    opacity: Math.round(clamp(layer.opacity, 0, 1) * 100) / 100,
  };
}

export const clampLayer = (layer: FitLayer): FitLayer =>
  layer.kind === "image" ? clampPictureLayer(layer) : { ...layer, ...clampText(layer) };

let layerCounter = 0;
export const newLayerId = (kind: FitLayer["kind"]) =>
  `${kind === "text" ? "t" : "p"}${Date.now().toString(36)}${(layerCounter++).toString(36)}`;

/** One-click starting points for text. */
export const TEXT_STYLES = {
  title: { size: 0.12, bold: true, italic: false, x: 0.5, y: 0.42, align: "center", opacity: 1, shadow: true },
  subtitle: { size: 0.055, bold: false, italic: false, x: 0.5, y: 0.62, align: "center", opacity: 1, shadow: true },
  watermark: { size: 0.035, bold: false, italic: false, x: 0.86, y: 0.93, align: "right", opacity: 0.6, shadow: false },
} as const satisfies Record<string, Partial<FitText>>;
export type TextStyleId = keyof typeof TEXT_STYLES;

/** A picture layer that fits into 40% of the canvas, keeping the picture's shape. */
export function pictureLayerFor(
  picture: EditorPicture,
  canvas: { width: number; height: number },
  offset = 0,
): PictureLayer {
  const fit = Math.min((canvas.width * 0.4) / picture.width, (canvas.height * 0.4) / picture.height);
  return clampPictureLayer({
    kind: "image",
    id: newLayerId("image"),
    picture,
    x: 0.5 + offset,
    y: 0.5 + offset,
    width: (picture.width * fit) / canvas.width,
    height: (picture.height * fit) / canvas.height,
    rotation: 0,
    opacity: 1,
  });
}

/** The layers in the form the API reads (``fit_layers``), with picture ids filled in. */
export function layersPayload(layers: FitLayer[], assetOf: (layer: PictureLayer) => string) {
  return layers.filter(layerVisible).map((layer) => {
    if (layer.kind === "image") {
      return {
        type: "image",
        asset: assetOf(layer),
        x: layer.x,
        y: layer.y,
        width: layer.width,
        height: layer.height,
        rotation: layer.rotation,
        opacity: layer.opacity,
      };
    }
    const { kind: _kind, id: _id, hidden: _hidden, ...text } = layer;
    return { type: "text", ...text };
  });
}

export interface FitOutput {
  width: number;
  height: number;
  mode: FitMode;
  color?: string;
  placement?: FitPlacement;
  /** Left out when the background is plain, so older saved fits stay equal. */
  background?: FitBackground;
  /** Texts and pictures above the image, bottom first; works in every mode. */
  layers?: FitLayer[];
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

/**
 * The placement the backend gets for a mode. Fill frame takes only a tilt:
 * the picture stays centred and is zoomed so it still covers the frame.
 */
export function placementFor(mode: FitMode, placement: FitPlacement | null): FitPlacement | null {
  if (!placement) return null;
  if (placementSupported(mode)) return placement;
  const rotation = normalizeAngle(placement.rotation ?? 0);
  return rotation ? { scale: 1, x: 0.5, y: 0.5, rotation } : null;
}

/** How much Fill frame zooms a picture turned by ``angle`` so no corner is empty. */
export function fillCoverScale(width: number, height: number, angle: number): number {
  const rad = (angle * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  return Math.max((width * cos + height * sin) / width, (width * sin + height * cos) / height);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** Degrees folded into -180 (exclusive) to 180, like the backend. */
export function normalizeAngle(angle: number): number {
  if (!Number.isFinite(angle)) return 0;
  let folded = angle % 360;
  if (folded > 180) folded -= 360;
  else if (folded <= -180) folded += 360;
  return Math.round(folded * 100) / 100 + 0;
}

/**
 * Rotation while dragging the handle: Shift turns in 15° steps, otherwise it
 * clicks onto 0, 90, 180 and 270 when within a few degrees.
 */
export function snapAngle(angle: number, fineSteps: boolean): number {
  if (fineSteps) return normalizeAngle(Math.round(angle / 15) * 15);
  const right = Math.round(angle / 90) * 90;
  return normalizeAngle(Math.abs(angle - right) <= 4 ? right : angle);
}

/** Rounds and keeps a placement inside the limits the backend accepts. */
export function clampPlacement(placement: FitPlacement): FitPlacement {
  const round = (value: number) => Math.round(value * 1e6) / 1e6;
  const rotation = normalizeAngle(placement.rotation ?? 0);
  return {
    scale: round(clamp(placement.scale, MIN_PLACEMENT_SCALE, MAX_PLACEMENT_SCALE)),
    x: round(clamp(placement.x, MIN_PLACEMENT_POSITION, MAX_PLACEMENT_POSITION)),
    y: round(clamp(placement.y, MIN_PLACEMENT_POSITION, MAX_PLACEMENT_POSITION)),
    ...(rotation ? { rotation } : {}),
  };
}

/** Same limits as MIN/MAX_BACKGROUND_SCALE in the backend. */
export const MIN_BACKGROUND_SCALE = 0.1;
export const MAX_BACKGROUND_SCALE = 10;

/** Like clampPlacement for the background picture; null when it is the default. */
export function clampBackgroundPlacement(placement: FitPlacement): FitPlacement | null {
  const clamped = clampPlacement({
    ...placement,
    scale: clamp(placement.scale, MIN_BACKGROUND_SCALE, MAX_BACKGROUND_SCALE),
  });
  return clamped.scale === 1 && clamped.x === 0.5 && clamped.y === 0.5 && !clamped.rotation
    ? null
    : clamped;
}

/**
 * The background picture rectangle (before turning) on the canvas. Same
 * formula as ImageResizer._image_background: scale 1 just covers the canvas.
 */
export function backgroundRect(
  source: { width: number; height: number },
  canvas: { width: number; height: number },
  placement: FitPlacement,
): { left: number; top: number; width: number; height: number } {
  const ratio = Math.max(canvas.width / source.width, canvas.height / source.height) * placement.scale;
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
  /** null = the mode's default blur. */
  blur: number | null;
  tint: number;
  tintColor: string;
  /** Solid mode: fill from ``color`` to ``colorTo`` when on. */
  fillGradient: boolean;
  colorTo: string;
  gradientAngle: number;
  tintGradient: boolean;
  tintColorTo: string;
  tintAngle: number;
}

export const DEFAULT_FIT_SETTINGS: FitSettings = {
  preset: "github-social",
  customWidth: String(FIT_PRESETS["github-social"].width),
  customHeight: String(FIT_PRESETS["github-social"].height),
  mode: "crop",
  color: "#ffffff",
  pattern: "none",
  dim: 0,
  blur: null,
  tint: 0,
  tintColor: DEFAULT_TINT_COLOR,
  fillGradient: false,
  colorTo: DEFAULT_GRADIENT_TO,
  gradientAngle: DEFAULT_GRADIENT_ANGLE,
  tintGradient: false,
  tintColorTo: "#db2777",
  tintAngle: DEFAULT_GRADIENT_ANGLE,
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
  extras: {
    blur?: number | null;
    tint?: number;
    tintColor?: string;
    colorTo?: string | null;
    gradientAngle?: number;
    tintColorTo?: string | null;
    tintAngle?: number;
  } = {},
): FitBackground | undefined {
  const round = (value: number, high: number) => Math.round(clamp(value, 0, high) * 100) / 100;
  const usedPattern = patternSupported(mode) ? pattern : "none";
  const usedDim = dimSupported(mode) ? round(dim, MAX_BACKGROUND_DIM) : 0;
  const usedImage = mode === "image" && image ? image : undefined;
  const blur = blurSupported(mode) && extras.blur != null ? round(extras.blur, 1) : null;
  const usedBlur = blur !== null && blur !== defaultBlur(mode) ? blur : undefined;
  const tint = tintSupported(mode) ? round(extras.tint ?? 0, 1) : 0;
  const opaque = (value?: string | null) => {
    const hex = normalizeHexColor(value ?? "");
    return hex && hex.length === 7 ? hex : null;
  };
  const tintTo = tint > 0 ? opaque(extras.tintColorTo) : null;
  const usedTint =
    tint > 0
      ? {
          color: normalizeHexColor(extras.tintColor ?? "") ?? DEFAULT_TINT_COLOR,
          opacity: tint,
          ...(tintTo
            ? { colorTo: tintTo, angle: normalizeGradientAngle(extras.tintAngle ?? DEFAULT_GRADIENT_ANGLE) }
            : {}),
        }
      : undefined;
  const colorTo = mode === "solid" ? opaque(extras.colorTo) : null;
  if (
    usedPattern === "none" &&
    usedDim === 0 &&
    !usedImage &&
    usedBlur === undefined &&
    !usedTint &&
    !colorTo
  ) {
    return undefined;
  }
  return {
    pattern: usedPattern,
    dim: usedDim,
    ...(usedImage ? { image: usedImage } : {}),
    ...(usedBlur !== undefined ? { blur: usedBlur } : {}),
    ...(usedTint ? { tint: usedTint } : {}),
    ...(colorTo
      ? { colorTo, gradientAngle: normalizeGradientAngle(extras.gradientAngle ?? DEFAULT_GRADIENT_ANGLE) }
      : {}),
  };
}

export function sameBackground(a?: FitBackground, b?: FitBackground): boolean {
  return (
    (a?.pattern ?? "none") === (b?.pattern ?? "none") &&
    (a?.dim ?? 0) === (b?.dim ?? 0) &&
    a?.image?.id === b?.image?.id &&
    a?.blur === b?.blur &&
    a?.tint?.color === b?.tint?.color &&
    (a?.tint?.opacity ?? 0) === (b?.tint?.opacity ?? 0) &&
    a?.tint?.colorTo === b?.tint?.colorTo &&
    a?.tint?.angle === b?.tint?.angle &&
    a?.colorTo === b?.colorTo &&
    a?.gradientAngle === b?.gradientAngle
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
