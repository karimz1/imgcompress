"use client";

import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  clampPlacement,
  DEFAULT_PLACEMENT,
  MAX_PLACEMENT_SCALE,
  MIN_PLACEMENT_SCALE,
  normalizeHexColor,
  placementRect,
  zoomPlacementAt,
  type FitOutput,
  type FitPattern,
  type FitPlacement,
} from "@/lib/fitToSize";
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
const CORNER_HANDLES = HANDLE_DEFS.filter((h) => h.id.length === 2);

type Gesture = {
  pointerId: number;
  handle: Handle | null;
  startX: number;
  startY: number;
  start: FitPlacement;
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
  source: { width: number; height: number },
  canvas: { width: number; height: number },
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

export type SnapGuides = { x: number[]; y: number[] };

/**
 * Snaps a moved image to the canvas centre and edges when it comes within
 * `threshold` canvas pixels, and returns the guide lines that matched.
 */
export function snapPlacement(
  placement: FitPlacement,
  source: { width: number; height: number },
  canvas: { width: number; height: number },
  threshold: number,
): { placement: FitPlacement; guides: SnapGuides } {
  const rect = placementRect(source, canvas, placement);
  const snapAxis = (start: number, size: number, total: number) => {
    // Candidates: image centre on canvas centre, image edges on canvas edges.
    const candidates = [
      { offset: total / 2 - (start + size / 2), line: total / 2 },
      { offset: -start, line: 0 },
      { offset: total - (start + size), line: total },
    ];
    const best = candidates
      .filter((candidate) => Math.abs(candidate.offset) <= threshold)
      .sort((a, b) => Math.abs(a.offset) - Math.abs(b.offset))[0];
    return best ?? null;
  };
  const sx = snapAxis(rect.left, rect.width, canvas.width);
  const sy = snapAxis(rect.top, rect.height, canvas.height);
  return {
    placement: clampPlacement({
      ...placement,
      x: placement.x + (sx ? sx.offset / canvas.width : 0),
      y: placement.y + (sy ? sy.offset / canvas.height : 0),
    }),
    guides: { x: sx ? [sx.line] : [], y: sy ? [sy.line] : [] },
  };
}

/** Pointer distance, in screen pixels, at which a moved image snaps. */
const SNAP_DISTANCE_PX = 6;

/** Shows `crop` of the image stretched over its parent box. */
function SourceRegion({
  imgUrl,
  imgSize,
  crop,
}: {
  imgUrl: string;
  imgSize: { width: number; height: number };
  crop: Rect;
}) {
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

/**
 * Lightweight placement editor: the output canvas drawn with CSS so dragging
 * gives instant feedback, and the server preview on top once it is current.
 */
export function FitPlacementStage({
  imgUrl,
  imgSize,
  crop,
  fit,
  placement,
  onChange,
  preview,
  previewCurrent,
  box,
  disabled,
  previewAlt,
  showGrid = false,
}: {
  imgUrl: string;
  imgSize: { width: number; height: number };
  crop: Rect;
  fit: FitOutput;
  placement: FitPlacement | null;
  onChange: (placement: FitPlacement) => void;
  preview: string | null;
  previewCurrent: boolean;
  box: { width: number; height: number };
  disabled: boolean;
  previewAlt: string;
  showGrid?: boolean;
}) {
  const { t } = useTranslation();
  const mod = useModifierLabel();
  const [draft, setDraft] = useState<FitPlacement | null>(null);
  const [guides, setGuides] = useState<SnapGuides | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const backgroundUrl = useObjectUrl(
    fit.mode === "image" ? fit.background?.image?.file : undefined,
  );
  const canvas = { width: fit.width, height: fit.height };
  const source = { width: crop.width, height: crop.height };
  const current = draft ?? placement ?? DEFAULT_PLACEMENT;
  const rect = placementRect(source, canvas, current);
  const cover = placementRect(source, canvas, {
    scale: Math.max(canvas.width / source.width, canvas.height / source.height) /
      Math.min(canvas.width / source.width, canvas.height / source.height),
    x: 0.5,
    y: 0.5,
  });
  const pixel = box.width / canvas.width;
  const percent = (value: number, total: number) => `${(value / total) * 100}%`;
  const blurRadius =
    Math.max(2, Math.max(canvas.width, canvas.height) * BLUR_RADIUS_SHARE) * pixel;
  const showPreview = !!preview && previewCurrent && !draft;
  const dim = fit.background?.dim ?? 0;

  // Ctrl/Cmd + wheel (and trackpad pinch, which browsers report the same way)
  // zooms the image around the cursor. A native listener, because React's
  // wheel handler is passive and could not stop the page from zooming.
  const latest = useRef({ placement, onChange, disabled, pixel, canvas });
  latest.current = { placement, onChange, disabled, pixel, canvas };
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const { placement, onChange, disabled, pixel, canvas } = latest.current;
      if (disabled || gesture.current) return;
      const bounds = stage.getBoundingClientRect();
      const lines = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? bounds.height : 1;
      const factor = Math.exp(-e.deltaY * lines * WHEEL_ZOOM_SPEED);
      const next = zoomPlacementAt(
        placement ?? DEFAULT_PLACEMENT,
        factor,
        { x: (e.clientX - bounds.left) / pixel, y: (e.clientY - bounds.top) / pixel },
        canvas,
      );
      // Wheel events can arrive faster than React re-renders; build on this one.
      latest.current.placement = next;
      onChange(next);
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, []);

  const begin = (handle: Handle | null) => (e: React.PointerEvent) => {
    if (disabled || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    // preventDefault above also stops the browser from focusing the stage,
    // and the keyboard shortcuts need it focused.
    stageRef.current?.focus({ preventScroll: true });
    stageRef.current?.setPointerCapture?.(e.pointerId);
    gesture.current = {
      pointerId: e.pointerId,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      start: placement ?? DEFAULT_PLACEMENT,
    };
    setDraft(placement ?? DEFAULT_PLACEMENT);
  };

  const move = (e: React.PointerEvent) => {
    const active = gesture.current;
    if (!active || active.pointerId !== e.pointerId) return;
    const next = dragPlacement(
      active.start,
      active.handle,
      (e.clientX - active.startX) / pixel,
      (e.clientY - active.startY) / pixel,
      source,
      canvas,
    );
    // Moving snaps to the centre and edges; hold Alt to place freely.
    if (!active.handle && !e.altKey) {
      const snapped = snapPlacement(next, source, canvas, SNAP_DISTANCE_PX / pixel);
      setDraft(snapped.placement);
      setGuides(snapped.guides);
    } else {
      setDraft(next);
      setGuides(null);
    }
  };

  const end = (e: React.PointerEvent) => {
    const active = gesture.current;
    if (!active || active.pointerId !== e.pointerId) return;
    gesture.current = null;
    const moved = e.clientX !== active.startX || e.clientY !== active.startY;
    if (draft && moved && e.type !== "pointercancel") onChange(draft);
    setDraft(null);
    setGuides(null);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    const step = e.shiftKey ? 10 : 1;
    const start = placement ?? DEFAULT_PLACEMENT;
    if (e.ctrlKey || e.metaKey) {
      // Photoshop-style: plus and minus zoom around the image centre, 0 fits.
      // Handled here only, so the browser zoom keeps working elsewhere.
      const zoom =
        e.key === "+" || e.key === "=" ? KEY_ZOOM_STEP : e.key === "-" || e.key === "_" ? 1 / KEY_ZOOM_STEP : null;
      if (zoom) {
        e.preventDefault();
        onChange(clampPlacement({ ...start, scale: start.scale * zoom }));
      } else if (e.key === "0") {
        e.preventDefault();
        onChange({ ...DEFAULT_PLACEMENT });
      }
      return;
    }
    const nudge: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    if (nudge[e.key]) {
      e.preventDefault();
      const [dx, dy] = nudge[e.key];
      onChange(dragPlacement(start, null, dx, dy, source, canvas));
    }
  };

  return (
    <div
      ref={stageRef}
      data-fit-stage
      data-testid="fit-placement-stage"
      role="application"
      aria-label={t("crop.fit.placement.stageLabel", { mod })}
      aria-disabled={disabled || undefined}
      tabIndex={0}
      className="relative touch-none select-none rounded-md outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2"
      style={{ width: `${box.width}px`, height: `${box.height}px` }}
      onKeyDown={onKeyDown}
      onPointerDown={begin(null)}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div
        className={cn(
          "absolute inset-0 overflow-hidden rounded-md",
          fit.mode === "transparent" &&
            "bg-[repeating-conic-gradient(#80808040_0%_25%,transparent_0%_50%)] bg-[size:16px_16px]",
        )}
        style={fit.mode === "solid" ? { backgroundColor: fit.color } : undefined}
        data-testid="fit-placement-canvas"
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
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
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
              filter: `blur(${blurRadius}px) brightness(${BLUR_BRIGHTNESS})`,
              transform: "scale(1.06)",
            }}
          >
            <SourceRegion imgUrl={imgUrl} imgSize={imgSize} crop={crop} />
          </div>
        )}
        {dim > 0 && (
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{ backgroundColor: `rgba(0,0,0,${dim})` }}
            data-testid="fit-dim-layer"
          />
        )}
        <div
          className="absolute"
          style={{
            left: percent(rect.left, canvas.width),
            top: percent(rect.top, canvas.height),
            width: percent(rect.width, canvas.width),
            height: percent(rect.height, canvas.height),
          }}
        >
          <SourceRegion imgUrl={imgUrl} imgSize={imgSize} crop={crop} />
        </div>
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
            className="pointer-events-none absolute bg-sky-300/80"
            style={
              vertical
                ? { left: percent(line, canvas.width), top: 0, bottom: 0, width: 1 }
                : { top: percent(line, canvas.height), left: 0, right: 0, height: 1 }
            }
            data-testid={`fit-snap-guide-${vertical ? "x" : "y"}`}
          />
        ))}
      <div
        className={cn(
          "absolute border-2 border-sky-400/90 shadow-[0_0_0_1px_rgba(0,0,0,0.35)]",
          disabled ? "cursor-default" : "cursor-move",
        )}
        style={{
          left: percent(rect.left, canvas.width),
          top: percent(rect.top, canvas.height),
          width: percent(rect.width, canvas.width),
          height: percent(rect.height, canvas.height),
        }}
        onPointerDown={begin(null)}
        data-testid="fit-placement-frame"
        data-rect={[rect.left, rect.top, rect.width, rect.height].map(Math.round).join(",")}
      >
        {!disabled &&
          CORNER_HANDLES.map((h) => (
            <div
              key={h.id}
              onPointerDown={begin(h.id)}
              data-testid={`fit-placement-handle-${h.id}`}
              className={cn(
                "absolute h-3 w-3 rounded-sm border border-white/90 bg-sky-400/90",
                h.classes,
                h.cursor,
              )}
            />
          ))}
      </div>
    </div>
  );
}
