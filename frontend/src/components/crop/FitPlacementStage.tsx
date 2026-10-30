"use client";

import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  backgroundRect,
  clampBackgroundPlacement,
  clampPlacement,
  clampLayer,
  DEFAULT_PLACEMENT,
  defaultBlur,
  gradientCss,
  layerVisible,
  MAX_LAYER_SIZE,
  MAX_BACKGROUND_SCALE,
  MAX_PLACEMENT_SCALE,
  MAX_TEXT_SIZE,
  MIN_BACKGROUND_SCALE,
  MIN_LAYER_SIZE,
  MIN_PLACEMENT_SCALE,
  MIN_TEXT_SIZE,
  normalizeHexColor,
  placementRect,
  snapAngle,
  TEXT_LINE_HEIGHT,
  TEXT_SHADOW,
  zoomPlacementAt,
  type FitLayer,
  type FitOutput,
  type FitPattern,
  type FitPlacement,
  type FitText,
  type PictureLayer,
  type TextLayer,
  fillCoverScale,
} from "@/lib/fitToSize";
import type { StageSelection } from "./useEditorFit";
import { HANDLE_DEFS, type Handle, type Rect } from "./cropConstants";
import { useModifierLabel } from "./FitPlacementControls";

/** Same look as _BLUR_RADIUS_SHARE and _BLUR_BRIGHTNESS in the backend. */
const BLUR_RADIUS_SHARE = 0.025;
const BLUR_BRIGHTNESS = 0.85;

const HANDLE_DIRECTION: Record<Handle, [number, number]> = {
  nw: [-1, -1],
  n: [0, -1],
  ne: [1, -1],
  e: [1, 0],
  se: [1, 1],
  s: [0, 1],
  sw: [-1, 1],
  w: [-1, 0],
};

/** Same as _PATTERN_CELL_SHARE, _PATTERN_INK_ALPHA and friends in the backend. */
const PATTERN_CELL_SHARE = 1 / 40;
const PATTERN_INK_ALPHA = 41 / 255;
const PATTERN_DOT_RADIUS = 0.22;
const PATTERN_LINE_WIDTH = 0.08;

/** Zoom per wheel pixel and per Ctrl/Cmd + plus or minus. */
const WHEEL_ZOOM_SPEED = 0.0015;
const KEY_ZOOM_STEP = 1.1;

/**
 * CSS for a background pattern over ``color``, sized for a canvas of
 * ``canvas`` target pixels shown at ``pixel`` screen pixels each. Mirrors
 * ImageResizer._pattern_mask; the server preview replaces it once current.
 */
export function patternStyle(
  pattern: FitPattern,
  color: string,
  canvas: { width: number; height: number },
  pixel: number,
): React.CSSProperties | undefined {
  if (pattern === "none") return undefined;
  const hex = (normalizeHexColor(color) ?? "#ffffff").slice(1);
  const full = hex.length <= 4 ? [...hex].map((c) => c + c).join("") : hex;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  const light = 0.2126 * r + 0.7152 * g + 0.0722 * b > 127.5;
  const ink = `rgba(${light ? "0,0,0" : "255,255,255"},${PATTERN_INK_ALPHA.toFixed(3)})`;
  const cell = Math.max(canvas.width, canvas.height) * PATTERN_CELL_SHARE * pixel;
  switch (pattern) {
    case "checker":
      return {
        backgroundImage: `repeating-conic-gradient(${ink} 0 25%, transparent 0 50%)`,
        backgroundSize: `${cell * 2}px ${cell * 2}px`,
      };
    case "dots": {
      const radius = cell * PATTERN_DOT_RADIUS;
      return {
        backgroundImage: `radial-gradient(circle, ${ink} ${radius}px, transparent ${radius + 0.5}px)`,
        backgroundSize: `${cell}px ${cell}px`,
      };
    }
    case "stripes": {
      const period = cell / Math.SQRT2;
      return {
        backgroundImage: `repeating-linear-gradient(135deg, ${ink} 0 ${period / 2}px, transparent ${period / 2}px ${period}px)`,
      };
    }
    case "grid": {
      const line = Math.max(1, cell * PATTERN_LINE_WIDTH);
      return {
        backgroundImage: `linear-gradient(to right, ${ink} ${line}px, transparent ${line}px), linear-gradient(to bottom, ${ink} ${line}px, transparent ${line}px)`,
        backgroundSize: `${cell}px ${cell}px`,
      };
    }
  }
}

/** Object URL for the chosen background picture, released when it changes. */
function useObjectUrl(file: File | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url;
}

/** Rule-of-thirds and centre lines. Only drawn in the editor, never exported. */
function GridOverlay() {
  const thirds = ["33.3333%", "66.6667%"];
  const line = "pointer-events-none absolute";
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0" data-testid="fit-grid-overlay">
      {thirds.map((at) => (
        <React.Fragment key={at}>
          <div className={cn(line, "inset-y-0 w-px bg-white/70 shadow-[0_0_0_0.5px_rgba(0,0,0,0.45)]")} style={{ left: at }} />
          <div className={cn(line, "inset-x-0 h-px bg-white/70 shadow-[0_0_0_0.5px_rgba(0,0,0,0.45)]")} style={{ top: at }} />
        </React.Fragment>
      ))}
      <div className={cn(line, "inset-y-0 left-1/2 border-l border-dashed border-sky-300/80")} />
      <div className={cn(line, "inset-x-0 top-1/2 border-t border-dashed border-sky-300/80")} />
    </div>
  );
}

/** Corner handles only: resizing always keeps the aspect ratio. */
const DOUBLE_TAP_MS = 350;
const DOUBLE_TAP_DISTANCE_PX = 24;
const CORNER_HANDLES = HANDLE_DEFS.filter((h) => h.id.length === 2);

type Size = { width: number; height: number };

/** A layer's footprint in output pixels: centre, unturned size, clockwise angle. */
type Box = { cx: number; cy: number; width: number; height: number; angle: number };

type Gesture = {
  pointerId: number;
  target: StageSelection;
  kind: "move" | "resize" | "rotate";
  handle: Handle | null;
  startX: number;
  startY: number;
  start: FitPlacement;
  startLayer: FitLayer | null;
  /** The layer's footprint in output pixels when the gesture began. */
  startBox: Box;
  /** Pointer angle around the layer centre when a turn began, in degrees. */
  startAngle: number;
  /** Footprints of everything else, for the smart guides. */
  others: Bounds[];
  moved: boolean;
};

type Draft =
  | { target: "image" | "background"; placement: FitPlacement }
  | { target: "layer"; layer: FitLayer };

const DEG = 180 / Math.PI;

type Bounds = { left: number; top: number; width: number; height: number };

const rectBox = (r: Bounds, angle = 0): Box => ({
  cx: r.left + r.width / 2,
  cy: r.top + r.height / 2,
  width: r.width,
  height: r.height,
  angle,
});

/** Whether output point (x, y) lies inside the (turned) box. */
const insideBox = (box: Box, x: number, y: number) => {
  const a = -box.angle / DEG;
  const dx = x - box.cx;
  const dy = y - box.cy;
  const lx = dx * Math.cos(a) - dy * Math.sin(a);
  const ly = dx * Math.sin(a) + dy * Math.cos(a);
  return Math.abs(lx) <= box.width / 2 && Math.abs(ly) <= box.height / 2;
};

/** Axis-aligned bounds of a turned box, used for snapping. */
const boundsOf = (box: Box): Bounds => {
  const a = box.angle / DEG;
  const w = Math.abs(box.width * Math.cos(a)) + Math.abs(box.height * Math.sin(a));
  const h = Math.abs(box.width * Math.sin(a)) + Math.abs(box.height * Math.cos(a));
  return { left: box.cx - w / 2, top: box.cy - h / 2, width: w, height: h };
};

/**
 * Moves and resizes `start` by a pointer delta in output pixels. The aspect
 * ratio always stays locked; edge handles keep the centre on the other axis.
 */
export function dragPlacement(
  start: FitPlacement,
  handle: Handle | null,
  dx: number,
  dy: number,
  source: Size,
  canvas: Size,
): FitPlacement {
  if (!handle) {
    return clampPlacement({
      ...start,
      x: start.x + dx / canvas.width,
      y: start.y + dy / canvas.height,
    });
  }
  const rect = placementRect(source, canvas, start);
  const [hx, hy] = HANDLE_DIRECTION[handle];
  if (start.rotation) {
    const next = resizeTurned(rectBox(rect, start.rotation), hx, hy, dx, dy, start.scale, [
      MIN_PLACEMENT_SCALE,
      MAX_PLACEMENT_SCALE,
    ]);
    return clampPlacement({
      ...start,
      scale: start.scale * next.factor,
      x: next.cx / canvas.width,
      y: next.cy / canvas.height,
    });
  }
  const fx = hx ? 1 + (hx * dx) / rect.width : 0;
  const fy = hy ? 1 + (hy * dy) / rect.height : 0;
  let factor = hx && hy ? Math.max(fx, fy) : hx ? fx : fy;
  factor = Math.min(
    MAX_PLACEMENT_SCALE / start.scale,
    Math.max(MIN_PLACEMENT_SCALE / start.scale, factor),
  );
  const width = rect.width * factor;
  const height = rect.height * factor;
  const left =
    hx > 0 ? rect.left : hx < 0 ? rect.left + rect.width - width : rect.left + (rect.width - width) / 2;
  const top =
    hy > 0 ? rect.top : hy < 0 ? rect.top + rect.height - height : rect.top + (rect.height - height) / 2;
  return clampPlacement({
    scale: start.scale * factor,
    x: (left + width / 2) / canvas.width,
    y: (top + height / 2) / canvas.height,
  });
}

/**
 * Resizes a turned box from a corner: the pointer delta is turned into the
 * box's own axes and the opposite corner stays where it is.
 */
function resizeTurned(
  box: Box,
  hx: number,
  hy: number,
  dx: number,
  dy: number,
  scale: number,
  [low, high]: [number, number],
) {
  const a = box.angle / DEG;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const lx = cos * dx + sin * dy;
  const ly = -sin * dx + cos * dy;
  const fx = hx ? 1 + (hx * lx) / box.width : 0;
  const fy = hy ? 1 + (hy * ly) / box.height : 0;
  let factor = hx && hy ? Math.max(fx, fy) : hx ? fx : fy;
  factor = Math.min(high / scale, Math.max(low / scale, factor));
  const ox = (hx * box.width * (factor - 1)) / 2;
  const oy = (hy * box.height * (factor - 1)) / 2;
  return { factor, cx: box.cx + cos * ox - sin * oy, cy: box.cy + sin * ox + cos * oy };
}

export type SnapGuides = { x: number[]; y: number[] };

/**
 * Offsets that bring a box's centre or edges onto the canvas centre or edges,
 * or onto the centre and edges of the other layers (smart guides).
 */
function snapBounds(
  bounds: Bounds,
  canvas: Size,
  threshold: number,
  others: Bounds[] = [],
) {
  const snapAxis = (start: number, size: number, lines: number[]) => {
    const points = [start, start + size / 2, start + size];
    let best: { offset: number; line: number } | null = null;
    for (const line of lines) {
      for (const point of points) {
        const offset = line - point;
        if (Math.abs(offset) <= threshold && (!best || Math.abs(offset) < Math.abs(best.offset))) {
          best = { offset, line };
        }
      }
    }
    return best;
  };
  const lines = (total: number, pick: (b: Bounds) => [number, number]) => [
    total / 2,
    0,
    total,
    ...others.flatMap((other) => {
      const [start, size] = pick(other);
      return [start, start + size / 2, start + size];
    }),
  ];
  const sx = snapAxis(bounds.left, bounds.width, lines(canvas.width, (b) => [b.left, b.width]));
  const sy = snapAxis(bounds.top, bounds.height, lines(canvas.height, (b) => [b.top, b.height]));
  return {
    dx: sx ? sx.offset : 0,
    dy: sy ? sy.offset : 0,
    guides: { x: sx ? [sx.line] : [], y: sy ? [sy.line] : [] },
  };
}

/**
 * Snaps a moved image to the canvas centre and edges when it comes within
 * `threshold` canvas pixels, and returns the guide lines that matched.
 */
export function snapPlacement(
  placement: FitPlacement,
  source: Size,
  canvas: Size,
  threshold: number,
): { placement: FitPlacement; guides: SnapGuides } {
  const rect = placementRect(source, canvas, placement);
  const snap = snapBounds(boundsOf(rectBox(rect, placement.rotation ?? 0)), canvas, threshold);
  return {
    placement: clampPlacement({
      ...placement,
      x: placement.x + snap.dx / canvas.width,
      y: placement.y + snap.dy / canvas.height,
    }),
    guides: snap.guides,
  };
}

/** Pointer distance, in screen pixels, at which a moved layer snaps. */
const SNAP_DISTANCE_PX = 6;

/** Text keys mirrored from text_overlay.py, drawn at `pixel` screen pixels per output pixel. */
export function textStyle(text: FitText, canvas: Size, pixel: number): React.CSSProperties {
  return {
    left: `${text.x * 100}%`,
    top: `${text.y * 100}%`,
    // Turned about the block centre, like text_overlay.py.
    transform: text.rotation ? `translate(-50%, -50%) rotate(${text.rotation}deg)` : "translate(-50%, -50%)",
    fontFamily: `"imgc-${text.font_id}", sans-serif`,
    fontSize: `${text.size * canvas.height * pixel}px`,
    fontWeight: text.bold ? 700 : 400,
    fontStyle: text.italic ? "italic" : "normal",
    lineHeight: TEXT_LINE_HEIGHT,
    whiteSpace: "pre",
    textAlign: text.align ?? "center",
  };
}

/** Shows `crop` of the image stretched over its parent box. */
function SourceRegion({ imgUrl, imgSize, crop }: { imgUrl: string; imgSize: Size; crop: Rect }) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {React.createElement("img", {
        src: imgUrl,
        alt: "",
        draggable: false,
        className: "absolute max-w-none pointer-events-none select-none",
        style: {
          left: `${(-crop.x / crop.width) * 100}%`,
          top: `${(-crop.y / crop.height) * 100}%`,
          width: `${(imgSize.width / crop.width) * 100}%`,
          height: `${(imgSize.height / crop.height) * 100}%`,
        },
      })}
    </div>
  );
}

/** On touch screens a handle is grabbed in a 44 px area around its small dot. */
const TOUCH_HIT_AREA =
  "pointer-coarse:before:absolute pointer-coarse:before:left-1/2 pointer-coarse:before:top-1/2 pointer-coarse:before:h-11 pointer-coarse:before:w-11 pointer-coarse:before:-translate-x-1/2 pointer-coarse:before:-translate-y-1/2 pointer-coarse:before:content-['']";

/** Selection outline with corner handles and a turn handle, shared by the layers. */
function LayerFrame({
  box,
  canvas,
  prefix,
  selected,
  disabled,
  resizable,
  rotatable,
  onHandle,
  onRotate,
  rect,
  idle = "dashed",
  layerId,
}: {
  box: Box;
  canvas: Size;
  prefix: string;
  selected: boolean;
  /** Unselected look: a faint dashed frame, a hover outline, or nothing. */
  idle?: "dashed" | "hover" | "none";
  disabled: boolean;
  resizable: boolean;
  rotatable: boolean;
  onHandle: (handle: Handle) => (e: React.PointerEvent) => void;
  onRotate: (e: React.PointerEvent) => void;
  rect?: string;
  layerId?: string;
}) {
  const active = selected && !disabled;
  return (
    <div
      className={cn(
        "pointer-events-none absolute",
        selected
          ? "border-2 border-sky-400/90 shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
          : idle === "hover"
            ? "border border-sky-300/80"
            : idle === "dashed"
              ? "border border-dashed border-white/40"
              : "border border-transparent",
      )}
      style={{
        left: `${((box.cx - box.width / 2) / canvas.width) * 100}%`,
        top: `${((box.cy - box.height / 2) / canvas.height) * 100}%`,
        width: `${(box.width / canvas.width) * 100}%`,
        height: `${(box.height / canvas.height) * 100}%`,
        transform: box.angle ? `rotate(${box.angle}deg)` : undefined,
      }}
      data-testid={`${prefix}-frame`}
      data-layer-id={layerId}
      data-selected={selected ? "true" : "false"}
      data-rect={rect}
      data-angle={Math.round(box.angle * 10) / 10}
    >
      {active && rotatable && (
        <>
          <div className="absolute bottom-full left-1/2 h-4 w-px -translate-x-1/2 bg-sky-400/90" />
          <div
            onPointerDown={onRotate}
            data-testid={`${prefix}-rotate-handle`}
            className={cn(
              "pointer-events-auto absolute bottom-full left-1/2 mb-4 h-3.5 w-3.5 -translate-x-1/2 translate-y-1/2 cursor-grab rounded-full border border-white/90 bg-sky-400/90 active:cursor-grabbing",
              TOUCH_HIT_AREA,
            )}
          />
        </>
      )}
      {active &&
        resizable &&
        CORNER_HANDLES.map((h) => (
          <div
            key={h.id}
            onPointerDown={onHandle(h.id)}
            data-testid={`${prefix}-handle-${h.id}`}
            className={cn(
              "pointer-events-auto absolute h-3 w-3 rounded-sm border border-white/90 bg-sky-400/90",
              TOUCH_HIT_AREA,
              h.classes,
              h.cursor,
            )}
          />
        ))}
    </div>
  );
}

const isLayerId = (selection: StageSelection): selection is string =>
  !!selection && selection !== "image" && selection !== "background";

const pictureBox = (layer: PictureLayer, canvas: Size): Box => ({
  cx: layer.x * canvas.width,
  cy: layer.y * canvas.height,
  width: layer.width * canvas.width,
  height: layer.height * canvas.height,
  angle: layer.rotation,
});

/**
 * Free resize from a corner (Shift): each side follows the pointer along the
 * box's own axes and the opposite corner stays where it is.
 */
export function resizeFree(box: Box, hx: number, hy: number, dx: number, dy: number, min: number) {
  const a = box.angle / DEG;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const lx = cos * dx + sin * dy;
  const ly = -sin * dx + cos * dy;
  const width = Math.max(min, box.width + hx * lx);
  const height = Math.max(min, box.height + hy * ly);
  const ox = (hx * (width - box.width)) / 2;
  const oy = (hy * (height - box.height)) / 2;
  return { width, height, cx: box.cx + cos * ox - sin * oy, cy: box.cy + sin * ox + cos * oy };
}

/**
 * Lightweight layer editor: the output canvas drawn with CSS so dragging
 * gives instant feedback, and the server preview on top once it is current.
 * Everything is picked by clicking it; the topmost layer wins.
 */
export function FitPlacementStage({
  imgUrl,
  imgSize,
  crop,
  fit,
  placement,
  onChange,
  backgroundPlacement = null,
  onBackgroundChange,
  layers = [],
  onLayerChange,
  onRemoveLayer,
  onDuplicateLayer,
  onEditText,
  selected = null,
  onSelect,
  baseLocked = false,
  preview,
  previewCurrent,
  box,
  disabled,
  previewAlt,
  showGrid = false,
}: {
  imgUrl: string;
  imgSize: Size;
  crop: Rect;
  fit: FitOutput;
  placement: FitPlacement | null;
  onChange: (placement: FitPlacement) => void;
  backgroundPlacement?: FitPlacement | null;
  onBackgroundChange?: (placement: FitPlacement | null) => void;
  /** Texts and pictures above the image, bottom first. Hidden ones are skipped. */
  layers?: FitLayer[];
  onLayerChange?: (id: string, layer: Partial<FitLayer>, kind?: string) => void;
  onRemoveLayer?: (id: string) => void;
  onDuplicateLayer?: (id: string) => void;
  /** Double-click on a text: the side panel focuses its field. */
  onEditText?: (id: string) => void;
  selected?: StageSelection;
  onSelect?: (selection: StageSelection) => void;
  /** "Crop" mode: the image fills the canvas and cannot be moved, only the layers can. */
  baseLocked?: boolean;
  preview: string | null;
  previewCurrent: boolean;
  box: Size;
  disabled: boolean;
  previewAlt: string;
  showGrid?: boolean;
}) {
  const { t } = useTranslation();
  const mod = useModifierLabel();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [guides, setGuides] = useState<SnapGuides | null>(null);
  const [hovered, setHovered] = useState<StageSelection>(null);
  const [backgroundSize, setBackgroundSize] = useState<Size | null>(null);
  const gesture = useRef<Gesture | null>(null);
  // Touch: fingers on the stage, a two-finger pinch and the last tap (for double-tap).
  const touches = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number } | null>(null);
  const lastTap = useRef<{ time: number; x: number; y: number } | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const textRefs = useRef(new Map<string, HTMLDivElement>());
  const backgroundFile = fit.mode === "image" ? fit.background?.image?.file : undefined;
  const backgroundUrl = useObjectUrl(backgroundFile);
  useEffect(() => setBackgroundSize(null), [backgroundFile]);
  const canvas = { width: fit.width, height: fit.height };
  const source = { width: crop.width, height: crop.height };
  const pixel = box.width / canvas.width;
  const percent = (value: number, total: number) => `${(value / total) * 100}%`;

  // Fill frame only tilts the image: it stays centred, zoomed to keep covering the frame.
  const tilt = baseLocked
    ? (draft?.target === "image" ? draft.placement.rotation : placement?.rotation) ?? 0
    : 0;
  const current = baseLocked
    ? { scale: fillCoverScale(fit.width, fit.height, tilt), x: 0.5, y: 0.5, ...(tilt ? { rotation: tilt } : {}) }
    : draft?.target === "image" ? draft.placement : placement ?? DEFAULT_PLACEMENT;
  const currentBackground =
    draft?.target === "background" ? draft.placement : backgroundPlacement ?? DEFAULT_PLACEMENT;
  const currentLayers = layers.map((layer) =>
    draft?.target === "layer" && draft.layer.id === layer.id ? draft.layer : layer,
  );
  const shownLayers = currentLayers.filter(layerVisible);
  const hasBackground = !!backgroundUrl && !!backgroundSize && !!onBackgroundChange;
  // What the selection means right now: a hidden or removed layer, or a
  // background picture that is not there, selects nothing.
  const selection: StageSelection = isLayerId(selected)
    ? shownLayers.some((layer) => layer.id === selected) ? selected : null
    : selected === "background"
      ? hasBackground ? "background" : null
      : selected === "image"
        ? "image"
        : null;
  const selectedLayer = isLayerId(selection)
    ? shownLayers.find((layer) => layer.id === selection) ?? null
    : null;
  // Zoom and arrow keys work on the image when nothing is picked.
  const keyTarget: StageSelection = selection ?? (baseLocked ? null : "image");

  const rect = placementRect(source, canvas, current);
  const imageBox = rectBox(rect, current.rotation ?? 0);
  // In Fill frame the turn handle sits on the frame itself, turned with the image.
  const frameBox: Box = { cx: canvas.width / 2, cy: canvas.height / 2, ...canvas, angle: tilt };
  const backgroundBox = backgroundSize
    ? rectBox(backgroundRect(backgroundSize, canvas, currentBackground), currentBackground.rotation ?? 0)
    : null;
  const cover = placementRect(source, canvas, {
    scale: Math.max(canvas.width / source.width, canvas.height / source.height) /
      Math.min(canvas.width / source.width, canvas.height / source.height),
    x: 0.5,
    y: 0.5,
  });
  const textBoxOf = (layer: FitText & { id: string }): Box => {
    const el = textRefs.current.get(layer.id);
    const size = el ? { width: el.offsetWidth / pixel, height: el.offsetHeight / pixel } : { width: 0, height: 0 };
    return { cx: layer.x * canvas.width, cy: layer.y * canvas.height, ...size, angle: layer.rotation ?? 0 };
  };
  const layerBox = (layer: FitLayer): Box =>
    layer.kind === "image" ? pictureBox(layer, canvas) : textBoxOf(layer);
  const boxOf = (target: StageSelection): Box | null => {
    if (target === "image") return baseLocked ? frameBox : imageBox;
    if (target === "background") return backgroundBox;
    const layer = shownLayers.find((item) => item.id === target);
    return layer ? layerBox(layer) : null;
  };

  // Same mapping as ImageResizer.blur_radius: linear in the strength, the
  // blur mode default (0.25) is the radius it always had.
  const blurStrength = fit.background?.blur ?? defaultBlur(fit.mode);
  const blurRadius =
    Math.max(2, Math.max(canvas.width, canvas.height) * BLUR_RADIUS_SHARE) * pixel * (blurStrength / 0.25);
  const tint = fit.background?.tint;
  const showPreview = !!preview && previewCurrent && !draft;
  const dim = fit.background?.dim ?? 0;

  /** The topmost thing under an output point: layers (top first), the image, the background. */
  const hitAt = (x: number, y: number): StageSelection => {
    for (let i = shownLayers.length - 1; i >= 0; i--) {
      if (insideBox(layerBox(shownLayers[i]), x, y)) return shownLayers[i].id;
    }
    if (insideBox(baseLocked ? frameBox : imageBox, x, y)) return "image";
    if (hasBackground) return "background";
    return null;
  };
  const toOutput = (e: { clientX: number; clientY: number }) => {
    const bounds = stageRef.current?.getBoundingClientRect();
    return bounds
      ? { x: (e.clientX - bounds.left) / pixel, y: (e.clientY - bounds.top) / pixel }
      : { x: 0, y: 0 };
  };

  const zoomLayer = (which: StageSelection, factor: number, anchor: { x: number; y: number } | null) => {
    const state = latest.current;
    if (isLayerId(which)) {
      const layer = state.layers.find((item) => item.id === which);
      if (!layer || !state.onLayerChange) return;
      let next: FitLayer;
      if (layer.kind === "text") {
        next = { ...layer, size: Math.min(MAX_TEXT_SIZE, Math.max(MIN_TEXT_SIZE, layer.size * factor)) };
      } else {
        const largest = Math.max(layer.width, layer.height);
        const smallest = Math.min(layer.width, layer.height);
        const applied = Math.min(MAX_LAYER_SIZE / largest, Math.max(MIN_LAYER_SIZE / smallest, factor));
        const at = anchor ?? { x: layer.x * canvas.width, y: layer.y * canvas.height };
        next = {
          ...layer,
          width: layer.width * applied,
          height: layer.height * applied,
          x: (at.x + (layer.x * canvas.width - at.x) * applied) / canvas.width,
          y: (at.y + (layer.y * canvas.height - at.y) * applied) / canvas.height,
        };
      }
      next = clampLayer(next);
      // Wheel events can arrive faster than React re-renders; build on this one.
      state.layers = state.layers.map((item) => (item.id === which ? next : item));
      state.onLayerChange(which, next, `zoom:${which}`);
    } else if (which === "background") {
      if (!state.onBackgroundChange) return;
      const start = state.backgroundPlacement ?? DEFAULT_PLACEMENT;
      const scale = Math.min(MAX_BACKGROUND_SCALE, Math.max(MIN_BACKGROUND_SCALE, start.scale * factor));
      const applied = scale / start.scale;
      const at = anchor ?? { x: start.x * canvas.width, y: start.y * canvas.height };
      const next = {
        ...start,
        scale,
        x: (at.x + (start.x * canvas.width - at.x) * applied) / canvas.width,
        y: (at.y + (start.y * canvas.height - at.y) * applied) / canvas.height,
      };
      state.backgroundPlacement = clampBackgroundPlacement(next);
      state.onBackgroundChange(state.backgroundPlacement);
    } else if (which === "image" && !baseLocked) {
      const start = state.placement ?? DEFAULT_PLACEMENT;
      const next = anchor
        ? zoomPlacementAt(start, factor, anchor, canvas)
        : clampPlacement({ ...start, scale: start.scale * factor });
      state.placement = next;
      state.onChange(next);
    }
  };

  // Ctrl/Cmd + wheel (and trackpad pinch, which browsers report the same way)
  // zooms the selected layer around the cursor. A native listener, because
  // React's wheel handler is passive and could not stop the page from zooming.
  const latest = useRef({
    placement,
    onChange,
    backgroundPlacement,
    onBackgroundChange,
    layers,
    onLayerChange,
    disabled,
    pixel,
    keyTarget,
    zoomLayer,
  });
  latest.current = {
    placement,
    onChange,
    backgroundPlacement,
    onBackgroundChange,
    layers,
    onLayerChange,
    disabled,
    pixel,
    keyTarget,
    zoomLayer,
  };
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const { disabled, pixel, keyTarget, zoomLayer } = latest.current;
      if (disabled || gesture.current) return;
      const bounds = stage.getBoundingClientRect();
      const lines = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? bounds.height : 1;
      const factor = Math.exp(-e.deltaY * lines * WHEEL_ZOOM_SPEED);
      zoomLayer(keyTarget, factor, {
        x: (e.clientX - bounds.left) / pixel,
        y: (e.clientY - bounds.top) / pixel,
      });
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, []);

  const startGesture = (
    e: React.PointerEvent,
    target: StageSelection,
    kind: Gesture["kind"],
    handle: Handle | null,
  ) => {
    const startBox = boxOf(target);
    if (!startBox) return;
    e.preventDefault();
    e.stopPropagation();
    // preventDefault above also stops the browser from focusing the stage,
    // and the keyboard shortcuts need it focused.
    stageRef.current?.focus({ preventScroll: true });
    stageRef.current?.setPointerCapture?.(e.pointerId);
    const at = toOutput(e);
    const others = shownLayers.filter((layer) => layer.id !== target).map((layer) => boundsOf(layerBox(layer)));
    if (target !== "image" && !baseLocked) others.push(boundsOf(imageBox));
    gesture.current = {
      pointerId: e.pointerId,
      target,
      kind,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      start: target === "background" ? currentBackground : current,
      startLayer: isLayerId(target) ? shownLayers.find((layer) => layer.id === target) ?? null : null,
      startBox,
      startAngle: Math.atan2(at.y - startBox.cy, at.x - startBox.cx) * DEG,
      others,
      moved: false,
    };
    if (target !== selection) onSelect?.(target);
  };

  const beginStage = (e: React.PointerEvent) => {
    if (disabled || e.button !== 0) return;
    const at = toOutput(e);
    // Dragging inside the selected layer moves it, even where another layer
    // lies on top; elsewhere the topmost layer under the pointer is picked.
    const own = boxOf(selection);
    const target = own && insideBox(own, at.x, at.y) ? selection : hitAt(at.x, at.y);
    if (!target) {
      onSelect?.(null);
      stageRef.current?.focus({ preventScroll: true });
      return;
    }
    startGesture(e, target, "move", null);
  };
  const beginHandle = (target: StageSelection) => (handle: Handle) => (e: React.PointerEvent) => {
    if (disabled || e.button !== 0) return;
    startGesture(e, target, "resize", handle);
  };
  const beginRotate = (target: StageSelection) => (e: React.PointerEvent) => {
    if (disabled || e.button !== 0) return;
    startGesture(e, target, "rotate", null);
  };

  // A second finger turns the drag into a pinch that zooms like Ctrl + wheel.
  const trackTouch = (e: React.PointerEvent) => {
    if (e.pointerType !== "touch" || disabled) return;
    touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.current.size < 2) return;
    e.preventDefault();
    e.stopPropagation();
    if (touches.current.size > 2 || pinch.current) return;
    stageRef.current?.setPointerCapture?.(e.pointerId);
    gesture.current = null;
    setDraft(null);
    setGuides(null);
    const [a, b] = [...touches.current.values()];
    pinch.current = { distance: Math.hypot(a.x - b.x, a.y - b.y) };
  };

  const movePinch = (e: React.PointerEvent): boolean => {
    if (e.pointerType !== "touch" || !touches.current.has(e.pointerId)) return false;
    touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const active = pinch.current;
    if (!active || touches.current.size < 2) return false;
    const [a, b] = [...touches.current.values()];
    const distance = Math.hypot(a.x - b.x, a.y - b.y);
    const bounds = stageRef.current?.getBoundingClientRect();
    if (bounds && distance > 0 && active.distance > 0 && distance !== active.distance) {
      zoomLayer(keyTarget, distance / active.distance, {
        x: ((a.x + b.x) / 2 - bounds.left) / pixel,
        y: ((a.y + b.y) / 2 - bounds.top) / pixel,
      });
    }
    active.distance = distance;
    return true;
  };

  const releaseTouch = (e: React.PointerEvent) => {
    if (e.pointerType !== "touch") return;
    touches.current.delete(e.pointerId);
    if (touches.current.size < 2) pinch.current = null;
  };

  /** Two taps on a text layer open it for editing, like a double-click. */
  const checkDoubleTap = (e: React.PointerEvent) => {
    const now = e.timeStamp;
    const previous = lastTap.current;
    lastTap.current = { time: now, x: e.clientX, y: e.clientY };
    if (!previous || now - previous.time > DOUBLE_TAP_MS) return;
    if (Math.hypot(e.clientX - previous.x, e.clientY - previous.y) > DOUBLE_TAP_DISTANCE_PX) return;
    lastTap.current = null;
    const at = toOutput(e);
    const layer = shownLayers.find((item) => item.id === hitAt(at.x, at.y));
    if (layer?.kind === "text") onEditText?.(layer.id);
  };

  const move = (e: React.PointerEvent) => {
    if (movePinch(e)) return;
    const active = gesture.current;
    if (!active) {
      if (!disabled && e.pointerType === "mouse") {
        const at = toOutput(e);
        setHovered(hitAt(at.x, at.y));
      }
      return;
    }
    if (active.pointerId !== e.pointerId) return;
    let dx = (e.clientX - active.startX) / pixel;
    let dy = (e.clientY - active.startY) / pixel;
    if (!active.moved && dx === 0 && dy === 0) return;
    active.moved = true;
    // Shift while moving keeps to the axis the pointer went furthest along.
    const lockAxis = active.kind === "move" && e.shiftKey ? (Math.abs(dx) >= Math.abs(dy) ? "x" : "y") : null;
    if (lockAxis === "x") dy = 0;
    if (lockAxis === "y") dx = 0;
    const threshold = SNAP_DISTANCE_PX / pixel;
    const snapMoved = (moved: Box) => {
      if (e.altKey) return { dx: 0, dy: 0, guides: null };
      const snap = snapBounds(boundsOf(moved), canvas, threshold, active.others);
      return {
        dx: lockAxis === "y" ? 0 : snap.dx,
        dy: lockAxis === "x" ? 0 : snap.dy,
        guides: {
          x: lockAxis === "y" ? [] : snap.guides.x,
          y: lockAxis === "x" ? [] : snap.guides.y,
        },
      };
    };
    const startBox = active.startBox;
    const layer = active.startLayer;
    if (layer) {
      let next: FitLayer;
      let found: SnapGuides | null = null;
      if (active.kind === "rotate") {
        const at = toOutput(e);
        const angle = Math.atan2(at.y - startBox.cy, at.x - startBox.cx) * DEG;
        next = { ...layer, rotation: snapAngle((layer.rotation ?? 0) + angle - active.startAngle, e.shiftKey) };
      } else if (active.kind === "resize" && active.handle) {
        const [hx, hy] = HANDLE_DIRECTION[active.handle];
        if (layer.kind === "text") {
          const resized = resizeTurned(startBox, hx, hy, dx, dy, layer.size, [MIN_TEXT_SIZE, MAX_TEXT_SIZE]);
          next = {
            ...layer,
            size: layer.size * resized.factor,
            x: resized.cx / canvas.width,
            y: resized.cy / canvas.height,
          };
        } else if (e.shiftKey) {
          const min = MIN_LAYER_SIZE * Math.max(canvas.width, canvas.height);
          const resized = resizeFree(startBox, hx, hy, dx, dy, min);
          next = {
            ...layer,
            x: resized.cx / canvas.width,
            y: resized.cy / canvas.height,
            width: resized.width / canvas.width,
            height: resized.height / canvas.height,
          };
        } else {
          const low = MIN_LAYER_SIZE / Math.min(layer.width, layer.height);
          const high = MAX_LAYER_SIZE / Math.max(layer.width, layer.height);
          const resized = resizeTurned(startBox, hx, hy, dx, dy, 1, [low, high]);
          next = {
            ...layer,
            x: resized.cx / canvas.width,
            y: resized.cy / canvas.height,
            width: layer.width * resized.factor,
            height: layer.height * resized.factor,
          };
        }
      } else {
        const snap = snapMoved({ ...startBox, cx: startBox.cx + dx, cy: startBox.cy + dy });
        next = {
          ...layer,
          x: layer.x + (dx + snap.dx) / canvas.width,
          y: layer.y + (dy + snap.dy) / canvas.height,
        };
        found = snap.guides;
      }
      setDraft({ target: "layer", layer: clampLayer(next) });
      setGuides(found);
      return;
    }
    // Fill frame: the image can only be turned, not moved or resized.
    if (active.target === "image" && baseLocked && active.kind !== "rotate") return;
    const start = active.start;
    const footprint = (value: FitPlacement) =>
      active.target === "background" && backgroundSize
        ? rectBox(backgroundRect(backgroundSize, canvas, value), value.rotation ?? 0)
        : rectBox(placementRect(source, canvas, value), value.rotation ?? 0);
    let next: FitPlacement;
    if (active.kind === "rotate") {
      const at = toOutput(e);
      const angle = Math.atan2(at.y - startBox.cy, at.x - startBox.cx) * DEG;
      next = { ...start, rotation: snapAngle((start.rotation ?? 0) + angle - active.startAngle, e.shiftKey) };
    } else if (active.target === "image") {
      next = dragPlacement(start, active.handle, dx, dy, source, canvas);
    } else if (active.handle) {
      const [hx, hy] = HANDLE_DIRECTION[active.handle];
      const resized = resizeTurned(startBox, hx, hy, dx, dy, start.scale, [
        MIN_BACKGROUND_SCALE,
        MAX_BACKGROUND_SCALE,
      ]);
      next = {
        ...start,
        scale: start.scale * resized.factor,
        x: resized.cx / canvas.width,
        y: resized.cy / canvas.height,
      };
    } else {
      next = { ...start, x: start.x + dx / canvas.width, y: start.y + dy / canvas.height };
    }
    let found: SnapGuides | null = null;
    // Moving snaps to the canvas and the other layers; hold Alt to place freely.
    if (active.kind === "move") {
      const snap = snapMoved(footprint(next));
      next = { ...next, x: next.x + snap.dx / canvas.width, y: next.y + snap.dy / canvas.height };
      found = snap.guides;
    }
    setDraft(
      active.target === "image"
        ? { target: "image", placement: clampPlacement(next) }
        : { target: "background", placement: clampBackgroundPlacement(next) ?? { ...DEFAULT_PLACEMENT } },
    );
    setGuides(found);
  };

  const end = (e: React.PointerEvent) => {
    releaseTouch(e);
    const active = gesture.current;
    if (!active || active.pointerId !== e.pointerId) return;
    gesture.current = null;
    if (e.pointerType === "touch" && !active.moved && e.type !== "pointercancel" && !disabled) checkDoubleTap(e);
    if (draft && active.moved && e.type !== "pointercancel") {
      if (draft.target === "layer") onLayerChange?.(draft.layer.id, draft.layer, `stage:${draft.layer.id}`);
      else if (draft.target === "background") onBackgroundChange?.(clampBackgroundPlacement(draft.placement));
      else if (baseLocked) onChange(clampPlacement({ ...(placement ?? DEFAULT_PLACEMENT), rotation: draft.placement.rotation ?? 0 }));
      else onChange(draft.placement);
    }
    setDraft(null);
    setGuides(null);
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    if (disabled) return;
    const at = toOutput(e);
    const hit = hitAt(at.x, at.y);
    const layer = shownLayers.find((item) => item.id === hit);
    if (layer?.kind === "text") onEditText?.(layer.id);
  };

  const nudgeTarget = (target: StageSelection, dx: number, dy: number) => {
    if (isLayerId(target)) {
      const layer = currentLayers.find((item) => item.id === target);
      if (layer) {
        onLayerChange?.(
          layer.id,
          { x: layer.x + dx / canvas.width, y: layer.y + dy / canvas.height },
          `nudge:${layer.id}`,
        );
      }
    } else if (target === "background") {
      const start = backgroundPlacement ?? DEFAULT_PLACEMENT;
      onBackgroundChange?.(
        clampBackgroundPlacement({ ...start, x: start.x + dx / canvas.width, y: start.y + dy / canvas.height }),
      );
    } else if (target === "image" && !baseLocked) {
      onChange(dragPlacement(placement ?? DEFAULT_PLACEMENT, null, dx, dy, source, canvas));
    }
  };

  const resetTarget = (target: StageSelection) => {
    if (target === "background") onBackgroundChange?.(null);
    else if (target === "image") onChange({ ...DEFAULT_PLACEMENT });
    else if (selectedLayer?.kind === "text") onLayerChange?.(selectedLayer.id, { x: 0.5, y: 0.5, rotation: 0 });
    else if (selectedLayer?.kind === "image") {
      // Straight again, with the picture's own shape at the current width.
      const { picture } = selectedLayer;
      const height = (selectedLayer.width * canvas.width * picture.height) / picture.width / canvas.height;
      onLayerChange?.(selectedLayer.id, { rotation: 0, height });
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "Escape") {
      if (selection) {
        e.preventDefault();
        e.stopPropagation();
        onSelect?.(null);
      }
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      const key = e.key.toLowerCase();
      if (key === "d") {
        // Also keeps the browser's bookmark dialog away while editing.
        e.preventDefault();
        if (selectedLayer) onDuplicateLayer?.(selectedLayer.id);
        return;
      }
      if ((key === "b" || key === "i") && selectedLayer?.kind === "text") {
        e.preventDefault();
        onLayerChange?.(
          selectedLayer.id,
          key === "b" ? { bold: !selectedLayer.bold } : { italic: !selectedLayer.italic },
        );
        return;
      }
      // Photoshop-style: plus and minus zoom the selected layer, 0 resets it.
      // Handled here only, so the browser zoom keeps working elsewhere.
      const zoom =
        e.key === "+" || e.key === "=" ? KEY_ZOOM_STEP : e.key === "-" || e.key === "_" ? 1 / KEY_ZOOM_STEP : null;
      if (zoom) {
        e.preventDefault();
        zoomLayer(keyTarget, zoom, null);
      } else if (e.key === "0") {
        e.preventDefault();
        resetTarget(keyTarget);
      }
      return;
    }
    if ((e.key === "Delete" || e.key === "Backspace") && selectedLayer) {
      e.preventDefault();
      onRemoveLayer?.(selectedLayer.id);
      return;
    }
    const step = e.shiftKey ? 10 : 1;
    const nudge: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    if (!nudge[e.key] || !keyTarget) return;
    e.preventDefault();
    nudgeTarget(keyTarget, ...nudge[e.key]);
  };

  const backgroundStyle: React.CSSProperties = {};
  if (backgroundBox) {
    backgroundStyle.left = percent(backgroundBox.cx - backgroundBox.width / 2, canvas.width);
    backgroundStyle.top = percent(backgroundBox.cy - backgroundBox.height / 2, canvas.height);
    backgroundStyle.width = percent(backgroundBox.width, canvas.width);
    backgroundStyle.height = percent(backgroundBox.height, canvas.height);
  }
  const turns = [
    backgroundBox?.angle ? `rotate(${backgroundBox.angle}deg)` : "",
    blurRadius > 0 ? "scale(1.06)" : "",
  ].filter(Boolean);
  if (turns.length) backgroundStyle.transform = turns.join(" ");
  if (blurRadius > 0) backgroundStyle.filter = `blur(${blurRadius}px)`;

  const fill = fit.background?.colorTo && fit.mode === "solid" && fit.color
    ? gradientCss(fit.color, fit.background.colorTo, fit.background.gradientAngle ?? 180)
    : null;
  const boxStyle = (value: Box): React.CSSProperties => ({
    left: percent(value.cx - value.width / 2, canvas.width),
    top: percent(value.cy - value.height / 2, canvas.height),
    width: percent(value.width, canvas.width),
    height: percent(value.height, canvas.height),
    transform: value.angle ? `rotate(${value.angle}deg)` : undefined,
  });
  const textLook = (layer: TextLayer): React.CSSProperties => ({
    ...textStyle(layer, canvas, pixel),
    color: layer.color,
    opacity: layer.opacity,
    textShadow: layer.shadow ? TEXT_SHADOW : undefined,
  });

  return (
    <div
      ref={stageRef}
      data-fit-stage
      data-testid="fit-placement-stage"
      data-layer={selection ?? "none"}
      data-has-selection={selection ? "true" : "false"}
      role="application"
      aria-label={t("crop.fit.placement.stageLabel", { mod })}
      aria-disabled={disabled || undefined}
      tabIndex={0}
      className={cn(
        "relative touch-none select-none rounded-md outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2",
        disabled ? "cursor-default" : hovered || gesture.current ? "cursor-move" : "cursor-default",
      )}
      style={{ width: `${box.width}px`, height: `${box.height}px` }}
      onKeyDown={onKeyDown}
      onPointerDownCapture={trackTouch}
      onPointerDown={beginStage}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      onPointerLeave={() => setHovered(null)}
      onDoubleClick={onDoubleClick}
    >
      <div
        className={cn(
          "absolute inset-0 overflow-hidden rounded-md",
          fit.mode === "transparent" &&
            "bg-[repeating-conic-gradient(#80808040_0%_25%,transparent_0%_50%)] bg-[size:16px_16px]",
        )}
        style={
          fit.mode === "solid"
            ? { backgroundColor: fit.color, ...(fill ? { backgroundImage: fill } : {}) }
            : fit.mode === "image"
              ? { backgroundColor: "#ffffff" }
              : undefined
        }
        data-testid="fit-placement-canvas"
        data-gradient={fill ?? undefined}
      >
        {fit.mode === "solid" && fit.background && fit.background.pattern !== "none" && (
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={patternStyle(fit.background.pattern, fit.color ?? "#ffffff", canvas, pixel)}
            data-testid="fit-pattern-layer"
            data-pattern={fit.background.pattern}
          />
        )}
        {fit.mode === "image" && backgroundUrl && (
          <img
            src={backgroundUrl}
            alt=""
            draggable={false}
            onLoad={(e) =>
              setBackgroundSize({
                width: e.currentTarget.naturalWidth,
                height: e.currentTarget.naturalHeight,
              })
            }
            className={cn(
              "pointer-events-none absolute max-w-none",
              !backgroundBox && "inset-0 h-full w-full object-cover",
            )}
            style={backgroundStyle}
            data-testid="fit-background-image"
          />
        )}
        {fit.mode === "blur" && (
          <div
            className="absolute"
            style={{
              left: percent(cover.left, canvas.width),
              top: percent(cover.top, canvas.height),
              width: percent(cover.width, canvas.width),
              height: percent(cover.height, canvas.height),
              filter: `${blurRadius > 0 ? `blur(${blurRadius}px) ` : ""}brightness(${BLUR_BRIGHTNESS})`,
              transform: "scale(1.06)",
            }}
          >
            <SourceRegion imgUrl={imgUrl} imgSize={imgSize} crop={crop} />
          </div>
        )}
        {tint && tint.opacity > 0 && (
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              backgroundColor: tint.color,
              ...(tint.colorTo ? { backgroundImage: gradientCss(tint.color, tint.colorTo, tint.angle ?? 180) } : {}),
              opacity: tint.opacity,
            }}
            data-testid="fit-tint-layer"
          />
        )}
        {dim > 0 && (
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{ backgroundColor: `rgba(0,0,0,${dim})` }}
            data-testid="fit-dim-layer"
          />
        )}
        <div className="absolute" style={boxStyle(imageBox)}>
          <SourceRegion imgUrl={imgUrl} imgSize={imgSize} crop={crop} />
        </div>
        {shownLayers.map((layer) =>
          layer.kind === "image" ? (
            <img
              key={layer.id}
              src={layer.picture.url}
              alt=""
              draggable={false}
              className="pointer-events-none absolute max-w-none select-none"
              style={{ ...boxStyle(pictureBox(layer, canvas)), opacity: layer.opacity }}
              data-testid="fit-picture-layer"
              data-layer-id={layer.id}
            />
          ) : (
            <div
              key={layer.id}
              aria-hidden="true"
              className="pointer-events-none absolute"
              style={textLook(layer)}
              data-testid="fit-text-layer"
              data-layer-id={layer.id}
            >
              {layer.text}
            </div>
          ),
        )}
        {preview && (
          // The server render replaces the CSS approximation once it matches.
          <img
            src={preview}
            alt={previewAlt}
            draggable={false}
            className={cn(
              "pointer-events-none absolute inset-0 h-full w-full transition-opacity duration-150",
              showPreview ? "opacity-100" : "opacity-0",
            )}
            data-testid="crop-blur-canvas"
            data-current={showPreview ? "true" : "false"}
          />
        )}
      </div>
      {showGrid && <GridOverlay />}
      {guides &&
        [
          ...guides.x.map((line) => ({ key: `x${line}`, vertical: true, line })),
          ...guides.y.map((line) => ({ key: `y${line}`, vertical: false, line })),
        ].map(({ key, vertical, line }) => (
          <div
            key={key}
            aria-hidden="true"
            className="pointer-events-none absolute bg-fuchsia-400/90"
            style={
              vertical
                ? { left: percent(line, canvas.width), top: 0, bottom: 0, width: 1 }
                : { top: percent(line, canvas.height), left: 0, right: 0, height: 1 }
            }
            data-testid={`fit-snap-guide-${vertical ? "x" : "y"}`}
          />
        ))}
      {hasBackground && backgroundBox && selection === "background" && (
        <LayerFrame
          box={backgroundBox}
          canvas={canvas}
          prefix="fit-background"
          selected
          disabled={disabled}
          resizable
          rotatable
          onHandle={beginHandle("background")}
          onRotate={beginRotate("background")}
        />
      )}
      {baseLocked && selection === "image" && (
        <LayerFrame
          box={frameBox}
          canvas={canvas}
          prefix="fit-placement"
          selected
          disabled={disabled}
          resizable={false}
          rotatable
          onHandle={beginHandle("image")}
          onRotate={beginRotate("image")}
        />
      )}
      {!baseLocked && (
        <LayerFrame
          box={imageBox}
          canvas={canvas}
          prefix="fit-placement"
          selected={selection === "image"}
          idle={hovered === "image" ? "hover" : "dashed"}
          disabled={disabled}
          resizable
          rotatable
          onHandle={beginHandle("image")}
          onRotate={beginRotate("image")}
          rect={[rect.left, rect.top, rect.width, rect.height].map(Math.round).join(",")}
        />
      )}
      {shownLayers.map((layer) => {
        const isSelected = selection === layer.id;
        if (layer.kind === "image") {
          if (!isSelected && hovered !== layer.id) return null;
          return (
            <LayerFrame
              key={layer.id}
              box={pictureBox(layer, canvas)}
              canvas={canvas}
              prefix={isSelected ? "fit-layer" : "fit-layer-hover"}
              layerId={layer.id}
              selected={isSelected}
              idle="hover"
              disabled={disabled}
              resizable
              rotatable
              onHandle={beginHandle(layer.id)}
              onRotate={beginRotate(layer.id)}
            />
          );
        }
        // Invisible copy of the text: measures it for picking and outlines it.
        return (
          <div
            key={layer.id}
            ref={(el) => {
              if (el) textRefs.current.set(layer.id, el);
              else textRefs.current.delete(layer.id);
            }}
            className={cn(
              "pointer-events-none absolute text-transparent",
              isSelected
                ? "outline outline-2 outline-offset-2 outline-sky-400/90"
                : hovered === layer.id
                  ? "outline outline-1 outline-offset-2 outline-sky-300/80"
                  : "",
            )}
            style={textStyle(layer, canvas, pixel)}
            data-testid="fit-text-frame"
            data-layer-id={layer.id}
            data-selected={isSelected ? "true" : "false"}
            data-position={`${layer.x.toFixed(3)},${layer.y.toFixed(3)}`}
          >
            {layer.text}
            {isSelected && !disabled && (
              <>
                <div className="absolute bottom-full left-1/2 mb-0.5 h-4 w-px -translate-x-1/2 bg-sky-400/90" />
                <div
                  onPointerDown={beginRotate(layer.id)}
                  data-testid="fit-text-rotate-handle"
                  className={cn(
                    "pointer-events-auto absolute bottom-full left-1/2 mb-[1.125rem] h-3.5 w-3.5 -translate-x-1/2 translate-y-1/2 cursor-grab rounded-full border border-white/90 bg-sky-400/90 active:cursor-grabbing",
                    TOUCH_HIT_AREA,
                  )}
                />
              </>
            )}
            {isSelected &&
              !disabled &&
              CORNER_HANDLES.map((h) => (
                <div
                  key={h.id}
                  onPointerDown={beginHandle(layer.id)(h.id)}
                  data-testid={`fit-text-handle-${h.id}`}
                  className={cn(
                    "pointer-events-auto absolute h-3 w-3 rounded-sm border border-white/90 bg-sky-400/90",
              TOUCH_HIT_AREA,
                    h.classes,
                    h.cursor,
                  )}
                />
              ))}
          </div>
        );
      })}
    </div>
  );
}
