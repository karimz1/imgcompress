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
import { Minus, Moon, Plus, RotateCcw, SlidersHorizontal, Sun } from "lucide-react";
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
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_STEP,
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
import { FitControls, FitStatus } from "@/components/crop/FitControls";
import { FitLayersPanel } from "@/components/crop/FitLayersPanel";
import { AngleRow, FitPlacementControls } from "@/components/crop/FitPlacementControls";
import { FitPlacementStage } from "@/components/crop/FitPlacementStage";
import { isTyping, StageToolbar } from "@/components/crop/StageToolbar";
import { useCompactEditor } from "@/components/crop/useCompactEditor";
import {
  COMPACT_TABS,
  CropEditorTabs,
  type EditorTab,
} from "@/components/crop/CropEditorTabs";
import { DEFAULT_PLACEMENT, MAX_IMAGE_LAYERS, MAX_TEXT_LAYERS, type FitOutput } from "@/lib/fitToSize";

/** Compares saved designs; object URLs change on every open, files by identity. */
const fitSignature = (fit: FitOutput | null | undefined) =>
  JSON.stringify(fit ?? null, (key, value) => {
    if (key === "url") return undefined;
    if (value instanceof Blob) {
      const file = value as File;
      return `${file.name ?? ""}:${value.size}:${file.lastModified ?? ""}`;
    }
    return value;
  });

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
  const fitting = fitAvailable && activeTab !== "crop";
  const compact = useCompactEditor();
  const visibleTabs = compact ? COMPACT_TABS : undefined;
  // A double-click on a stage text asks the layers panel to focus its field.
  const [editRequest, setEditRequest] = useState(0);
  const backgroundInput = useRef<HTMLInputElement | null>(null);
  const backgroundInputMobile = useRef<HTMLInputElement | null>(null);
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
    file,
    imgUrl,
    crop: fitCrop,
    initialCrop,
    active: fitting,
    onSelection: onFitSelection,
    onApplyToAll: onApplyFitToAll,
  });
  const activeFit = fitting ? fit.output : null;
  // Editor-only guide; it is never part of the output.
  const [showGrid, setShowGrid] = useState(false);
  // "Crop" mode picks the region on the size tab; the other tabs show the
  // design with the image filling the canvas.
  const baseLocked = activeFit?.mode === "crop" && activeTab !== "fit";
  const placing = !!activeFit && (activeFit.mode !== "crop" || baseLocked);

  // Small screens keep crop and size only; saved design settings stay.
  useEffect(() => {
    if (compact && !COMPACT_TABS.includes(activeTab)) setActiveTab("fit");
  }, [compact, activeTab]);

  const { undo, redo } = fit;
  useEffect(() => {
    if (!fitting) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || isTyping(e.target)) return;
      const key = e.key.toLowerCase();
      if (key !== "z" && key !== "y") return;
      e.preventDefault();
      if (fit.batchWorking) return;
      if (key === "y" || e.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fitting, undo, redo, fit.batchWorking]);

  const openTab = useCallback(
    (tab: EditorTab) => {
      if (compact && !COMPACT_TABS.includes(tab)) return;
      setActiveTab(tab);
    },
    [compact],
  );
  const stageTarget = useMemo(
    () =>
      placing && activeFit
        ? { width: activeFit.width, height: activeFit.height }
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [placing, activeFit?.width, activeFit?.height],
  );
  const stageArea = useFitPreviewBox(previewWrapperRef, {
    enabled: ready && placing,
    imgSize: stageTarget,
  });
  // Leave room around the canvas for the resize handles.
  const stageBox = stageArea
    ? {
        width: Math.max(1, stageArea.width - 32),
        height: Math.max(
          1,
          Math.round(((stageArea.width - 32) * stageArea.height) / stageArea.width),
        ),
      }
    : null;
  const selectedLayer = fit.layers.find((l) => l.id === fit.selected) ?? null;
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
      fitSignature(fitRef.current) !== fitSignature(initialCrop?.fit) ||
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
    // Focus the selection so the arrow keys nudge it after a click.
    (e.currentTarget as HTMLElement).focus({ preventScroll: true });
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

  const centerCropSelection = () => {
    if (!crop || !imgSize) return;
    setCrop(
      clampCrop(
        {
          ...crop,
          x: Math.round((imgSize.width - crop.width) / 2),
          y: Math.round((imgSize.height - crop.height) / 2),
        },
        imgSize.width,
        imgSize.height,
      ),
    );
  };

  // Arrow keys move the selection by one pixel of the original, Shift by ten.
  const onSelectionKeyDown = (e: React.KeyboardEvent) => {
    if (!crop || !imgSize || editorBusy) return;
    const step = e.shiftKey ? 10 : 1;
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = delta[e.key];
    if (!move) return;
    e.preventDefault();
    setCrop(
      clampCrop(
        { ...crop, x: crop.x + move[0], y: crop.y + move[1] },
        imgSize.width,
        imgSize.height,
      ),
    );
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
            if (tab === "background" && fit.output?.mode === "image" && fit.backgroundImage) {
              fit.setSelected("background");
            } else if (
              fit.selected === "background" ||
              (fit.selected === "image" && tab !== "fit")
            ) {
              fit.setSelected(null);
            }
            resetView();
          }}
          tabs={visibleTabs}
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
    <div className="space-y-3">
      <p className="text-xs leading-relaxed opacity-70">{t("crop.selectionHint")}</p>
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

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-1 text-xs opacity-70">
                <p data-testid={`crop-dims-label${suffix}`}>{dimsLabel}</p>
                {imgSize && <p>{t("crop.original", { w: imgSize.width, h: imgSize.height })}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={centerCropSelection}
                  disabled={editorBusy}
                  data-testid={`crop-selection-center-btn${suffix}`}
                >
                  {t("crop.centerSelection")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={resetCropSelection}
                  disabled={editorBusy}
                  data-testid={`crop-selection-reset-btn${suffix}`}
                >
                  {t("crop.resetSelection")}
                </Button>
              </div>
            </div>
            <details
              className="rounded-md border border-current/10 p-3"
              data-testid={`crop-precise-selection${suffix}`}
            >
              <summary
                className="cursor-pointer text-sm font-medium"
                data-testid={`crop-precise-selection-toggle${suffix}`}
              >
                {t("crop.preciseSelection")}
              </summary>
              <div className="pt-3">{renderCropDimensions(suffix)}</div>
            </details>
            <CropShortcutsList surfaceClass={shortcutsSurface} />
          </>
        )}
      </div>
      {fitAvailable && (
        <>
          <div
            role="tabpanel"
            id={`crop-editor-panel-fit${suffix}`}
            aria-labelledby={`crop-editor-tab-fit${suffix}`}
            hidden={activeTab !== "fit"}
            className="space-y-4"
          >
            {fitting && (
              <>
                <FitControls
                  fit={fit}
                  suffix={suffix}
                  section="size"
                  backgroundInput={suffix ? backgroundInputMobile : backgroundInput}
                  compact={compact}
                  onNeedBackground={() => openTab("background")}
                />
                {compact && (
                  <p
                    className="rounded-md border border-dashed border-current/20 px-2.5 py-2 text-xs leading-snug opacity-75"
                    data-testid={`crop-compact-note${suffix}`}
                  >
                    {t("crop.fit.compactNote")}
                    {fit.layers.length > 0 && ` ${t("crop.fit.compactKept")}`}
                  </p>
                )}
                {fit.placementEnabled && fit.output && crop && (
                  <FitPlacementControls
                    fit={fit.output}
                    source={{ width: crop.width, height: crop.height }}
                    placement={fit.placement}
                    onChange={fit.setPlacement}
                    disabled={editorBusy}
                    showGrid={showGrid}
                    onShowGridChange={setShowGrid}
                    suffix={suffix}
                  />
                )}
                {activeFit?.mode === "crop" && (
                  // Fill frame turns too: the image stays centred and zooms to keep the frame full.
                  <div className="rounded-md border border-current/10 p-3" data-testid={`fit-fill-rotation${suffix}`}>
                    <AngleRow
                      id={`fit-rotation${suffix}`}
                      value={fit.placement?.rotation ?? 0}
                      disabled={editorBusy || !fit.output}
                      onChange={(rotation) => fit.setPlacement({ ...(fit.placement ?? DEFAULT_PLACEMENT), rotation })}
                      testId="fit-rotation"
                      suffix={suffix}
                    />
                  </div>
                )}
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
          <div
            role="tabpanel"
            id={`crop-editor-panel-background${suffix}`}
            aria-labelledby={`crop-editor-tab-background${suffix}`}
            hidden={activeTab !== "background"}
            className="space-y-4"
          >
            {/* Stays mounted while fitting: the mode buttons open its file picker.
                Small screens have no background tab; their colour sits in the size tab. */}
            {fitting && !compact && (
              <FitControls
                fit={fit}
                suffix={suffix}
                section="background"
                backgroundInput={suffix ? backgroundInputMobile : backgroundInput}
              />
            )}
          </div>
          <div
            role="tabpanel"
            id={`crop-editor-panel-layers${suffix}`}
            aria-labelledby={`crop-editor-tab-layers${suffix}`}
            hidden={activeTab !== "layers"}
            className="space-y-4"
          >
            {activeTab === "layers" && (
              <FitLayersPanel
                fit={fit}
                suffix={suffix}
                editRequest={editRequest}
                onEditHandled={() => setEditRequest(0)}
              />
            )}
          </div>
          {fitting && <FitStatus fit={fit} suffix={suffix} canApplyToAll={!!onApplyFitToAll} />}
        </>
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
          <div className="crop-editor-fade-in flex min-h-0 min-w-0 flex-1 flex-col">
          {placing && (
            <StageToolbar
              canUndo={fit.canUndo}
              canRedo={fit.canRedo}
              onUndo={fit.undo}
              onRedo={fit.redo}
              layerSelected={selectedLayer !== null}
              canDuplicate={
                selectedLayer?.kind === "text"
                  ? fit.layers.filter((l) => l.kind === "text").length < MAX_TEXT_LAYERS
                  : fit.layers.filter((l) => l.kind === "image").length < MAX_IMAGE_LAYERS
              }
              onDuplicate={() => selectedLayer && fit.duplicateLayer(selectedLayer.id)}
              onDelete={() => selectedLayer && fit.removeLayer(selectedLayer.id)}
              compact={compact}
              disabled={fit.batchWorking}
              isDarkTheme={isDarkTheme}
            />
          )}
          <div
            ref={previewWrapperRef}
            className="relative flex-1 min-h-0 min-w-0 flex items-center justify-center p-3"
          >
            {placing && activeFit ? (
              stageBox && (
                <FitPlacementStage
                  imgUrl={imgUrl}
                  imgSize={imgSize}
                  crop={crop}
                  fit={activeFit}
                  placement={fit.placement}
                  onChange={fit.setPlacement}
                  backgroundPlacement={fit.backgroundPlacement}
                  onBackgroundChange={fit.setBackgroundPlacement}
                  layers={fit.layers}
                  onLayerChange={fit.updateLayer}
                  onRemoveLayer={fit.removeLayer}
                  onDuplicateLayer={fit.duplicateLayer}
                  onEditText={(id) => {
                    fit.setSelected(id);
                    openTab("layers");
                    setEditRequest((n) => n + 1);
                  }}
                  selected={fit.selected}
                  onSelect={(next) => {
                    fit.setSelected(next);
                    // In Fill frame the fit tab shows the selection, not the stage: stay and turn it here.
                    if (next === "image") {
                      if (!baseLocked) openTab("fit");
                    }
                    else if (next === "background") openTab("background");
                    else if (next) openTab("layers");
                  }}
                  baseLocked={baseLocked}
                  preview={fit.preview}
                  previewCurrent={fit.previewCurrent}
                  box={stageBox}
                  disabled={editorBusy || (!baseLocked && !fit.placementEnabled)}
                  previewAlt={t("crop.fit.preview")}
                  showGrid={showGrid}
                />
              )
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
                      "absolute border-sky-400/85 outline-none focus-visible:ring-2 focus-visible:ring-sky-300",
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
                    onKeyDown={onSelectionKeyDown}
                    tabIndex={0}
                    role="group"
                    aria-label={t("crop.selectionKeyboard")}
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
            {!placing && (
              <div
                role="group"
                aria-label={`${t("crop.zoom")} · ${t("crop.viewOnly")}`}
                data-testid="crop-zoom-controls"
                className={cn(
                  "absolute bottom-3 left-1/2 z-20 flex max-w-[calc(100%-1rem)] -translate-x-1/2 items-center gap-1 rounded-lg border p-1.5 shadow-sm",
                  isDarkTheme ? "border-slate-700 bg-slate-950/95" : "border-slate-200 bg-white/95",
                )}
              >
                <span className="hidden px-2 text-xs whitespace-nowrap opacity-70 sm:inline">{t("crop.viewOnly")}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0"
                  onClick={() => setZoom(zoom - ZOOM_STEP)}
                  disabled={zoom <= ZOOM_MIN}
                  aria-label={t("crop.zoomOut")}
                  title={t("crop.zoomOut")}
                  data-testid="crop-zoom-out"
                ><Minus className="size-4" aria-hidden="true" /></Button>
                <output className="w-12 text-center text-xs tabular-nums" aria-live="polite" data-testid="crop-zoom-label">
                  {Math.round(zoom * 100)}%
                </output>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0"
                  onClick={() => setZoom(zoom + ZOOM_STEP)}
                  disabled={zoom >= ZOOM_MAX}
                  aria-label={t("crop.zoomIn")}
                  title={t("crop.zoomIn")}
                  data-testid="crop-zoom-in"
                ><Plus className="size-4" aria-hidden="true" /></Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0"
                  onClick={resetView}
                  aria-label={t("crop.resetZoomFull")}
                  title={t("crop.resetZoomFull")}
                  data-testid="crop-zoom-reset"
                ><RotateCcw className="size-4" aria-hidden="true" /></Button>
              </div>
            )}
          </div>
          </div>

          {/* Desktop: fixed right-hand control panel */}
          <div
            className={cn(
              "crop-editor-fade-in hidden lg:flex lg:w-[22rem] shrink-0 flex-col gap-3 rounded-md border p-3 backdrop-blur-md overflow-hidden",
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
