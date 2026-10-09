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
import { Moon, SlidersHorizontal, Sun } from "lucide-react";
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
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { CropLoadingPanel } from "@/components/crop/CropLoadingPanel";
import { CropLoadFailure } from "@/components/crop/CropLoadFailure";
import { CropShortcutsList } from "@/components/crop/CropShortcutsList";
import {
  Handle,
  HANDLE_DEFS,
  Rect,
} from "@/components/crop/cropConstants";
import {
  buildPercentClip,
  clampPan,
  clampZoom,
  resizeWithHandle,
} from "@/components/crop/cropMath";
import { useCropImageLoader } from "@/components/crop/useCropImageLoader";
import { useFitPreviewBox } from "@/components/crop/useFitPreviewBox";
import { useCropPanZoom } from "@/components/crop/useCropPanZoom";
import { useEditorFit } from "@/components/crop/useEditorFit";
import { FitControls } from "@/components/crop/FitControls";
import {
  CropEditorTabs,
  type EditorTab,
} from "@/components/crop/CropEditorTabs";
import type { FitOutput } from "@/lib/fitToSize";

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
  fitAvailable?: boolean;
  onApplyFitToAll?: (fit: FitOutput, signal: AbortSignal) => Promise<void>;
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
    fitAvailable = true,
    onApplyFitToAll,
  },
  ref,
) {
  const { t } = useTranslation();
  const { imgUrl, imgSize, loadError, loadErrorDetails, loadingVariant } =
    useCropImageLoader(file);

  const { theme, setTheme, systemTheme } = useTheme();
  const resolvedThemeMode = theme === "system" ? systemTheme : theme;
  const isDarkResolved = resolvedThemeMode === "dark";

  const [preset, setPreset] = useState<RatioPresetId>(
    initialCrop?.preset ?? "free",
  );
  const [activeTab, setActiveTab] = useState<EditorTab>(
    fitAvailable && initialCrop?.fit ? "fit" : "crop",
  );
  const [manualCrop, setManualCrop] = useState<Rect | null>(
    initialCrop
      ? {
          x: initialCrop.x,
          y: initialCrop.y,
          width: initialCrop.width,
          height: initialCrop.height,
        }
      : null,
  );
  const [fitCrop, setFitCrop] = useState<Rect | null>(manualCrop);
  const fitting = fitAvailable && activeTab === "fit";
  const crop = fitting ? fitCrop : manualCrop;
  const setCrop = fitting ? setFitCrop : setManualCrop;
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const initialStateRef = useRef<{
    crop: Rect;
    preset: RatioPresetId;
  } | null>(null);
  const cropRef = useRef<Rect | null>(crop);
  const presetRef = useRef<RatioPresetId>(preset);
  cropRef.current = crop;
  presetRef.current = fitting ? "free" : preset;

  const previewWrapperRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragMode>({ kind: "none" });
  // Multi-touch state: one finger moves/resizes the crop, two fingers pan + pinch-zoom.
  const activePointers = useRef<Map<number, { x: number; y: number }>>(
    new Map(),
  );
  const pinchRef = useRef<{
    startDist: number;
    startZoom: number;
    p0x: number;
    p0y: number;
  } | null>(null);

  const ready = !!imgUrl && !!imgSize && !!crop;
  const previewBox = useFitPreviewBox(previewWrapperRef, {
    enabled: ready,
    imgSize,
  });

  const scale = imgSize && previewBox ? previewBox.width / imgSize.width : 1;

  const { zoom, setZoom, pan, setPan, spaceDown, resetView } = useCropPanZoom(
    {
      containerRef,
      scale,
      imgSize,
      enabled: ready,
    },
  );

  const onFitSelection = useCallback(
    (selection: Rect) => {
      setFitCrop(selection);
      resetView();
    },
    [resetView],
  );
  const fit = useEditorFit({
    imgUrl,
    crop: fitCrop,
    initialCrop,
    active: fitting,
    onSelection: onFitSelection,
    onApplyToAll: onApplyFitToAll,
  });
  const activeFit = fitting ? fit.applied : null;
  const editorBusy = fitting && (fit.working || fit.pending || !fit.applied);
  const fitRef = useRef<FitOutput | null>(activeFit);
  fitRef.current = activeFit;
  const lockedRatio =
    activeFit?.mode === "crop"
      ? activeFit.width / activeFit.height
      : getPresetRatio(preset);

  useEffect(() => {
    if (!imgSize) return;
    const ratio = getPresetRatio(preset);
    const next = defaultCropForRatio(imgSize.width, imgSize.height, ratio);
    setManualCrop((current) => current ?? next);
    setFitCrop((current) => current ?? next);
  }, [imgSize, preset]);

  useEffect(() => {
    if (!imgSize || !crop || initialStateRef.current) return;
    initialStateRef.current = {
      crop: { ...crop },
      preset: fitting ? "free" : preset,
    };
  }, [imgSize, crop, preset]);

  const isDirty = useCallback(() => {
    const baseline = initialStateRef.current;
    const current = cropRef.current;
    if (!baseline || !current) return false;
    return (
      presetRef.current !== baseline.preset ||
      JSON.stringify(fitRef.current ?? undefined) !==
        JSON.stringify(initialCrop?.fit) ||
      current.x !== baseline.crop.x ||
      current.y !== baseline.crop.y ||
      current.width !== baseline.crop.width ||
      current.height !== baseline.crop.height
    );
  }, [initialCrop]);

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
      if (mode.kind === "none" || !imgSize || scale <= 0 || editorBusy)
        return;
      if (mode.kind === "pan") {
        const next = clampPan(
          {
            x: mode.startPan.x + (e.clientX - mode.startX),
            y: mode.startPan.y + (e.clientY - mode.startY),
          },
          scale,
          imgSize,
          zoom,
        );
        setPan(next);
        return;
      }
      const visScale = scale * zoom;
      const dxPx = (e.clientX - mode.startX) / visScale;
      const dyPx = (e.clientY - mode.startY) / visScale;
      const ratio = lockedRatio;
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
          e.altKey,
        );
      }
      setCrop(clampCrop(next, imgSize.width, imgSize.height));
    },
    [imgSize, scale, zoom, lockedRatio, setPan, setCrop, editorBusy],
  );

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (dragRef.current.kind !== "none") {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      dragRef.current = { kind: "none" };
    }
  }, []);

  // --- Multi-touch pinch/pan (capture phase so it wins over the crop-drag
  // handlers on descendant elements). Two active pointers => pan + pinch-zoom
  // the image; a single pointer keeps moving/resizing the crop as before.
  const containerPoint = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    return rect
      ? { x: clientX - rect.left, y: clientY - rect.top }
      : { x: clientX, y: clientY };
  };

  const onPointerDownCapture = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") return;
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (activePointers.current.size === 2 && imgSize && scale > 0) {
      // A second finger arrived: cancel any in-progress crop drag and start a
      // pinch gesture anchored on the point under the two-finger midpoint.
      dragRef.current = { kind: "none" };
      const [a, b] = Array.from(activePointers.current.values());
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mid = containerPoint((a.x + b.x) / 2, (a.y + b.y) / 2);
      pinchRef.current = {
        startDist: dist,
        startZoom: zoom,
        p0x: (mid.x - pan.x) / zoom,
        p0y: (mid.y - pan.y) / zoom,
      };
    }
  };

  const onPointerMoveCapture = (e: React.PointerEvent) => {
    if (!activePointers.current.has(e.pointerId)) return;
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pinch = pinchRef.current;
    if (!pinch || activePointers.current.size < 2 || !imgSize || scale <= 0) return;
    e.preventDefault();
    const [a, b] = Array.from(activePointers.current.values());
    const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    const nextZoom = clampZoom(pinch.startZoom * (dist / pinch.startDist));
    const mid = containerPoint((a.x + b.x) / 2, (a.y + b.y) / 2);
    const nextPan = clampPan(
      { x: mid.x - pinch.p0x * nextZoom, y: mid.y - pinch.p0y * nextZoom },
      scale,
      imgSize,
      nextZoom
    );
    setZoom(nextZoom);
    setPan(nextPan);
  };

  const onPointerEndCapture = (e: React.PointerEvent) => {
    if (activePointers.current.delete(e.pointerId) && activePointers.current.size < 2) {
      pinchRef.current = null;
    }
  };

  const isGesturing = () =>
    activePointers.current.size >= 2 || pinchRef.current !== null;

  const onContainerPointerDown = (e: React.PointerEvent) => {
    if (isGesturing()) return;
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
    if (!crop || isGesturing() || editorBusy) return;
    // On touch, don't drag the whole selection from its interior — that caused
    // accidental moves. Touch users resize via the handles and pan/zoom with two
    // fingers; letting this fall through also enables one-finger pan when zoomed.
    if (e.pointerType !== "mouse") return;
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
    if (!crop || spaceDown || isGesturing() || editorBusy) return;
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
    [imgSize, setCrop],
  );

  const updateDimension = (which: "width" | "height", raw: string) => {
    if (!crop || !imgSize) return;
    const num = parseInt(raw, 10);
    if (Number.isNaN(num) || num <= 0) return;
    const ratio = lockedRatio;
    const adjusted = applyRatio(
      which === "width" ? num : crop.width,
      which === "height" ? num : crop.height,
      ratio,
      which,
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
      preset: fitting ? "free" : preset,
      ...(activeFit ? { fit: activeFit } : {}),
    });
  };

  const resetCropSelection = () => {
    if (!imgSize) return;
    const ratio = getPresetRatio(preset);
    setCrop(defaultCropForRatio(imgSize.width, imgSize.height, ratio));
    resetView();
  };

  const dimsLabel = useMemo(
    () => (crop ? `${crop.width} × ${crop.height} px` : ""),
    [crop],
  );

  const canPan = zoom > 1 || spaceDown;

  const borderPx = 2 / zoom;
  const handlePx = 12 / zoom;
  const gridPx = 1 / zoom;

  const textClass = isDarkTheme ? "text-gray-100" : "text-slate-900";
  const subtleBorder = isDarkTheme
    ? "border-white/10"
    : "border-slate-200/70";
  const transparencySurface = isDarkTheme ? "bg-slate-950" : "bg-slate-50";
  const controlPanelSurface = isDarkTheme
    ? "border-white/10 bg-white/[0.045] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
    : "border-white/70 bg-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]";
  const shortcutsSurface = isDarkTheme
    ? "border-white/10 bg-white/[0.05]"
    : "border-white/70 bg-white/55";

  const renderControlsHeader = (suffix = "") => (
    <div className="flex shrink-0 items-center gap-2">
      {fitAvailable && (
        <CropEditorTabs
          value={activeTab}
          onChange={(tab) => {
            setActiveTab(tab);
            resetView();
          }}
          suffix={suffix}
          disabled={fit.batchWorking}
        />
      )}
      <div className="ml-auto shrink-0">
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
              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100 focus-visible:ring-offset-white",
          )}
          onClick={() => setTheme(isDarkResolved ? "light" : "dark")}
          aria-label={
            isDarkResolved ? t("crop.switchToLight") : t("crop.switchToDark")
          }
          title={
            isDarkResolved ? t("crop.switchToLight") : t("crop.switchToDark")
          }
          data-testid={`crop-theme-toggle${suffix}`}
        >
          {isDarkResolved ? (
            <Moon className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Sun className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>
      </div>
    </div>
  );

  const renderCropDimensions = (suffix = "") => (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs uppercase tracking-wide opacity-70">
          {t("crop.dimensions")}
        </Label>
        {!fitting && (
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={resetCropSelection}
            disabled={editorBusy}
            data-testid={`crop-selection-reset-btn${suffix}`}
          >
            {t("crop.resetSelection")}
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label
            htmlFor={`crop-width${suffix}`}
            className="text-xs opacity-80"
          >
            {t("crop.width")}
          </Label>
          <Input
            id={`crop-width${suffix}`}
            data-testid={`crop-width-input${suffix}`}
            type="number"
            inputMode="numeric"
            min={1}
            max={imgSize?.width}
            disabled={editorBusy}
            value={crop?.width ?? ""}
            onChange={(e) => updateDimension("width", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label
            htmlFor={`crop-height${suffix}`}
            className="text-xs opacity-80"
          >
            {t("crop.height")}
          </Label>
          <Input
            id={`crop-height${suffix}`}
            data-testid={`crop-height-input${suffix}`}
            type="number"
            inputMode="numeric"
            min={1}
            max={imgSize?.height}
            disabled={editorBusy}
            value={crop?.height ?? ""}
            onChange={(e) => updateDimension("height", e.target.value)}
          />
        </div>
      </div>
      <p
        className="text-xs opacity-70"
        data-testid={`crop-dims-label${suffix}`}
      >
        {dimsLabel}
      </p>
      {imgSize && (
        <p className="text-xs opacity-50">
          {t("crop.original", { w: imgSize.width, h: imgSize.height })}
        </p>
      )}
    </div>
  );

  // Both responsive layouts use the same tab and draft state. Each tree has
  // unique ids so tabs always point to their own controls.
  const renderAdjustControls = (suffix = "") => (
    <div className="space-y-4">
      <div
        role={fitAvailable ? "tabpanel" : undefined}
        id={`crop-editor-panel-crop${suffix}`}
        aria-labelledby={fitAvailable ? `crop-editor-tab-crop${suffix}` : undefined}
        hidden={fitting}
        className="space-y-4"
      >
        {!fitting && (
          <>
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs uppercase tracking-wide opacity-70">
                  {t("crop.aspectRatio")}
                </Label>
              </div>
              <div className="flex flex-wrap gap-2">
                {RATIO_PRESETS.map((p) => (
                  <Button
                    key={p.id}
                    type="button"
                    size="sm"
                    variant={preset === p.id ? "default" : "outline"}
                    onClick={() => setPresetAndCrop(p.id)}
                    disabled={editorBusy}
                    data-testid={`crop-preset-${p.id}${suffix}`}
                  >
                    {p.id === "free" ? t("crop.freeRatio") : p.label}
                  </Button>
                ))}
              </div>
            </div>

            {renderCropDimensions(suffix)}
            <CropShortcutsList surfaceClass={shortcutsSurface} />
          </>
        )}
      </div>
      {fitAvailable && (
        <div
          role="tabpanel"
          id={`crop-editor-panel-fit${suffix}`}
          aria-labelledby={`crop-editor-tab-fit${suffix}`}
          hidden={!fitting}
          className="space-y-4"
        >
          {fitting && (
            <>
              <FitControls
                fit={fit}
                suffix={suffix}
                canApplyToAll={!!onApplyFitToAll}
              />
              {activeFit?.mode === "crop" && (
                <details
                  className="rounded-md border border-current/10 p-3"
                  data-testid={`crop-fit-selection-settings${suffix}`}
                >
                  <summary
                    className="cursor-pointer text-sm font-medium"
                    data-testid={`crop-fit-adjust-selection${suffix}`}
                  >
                    {t("crop.fit.selection")}
                  </summary>
                  <div className="pt-3">{renderCropDimensions(suffix)}</div>
                </details>
              )}
            </>
          )}
        </div>
      )}
      {initialCrop && onClearCrop && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClearCrop}
          className="w-full border-red-500/50 text-red-600 hover:bg-red-500/10 dark:text-red-300"
          data-testid={`crop-remove-saved-btn${suffix}`}
        >
          {t("crop.removeSavedCrop")}
        </Button>
      )}
    </div>
  );

  const renderActionButtons = (suffix = "", btnClass = "") => (
    <div className="grid grid-cols-2 gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={requestClose}
        data-testid={`crop-discard-btn${suffix}`}
        className={btnClass}
      >
        {t("crop.discard")}
      </Button>
      <Button
        type="button"
        variant="default"
        size="sm"
        onClick={handleSave}
        disabled={
          editorBusy || (fitting && (!fit.previewCurrent || !!fit.error))
        }
        data-testid={`crop-save-btn${suffix}`}
        className={btnClass}
      >
        {t("crop.saveCrop")}
      </Button>
    </div>
  );

  return (
    <div
      className={cn(
        "transition-colors flex-1 min-h-0 flex flex-col lg:flex-row gap-3",
        textClass,
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
            {activeFit?.mode === "blur" ? (
              fit.preview && <img src={fit.preview} alt={t("crop.fit.preview")} className="max-h-full max-w-full object-contain rounded-md" data-testid="crop-blur-canvas" />
            ) : <div
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
                onPointerDownCapture={onPointerDownCapture}
                onPointerMoveCapture={onPointerMoveCapture}
                onPointerUpCapture={onPointerEndCapture}
                onPointerCancelCapture={onPointerEndCapture}
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
            </div>}
          </div>

          {/* Desktop: fixed right-hand control panel */}
          <div
            className={cn(
              "crop-editor-fade-in hidden lg:flex lg:w-80 shrink-0 flex-col gap-3 rounded-md border p-3 backdrop-blur-md overflow-hidden",
              controlPanelSurface,
            )}
            data-testid="crop-side-panel"
          >
            {renderControlsHeader()}
            <div className="min-h-0 flex-1 overflow-y-auto space-y-3 pr-1">
              {renderAdjustControls()}
            </div>
            <div className="mt-auto pt-2">{renderActionButtons()}</div>
          </div>

          {/* Mobile: slim always-visible action bar; settings live in a bottom drawer */}
          <div
            className={cn(
              "crop-editor-fade-in lg:hidden shrink-0 flex items-stretch gap-2 rounded-md border p-2 backdrop-blur-md",
              controlPanelSurface,
            )}
            data-testid="crop-mobile-bar"
          >
            <Drawer>
              <DrawerTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-1.5 px-3"
                  data-testid="crop-adjust-trigger"
                  aria-label={t("crop.adjust")}
                  title={t("crop.adjust")}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  <span>{t("crop.adjust")}</span>
                </Button>
              </DrawerTrigger>
              <DrawerContent className="max-h-[90dvh]" data-testid="crop-adjust-drawer">
                <DrawerHeader className="shrink-0 pb-2">
                  <DrawerTitle className="text-base">
                    {t("crop.adjust")}
                  </DrawerTitle>
                  <DrawerDescription className="sr-only">
                    {t("crop.aspectRatio")}
                  </DrawerDescription>
                </DrawerHeader>
                <div className="shrink-0 px-4 pb-3">
                  {renderControlsHeader("-mobile")}
                </div>
                <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4">
                  {renderAdjustControls("-mobile")}
                </div>
                <DrawerFooter className="shrink-0 border-t border-current/10 pt-3">
                  {renderActionButtons("-mobile-drawer")}
                </DrawerFooter>
              </DrawerContent>
            </Drawer>
            <div className="flex-1 min-w-0">
              {renderActionButtons(
                "-mobile",
                "h-auto min-h-9 whitespace-normal leading-tight px-3 py-1.5 text-center",
              )}
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
