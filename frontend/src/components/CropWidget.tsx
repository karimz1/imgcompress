"use client";

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Minus, Moon, Plus, RotateCcw, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import {
  applyRatio,
  clampCrop,
  CropConfig,
  defaultCropForRatio,
  getPresetRatio,
  RATIO_PRESETS,
  RatioPresetId,
} from "@/lib/crop";
import { CropLoadingPanel } from "@/components/crop/CropLoadingPanel";
import { CropLoadFailure } from "@/components/crop/CropLoadFailure";
import { CropShortcutsList } from "@/components/crop/CropShortcutsList";
import {
  Handle,
  HANDLE_DEFS,
  Rect,
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_STEP,
} from "@/components/crop/cropConstants";
import {
  buildPercentClip,
  clampPan,
  resizeWithHandle,
} from "@/components/crop/cropMath";
import { useCropImageLoader } from "@/components/crop/useCropImageLoader";
import { useFitPreviewBox } from "@/components/crop/useFitPreviewBox";
import { useCropPanZoom } from "@/components/crop/useCropPanZoom";

export interface CropWidgetHandle {
  requestClose: () => void;
}

interface CropWidgetProps {
  file: File;
  initialCrop: CropConfig | null;
  onSave: (crop: CropConfig) => void;
  onClose: () => void;
  onClearCrop?: () => void;
  onReportError?: (payload: { message: string; details?: string }) => void;
  isDarkTheme: boolean;
  disableLogo?: boolean;
}

type DragMode =
  | { kind: "none" }
  | { kind: "move"; startCrop: Rect; startX: number; startY: number }
  | {
      kind: "resize";
      handle: Handle;
      startCrop: Rect;
      startX: number;
      startY: number;
    }
  | {
      kind: "pan";
      startPan: { x: number; y: number };
      startX: number;
      startY: number;
    };

const CropWidget = forwardRef<CropWidgetHandle, CropWidgetProps>(function CropWidget(
  {
    file,
    initialCrop,
    onSave,
    onClose,
    onClearCrop,
    onReportError,
    isDarkTheme,
    disableLogo = false,
  },
  ref
) {
  const { t } = useTranslation();
  const { imgUrl, imgSize, loadError, loadErrorDetails, loadingVariant } =
    useCropImageLoader(file);

  const { theme, setTheme, systemTheme } = useTheme();
  const resolvedThemeMode = theme === "system" ? systemTheme : theme;
  const isDarkResolved = resolvedThemeMode === "dark";

  const [preset, setPreset] = useState<RatioPresetId>(initialCrop?.preset ?? "free");
  const [crop, setCrop] = useState<Rect | null>(
    initialCrop
      ? {
          x: initialCrop.x,
          y: initialCrop.y,
          width: initialCrop.width,
          height: initialCrop.height,
        }
      : null
  );
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const initialStateRef = useRef<{ crop: Rect; preset: RatioPresetId } | null>(null);
  const cropRef = useRef<Rect | null>(crop);
  const presetRef = useRef<RatioPresetId>(preset);
  cropRef.current = crop;
  presetRef.current = preset;

  const previewWrapperRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragMode>({ kind: "none" });

  const ready = !!imgUrl && !!imgSize && !!crop;
  const previewBox = useFitPreviewBox(previewWrapperRef, { enabled: ready, imgSize });

  const scale = imgSize && previewBox ? previewBox.width / imgSize.width : 1;

  const { zoom, setZoom, pan, setPan, spaceDown, resetView } = useCropPanZoom({
    containerRef,
    scale,
    imgSize,
    enabled: ready,
  });

  useEffect(() => {
    if (!imgSize) return;
    if (crop) return;
    const ratio = getPresetRatio(preset);
    const next = defaultCropForRatio(imgSize.width, imgSize.height, ratio);
    initialStateRef.current = { crop: next, preset };
    setCrop(next);
  }, [imgSize, preset, crop]);

  useEffect(() => {
    if (!imgSize || !crop || initialStateRef.current) return;
    initialStateRef.current = { crop: { ...crop }, preset };
  }, [imgSize, crop, preset]);

  const isDirty = useCallback(() => {
    const baseline = initialStateRef.current;
    const current = cropRef.current;
    if (!baseline || !current) return false;
    return (
      presetRef.current !== baseline.preset ||
      current.x !== baseline.crop.x ||
      current.y !== baseline.crop.y ||
      current.width !== baseline.crop.width ||
      current.height !== baseline.crop.height
    );
  }, []);

  const requestClose = useCallback(() => {
    if (isDirty()) {
      setConfirmDiscardOpen(true);
      return;
    }
    onClose();
  }, [isDirty, onClose]);

  useImperativeHandle(ref, () => ({ requestClose }), [requestClose]);

  const beginDrag = useCallback((e: React.PointerEvent, mode: DragMode) => {
    if (mode.kind === "none") return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = mode;
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const mode = dragRef.current;
      if (mode.kind === "none" || !imgSize || scale <= 0) return;
      if (mode.kind === "pan") {
        const next = clampPan(
          {
            x: mode.startPan.x + (e.clientX - mode.startX),
            y: mode.startPan.y + (e.clientY - mode.startY),
          },
          scale,
          imgSize,
          zoom
        );
        setPan(next);
        return;
      }
      const visScale = scale * zoom;
      const dxPx = (e.clientX - mode.startX) / visScale;
      const dyPx = (e.clientY - mode.startY) / visScale;
      const ratio = getPresetRatio(preset);
      let next: Rect = { ...mode.startCrop };
      if (mode.kind === "move") {
        next.x = mode.startCrop.x + dxPx;
        next.y = mode.startCrop.y + dyPx;
      } else {
        next = resizeWithHandle(
          mode.startCrop,
          mode.handle,
          dxPx,
          dyPx,
          ratio,
          e.altKey
        );
      }
      setCrop(clampCrop(next, imgSize.width, imgSize.height));
    },
    [imgSize, scale, zoom, preset, setPan]
  );

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (dragRef.current.kind !== "none") {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      dragRef.current = { kind: "none" };
    }
  }, []);

  const onContainerPointerDown = (e: React.PointerEvent) => {
    const canPan = spaceDown || zoom > 1;
    if (!canPan) return;
    beginDrag(e, {
      kind: "pan",
      startPan: { ...pan },
      startX: e.clientX,
      startY: e.clientY,
    });
  };

  const startMove = (e: React.PointerEvent) => {
    if (!crop) return;
    if (spaceDown) {
      onContainerPointerDown(e);
      return;
    }
    beginDrag(e, {
      kind: "move",
      startCrop: { ...crop },
      startX: e.clientX,
      startY: e.clientY,
    });
  };

  const startResize = (handle: Handle) => (e: React.PointerEvent) => {
    if (!crop || spaceDown) return;
    beginDrag(e, {
      kind: "resize",
      handle,
      startCrop: { ...crop },
      startX: e.clientX,
      startY: e.clientY,
    });
  };

  const setPresetAndCrop = useCallback(
    (next: RatioPresetId) => {
      setPreset(next);
      if (!imgSize) return;
      const ratio = getPresetRatio(next);
      setCrop(defaultCropForRatio(imgSize.width, imgSize.height, ratio));
    },
    [imgSize]
  );

  const updateDimension = (which: "width" | "height", raw: string) => {
    if (!crop || !imgSize) return;
    const num = parseInt(raw, 10);
    if (Number.isNaN(num) || num <= 0) return;
    const ratio = getPresetRatio(preset);
    const adjusted = applyRatio(
      which === "width" ? num : crop.width,
      which === "height" ? num : crop.height,
      ratio,
      which
    );
    const next: Rect = {
      x: crop.x,
      y: crop.y,
      width: adjusted.width,
      height: adjusted.height,
    };
    setCrop(clampCrop(next, imgSize.width, imgSize.height));
  };

  const handleSave = () => {
    if (!crop || !imgSize) return;
    onSave({
      x: crop.x,
      y: crop.y,
      width: crop.width,
      height: crop.height,
      originalWidth: imgSize.width,
      originalHeight: imgSize.height,
      preset,
    });
  };

  const setZoomTo = (next: number) => setZoom(next);
  const resetCropSelection = () => {
    if (!imgSize) return;
    const ratio = getPresetRatio(preset);
    setCrop(defaultCropForRatio(imgSize.width, imgSize.height, ratio));
    resetView();
  };

  const dimsLabel = useMemo(
    () => (crop ? `${crop.width} × ${crop.height} px` : ""),
    [crop]
  );

  const canPan = zoom > 1 || spaceDown;

  const borderPx = 2 / zoom;
  const handlePx = 12 / zoom;
  const gridPx = 1 / zoom;

  const textClass = isDarkTheme ? "text-gray-100" : "text-slate-900";
  const subtleBorder = isDarkTheme ? "border-white/10" : "border-slate-200/70";
  const transparencySurface = isDarkTheme ? "bg-slate-950" : "bg-slate-50";
  const controlPanelSurface = isDarkTheme
    ? "border-white/10 bg-white/[0.045] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
    : "border-white/70 bg-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]";
  const shortcutsSurface = isDarkTheme
    ? "border-white/10 bg-white/[0.05]"
    : "border-white/70 bg-white/55";

  return (
    <div
      className={cn(
        "transition-colors flex-1 min-h-0 flex flex-col lg:flex-row gap-3",
        textClass
      )}
      data-testid="crop-widget"
    >
      <style jsx>{`
        @keyframes crop-editor-fade-in {
          from {
            opacity: 0;
            transform: translateY(8px) scale(0.995);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .crop-editor-fade-in {
          animation: crop-editor-fade-in 220ms ease-out both;
        }
      `}</style>
      {loadError ? (
        <CropLoadFailure
          file={file}
          message={loadError}
          details={loadErrorDetails ?? undefined}
          onDiscard={onClose}
          onReport={onReportError}
        />
      ) : !imgUrl || !imgSize || !crop ? (
        // Always render the loading panel; even fast decodes have a visible
        // gap between click and first paint. The variant just gets lighter
        // for local previews.
        <CropLoadingPanel
          file={file}
          isDarkTheme={isDarkTheme}
          disableLogo={disableLogo}
          variant={loadingVariant}
        />
      ) : (
        <>
          <div
            ref={previewWrapperRef}
            className="crop-editor-fade-in flex-1 min-h-0 min-w-0 flex items-center justify-center p-3"
          >
            <div
              className="relative"
              style={{
                width: previewBox ? `${previewBox.width}px` : 0,
                height: previewBox ? `${previewBox.height}px` : 0,
              }}
            >
              <div
                ref={containerRef}
                className={cn(
                  "absolute inset-0 select-none touch-none overflow-hidden rounded-md border",
                  subtleBorder,
                  transparencySurface,
                  canPan ? "cursor-grab" : "cursor-default",
                  dragRef.current.kind === "pan" && "cursor-grabbing"
                )}
                onPointerDown={onContainerPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              >
                <div
                  className="absolute inset-0"
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: "0 0",
                  }}
                >
                  {React.createElement("img", {
                    src: imgUrl,
                    alt: file.name,
                    draggable: false,
                    className:
                      "absolute inset-0 h-full w-full pointer-events-none",
                  })}
                  <div
                    className="absolute inset-0 bg-black/55 pointer-events-none"
                    style={{ clipPath: buildPercentClip(crop, imgSize) }}
                  />
                  <div
                    className={cn(
                      "absolute border-sky-400/85",
                      canPan ? "cursor-grab" : "cursor-move"
                    )}
                    style={{
                      left: `${(crop.x / imgSize.width) * 100}%`,
                      top: `${(crop.y / imgSize.height) * 100}%`,
                      width: `${(crop.width / imgSize.width) * 100}%`,
                      height: `${(crop.height / imgSize.height) * 100}%`,
                      borderStyle: "solid",
                      borderWidth: `${borderPx}px`,
                    }}
                    onPointerDown={startMove}
                    data-testid="crop-selection"
                  >
                    <div className="pointer-events-none absolute inset-0">
                      <div
                        className="absolute inset-y-0 left-1/3 bg-white/40"
                        style={{ width: `${gridPx}px` }}
                      />
                      <div
                        className="absolute inset-y-0 left-2/3 bg-white/40"
                        style={{ width: `${gridPx}px` }}
                      />
                      <div
                        className="absolute inset-x-0 top-1/3 bg-white/40"
                        style={{ height: `${gridPx}px` }}
                      />
                      <div
                        className="absolute inset-x-0 top-2/3 bg-white/40"
                        style={{ height: `${gridPx}px` }}
                      />
                    </div>
                    {!spaceDown &&
                      HANDLE_DEFS.map((h) => (
                        <div
                          key={h.id}
                          onPointerDown={startResize(h.id)}
                          data-testid={`crop-handle-${h.id}`}
                          className={cn(
                            "absolute rounded-sm bg-sky-400/90 border border-white/90",
                            h.classes,
                            h.cursor
                          )}
                          style={{
                            width: `${handlePx}px`,
                            height: `${handlePx}px`,
                            borderWidth: `${1 / zoom}px`,
                          }}
                        />
                      ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            className={cn(
              "crop-editor-fade-in lg:w-72 shrink-0 flex flex-col gap-3 rounded-md border p-3 backdrop-blur-md",
              controlPanelSurface
            )}
            data-testid="crop-side-panel"
          >
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs uppercase tracking-wide opacity-70">
                  {t("crop.aspectRatio")}
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-8 w-8 p-0 rounded-full shrink-0",
                    "border shadow-sm transition-all",
                    "hover:scale-105 hover:shadow-md active:scale-95",
                    "focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
                    isDarkResolved
                      ? "border-white/15 bg-white/10 text-slate-100 hover:bg-white/15 focus-visible:ring-offset-slate-950"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100 focus-visible:ring-offset-white"
                  )}
                  onClick={() => setTheme(isDarkResolved ? "light" : "dark")}
                  aria-label={
                    isDarkResolved ? t("crop.switchToLight") : t("crop.switchToDark")
                  }
                  title={
                    isDarkResolved ? t("crop.switchToLight") : t("crop.switchToDark")
                  }
                  data-testid="crop-theme-toggle"
                >
                  {isDarkResolved ? (
                    <Moon className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Sun className="h-4 w-4" aria-hidden="true" />
                  )}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {RATIO_PRESETS.map((p) => (
                  <Button
                    key={p.id}
                    type="button"
                    size="sm"
                    variant={preset === p.id ? "default" : "outline"}
                    onClick={() => setPresetAndCrop(p.id)}
                    data-testid={`crop-preset-${p.id}`}
                  >
                    {p.id === "free" ? t("crop.freeRatio") : p.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wide opacity-70">{t("crop.zoom")}</Label>
                <span
                  className="text-xs opacity-70 tabular-nums"
                  data-testid="crop-zoom-label"
                >
                  {Math.round(zoom * 100)}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={zoom <= ZOOM_MIN}
                  onClick={() => setZoomTo(zoom - ZOOM_STEP)}
                  data-testid="crop-zoom-out-btn"
                  aria-label={t("crop.zoomOut")}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <input
                  type="range"
                  min={ZOOM_MIN}
                  max={ZOOM_MAX}
                  step={ZOOM_STEP}
                  value={zoom}
                  onChange={(e) => setZoomTo(parseFloat(e.target.value))}
                  className="flex-1 min-w-0 accent-blue-500"
                  data-testid="crop-zoom-slider"
                  aria-label={t("crop.zoom")}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={zoom >= ZOOM_MAX}
                  onClick={() => setZoomTo(zoom + ZOOM_STEP)}
                  data-testid="crop-zoom-in-btn"
                  aria-label={t("crop.zoomIn")}
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetView}
                  disabled={zoom === 1 && pan.x === 0 && pan.y === 0}
                  data-testid="crop-zoom-reset-btn"
                  aria-label={t("crop.resetZoom")}
                  title={t("crop.resetZoomFull")}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs uppercase tracking-wide opacity-70">
                  {t("crop.dimensions")}
                </Label>
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={resetCropSelection}
                  data-testid="crop-selection-reset-btn"
                >
                  {t("crop.resetSelection")}
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="crop-width" className="text-xs opacity-80">{t("crop.width")}</Label>
                  <Input
                    id="crop-width"
                    data-testid="crop-width-input"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={imgSize.width}
                    value={crop.width}
                    onChange={(e) => updateDimension("width", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="crop-height" className="text-xs opacity-80">{t("crop.height")}</Label>
                  <Input
                    id="crop-height"
                    data-testid="crop-height-input"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={imgSize.height}
                    value={crop.height}
                    onChange={(e) => updateDimension("height", e.target.value)}
                  />
                </div>
              </div>
              <p className="text-xs opacity-70" data-testid="crop-dims-label">
                {dimsLabel}
              </p>
              <p className="text-xs opacity-50">
                {t("crop.original", { w: imgSize.width, h: imgSize.height })}
              </p>
            </div>

            <CropShortcutsList surfaceClass={shortcutsSurface} />

            {initialCrop && onClearCrop && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClearCrop}
                className="w-full border-red-500/50 text-red-600 hover:bg-red-500/10 dark:text-red-300"
                data-testid="crop-remove-saved-btn"
              >
                {t("crop.removeSavedCrop")}
              </Button>
            )}

            <div className="mt-auto pt-2">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={requestClose}
                  data-testid="crop-discard-btn"
                >
                  {t("crop.discard")}
                </Button>
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={handleSave}
                  data-testid="crop-save-btn"
                >
                  {t("crop.saveCrop")}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
      <AlertDialog open={confirmDiscardOpen} onOpenChange={setConfirmDiscardOpen}>
        <AlertDialogContent data-testid="crop-discard-confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("crop.confirmDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("crop.confirmDialog.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="crop-discard-cancel-btn">
              {t("crop.confirmDialog.keepEditing")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmDiscardOpen(false);
                onClose();
              }}
              className="bg-red-600 text-white hover:bg-red-700 focus:ring-red-600"
              data-testid="crop-discard-confirm-btn"
            >
              {t("crop.confirmDialog.discardChanges")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
});

export default CropWidget;
