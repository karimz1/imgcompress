"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  Archive,
  Check,
  Download,
  Loader2,
  RotateCcw,
  Sparkles,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { DownloadFileToast, DownloadZipToast } from "@/components/CustomToast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDownload } from "@/hooks/useDownload";
import { applyCropToFile, CropConfig } from "@/lib/crop";
import { fileDownloadUrl, zipDownloadUrl } from "@/lib/download";
import { cn } from "@/lib/utils";

interface RembgCompareResult {
  model: string;
  file: string;
}

type ModelStatus = "queued" | "running" | "done" | "failed";
type PreviewPan = { x: number; y: number };
type PreviewMode = "result" | "original";

const MIN_PREVIEW_ZOOM = 1;
const MAX_PREVIEW_ZOOM = 5;
const PREVIEW_ZOOM_STEP = 0.25;

interface RembgCompareDialogProps {
  files: File[];
  crops: Record<string, CropConfig>;
  openFileName: string | null;
  setOpenFileName: (name: string | null) => void;
  selectedModels: Record<string, string>;
  setModelForFile: (name: string, model: string | null) => void;
  outputFormat: string;
  quality: string;
  width: string;
  resizeWidthEnabled: boolean;
  rembgAvailableModels: string[];
  isDarkTheme: boolean;
  disableLogo?: boolean;
  onReportError?: (payload: { message: string; details?: string }) => void;
}

function buildInitialStatuses(models: string[]): Record<string, ModelStatus> {
  return Object.fromEntries(models.map((model) => [model, "queued" as ModelStatus]));
}

function createCompareToken() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function sendCompareCancel(cancelToken: string) {
  if (!cancelToken) return;

  const body = new URLSearchParams({ cancel_token: cancelToken });
  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const beaconBody = new Blob([body.toString()], {
      type: "application/x-www-form-urlencoded;charset=UTF-8",
    });
    navigator.sendBeacon("/api/rembg/compare/cancel", beaconBody);
    return;
  }

  void fetch("/api/rembg/compare/cancel", {
    method: "POST",
    body,
    keepalive: true,
  }).catch(() => undefined);
}

function clampPreviewZoom(value: number) {
  return Math.min(MAX_PREVIEW_ZOOM, Math.max(MIN_PREVIEW_ZOOM, value));
}

export const RembgCompareDialog: React.FC<RembgCompareDialogProps> = ({
  files,
  crops,
  openFileName,
  setOpenFileName,
  selectedModels,
  setModelForFile,
  outputFormat,
  quality,
  width,
  resizeWidthEnabled,
  rembgAvailableModels,
  isDarkTheme,
  disableLogo = false,
  onReportError,
}) => {
  const { t } = useTranslation();
  const download = useDownload();
  const onReportErrorRef = useRef(onReportError);
  const originalPreviewUrlRef = useRef("");
  const previewPanStartRef = useRef<{
    pointerX: number;
    pointerY: number;
    panX: number;
    panY: number;
  } | null>(null);
  const [destFolder, setDestFolder] = useState("");
  const [results, setResults] = useState<RembgCompareResult[]>([]);
  const [activeModel, setActiveModel] = useState("");
  const [currentModel, setCurrentModel] = useState("");
  const [modelStatuses, setModelStatuses] = useState<Record<string, ModelStatus>>({});
  const [modelErrors, setModelErrors] = useState<Record<string, string>>({});
  const [originalPreviewUrl, setOriginalPreviewUrl] = useState("");
  const [previewMode, setPreviewMode] = useState<PreviewMode>("result");
  const [loadedPreviewKey, setLoadedPreviewKey] = useState("");
  const [previewZoom, setPreviewZoom] = useState(1);
  const [previewPan, setPreviewPan] = useState<PreviewPan>({ x: 0, y: 0 });
  const [isPreviewPanning, setIsPreviewPanning] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onReportErrorRef.current = onReportError;
  }, [onReportError]);

  useEffect(
    () => () => {
      if (originalPreviewUrlRef.current) {
        URL.revokeObjectURL(originalPreviewUrlRef.current);
      }
    },
    []
  );

  const openFile = useMemo(
    () => (openFileName ? files.find((f) => f.name === openFileName) : null),
    [openFileName, files]
  );
  const selectedModelForOpenFile = openFile ? selectedModels[openFile.name] || "" : "";

  const closeEditor = () => setOpenFileName(null);

  const replaceOriginalPreviewUrl = useCallback((file: File | null) => {
    if (originalPreviewUrlRef.current) {
      URL.revokeObjectURL(originalPreviewUrlRef.current);
      originalPreviewUrlRef.current = "";
    }

    if (!file) {
      setOriginalPreviewUrl("");
      return;
    }

    const nextUrl = URL.createObjectURL(file);
    originalPreviewUrlRef.current = nextUrl;
    setOriginalPreviewUrl(nextUrl);
  }, []);

  const setPreviewZoomClamped = useCallback((nextZoom: number) => {
    const clampedZoom = clampPreviewZoom(nextZoom);
    setPreviewZoom(clampedZoom);
    if (clampedZoom === MIN_PREVIEW_ZOOM) {
      setPreviewPan({ x: 0, y: 0 });
    }
  }, []);

  const adjustPreviewZoom = useCallback(
    (delta: number) => {
      setPreviewZoom((currentZoom) => {
        const nextZoom = clampPreviewZoom(currentZoom + delta);
        if (nextZoom === MIN_PREVIEW_ZOOM) {
          setPreviewPan({ x: 0, y: 0 });
        }
        return nextZoom;
      });
    },
    []
  );

  const resetPreviewZoom = useCallback(() => {
    setPreviewZoom(MIN_PREVIEW_ZOOM);
    setPreviewPan({ x: 0, y: 0 });
  }, []);

  const modelGroups = useMemo(() => {
    const groups = new Map<string, RembgCompareResult[]>();
    for (const result of results) {
      groups.set(result.model, [...(groups.get(result.model) || []), result]);
    }
    return groups;
  }, [results]);

  const activeResults = activeModel ? modelGroups.get(activeModel) || [] : [];
  const activePreview = activeResults[0];
  const activePreviewKey = activePreview ? `${destFolder}/${activePreview.file}` : "";
  const doneCount = rembgAvailableModels.filter((model) => modelStatuses[model] === "done").length;
  const failedCount = rembgAvailableModels.filter((model) => modelStatuses[model] === "failed").length;
  const totalCount = rembgAvailableModels.length;
  const currentModelLabel = currentModel
    ? t(`form.rembgModel.options.${currentModel}`, { defaultValue: currentModel })
    : "";
  const warningTitle = t(
    "rembgCompare.warningTitle",
    { defaultValue: "Compare all AI models only when quality matters" }
  );
  const warningDescription = t(
    "rembgCompare.warningDescription",
    {
      defaultValue:
        "This editor runs all {{count}} installed local background-removal models for this image. It can take several minutes, especially with high-quality models. Finished results appear as soon as they are ready, and closing the editor cancels remaining work.",
      count: totalCount,
    }
  );

  const runComparison = useCallback(
    async (
      file: File,
      selectedModel: string,
      cancelToken: string,
      cancelled: () => boolean,
      signal: AbortSignal
    ) => {
      if (outputFormat !== "png" && outputFormat !== "avif") return;

      setIsComparing(true);
      setError(null);
      setResults([]);
      setDestFolder("");
      setActiveModel("");
      setCurrentModel("");
      setModelErrors({});
      setModelStatuses(buildInitialStatuses(rembgAvailableModels));
      setPreviewMode("result");

      let uploadFile: File;
      try {
        const crop = crops[file.name];
        uploadFile = crop ? await applyCropToFile(file, crop) : file;
        if (cancelled() || signal.aborted) return;
        replaceOriginalPreviewUrl(uploadFile);
      } catch (err) {
        if (cancelled()) return;
        const message = err instanceof Error ? err.message : "Failed to prepare this image.";
        setError(message);
        setIsComparing(false);
        onReportErrorRef.current?.({
          message,
          details: err instanceof Error ? err.stack : undefined,
        });
        return;
      }

      let sharedDestFolder = "";
      let hasAnySuccess = false;
      let lastError = "";
      let activeWasSet = false;

      try {
        for (const model of rembgAvailableModels) {
          if (cancelled() || signal.aborted) return;
          setCurrentModel(model);
          setModelStatuses((prev) => ({ ...prev, [model]: "running" }));

          const formData = new FormData();
          formData.append("file", uploadFile);
          formData.append("format", outputFormat);
          formData.append("model", model);
          formData.append("cancel_token", cancelToken);
          if (sharedDestFolder) {
            formData.append("dest_folder", sharedDestFolder);
          }
          if (outputFormat === "avif") {
            formData.append("quality", quality);
          }
          if (resizeWidthEnabled && width.trim()) {
            formData.append("width", width);
          }

          try {
            const response = await fetch("/api/rembg/compare", {
              method: "POST",
              body: formData,
              signal,
            });
            const payload = await response.json().catch(() => null);
            if (!response.ok) {
              throw new Error(payload?.message || payload?.error || "AI comparison failed.");
            }
            if (!payload?.dest_folder || !Array.isArray(payload.results)) {
              throw new Error("AI comparison returned an unexpected response.");
            }
            if (cancelled() || signal.aborted) return;

            sharedDestFolder = payload.dest_folder;
            const modelResults = payload.results as RembgCompareResult[];
            setDestFolder(sharedDestFolder);
            setResults((prev) => [
              ...prev.filter((result) => result.model !== model),
              ...modelResults,
            ]);
            setModelStatuses((prev) => ({ ...prev, [model]: "done" }));

            if (modelResults.length > 0) {
              hasAnySuccess = true;
              if (!activeWasSet || selectedModel === model) {
                setActiveModel(model);
                activeWasSet = true;
              }
            }
          } catch (err) {
            if (cancelled() || signal.aborted) return;
            const message = err instanceof Error ? err.message : "AI comparison failed.";
            lastError = message;
            setModelStatuses((prev) => ({ ...prev, [model]: "failed" }));
            setModelErrors((prev) => ({ ...prev, [model]: message }));
            onReportErrorRef.current?.({
              message,
              details: err instanceof Error ? err.stack : undefined,
            });
          }
        }

        if (!cancelled() && !hasAnySuccess) {
          setError(lastError || "No AI model finished successfully.");
        }
      } finally {
        if (!cancelled()) {
          setCurrentModel("");
          setIsComparing(false);
        }
      }
    },
    [
      crops,
      outputFormat,
      quality,
      rembgAvailableModels,
      replaceOriginalPreviewUrl,
      resizeWidthEnabled,
      width,
    ]
  );

  useEffect(() => {
    if (!openFile) return;
    let cancelled = false;
    let finished = false;
    const cancelToken = createCompareToken();
    const controller = new AbortController();
    void runComparison(
      openFile,
      selectedModelForOpenFile,
      cancelToken,
      () => cancelled,
      controller.signal
    ).finally(() => {
      finished = true;
    });
    return () => {
      cancelled = true;
      controller.abort();
      if (!finished) {
        sendCompareCancel(cancelToken);
      }
    };
  }, [openFile, selectedModelForOpenFile, runComparison]);

  useEffect(() => {
    if (!openFile) {
      replaceOriginalPreviewUrl(null);
    }
  }, [openFile, replaceOriginalPreviewUrl]);

  useEffect(() => {
    resetPreviewZoom();
    previewPanStartRef.current = null;
    setIsPreviewPanning(false);
  }, [activePreviewKey, resetPreviewZoom]);

  const handleUseModel = () => {
    if (!openFile || !activePreview || effectivePreviewMode === "original") return;
    setModelForFile(openFile.name, activePreview.model);
    closeEditor();
  };

  const handleDownloadSelected = async () => {
    if (!activePreview || !destFolder || effectivePreviewMode === "original") return;
    await download({
      url: fileDownloadUrl(destFolder, activePreview.file),
      fileName: activePreview.file,
      successToast: <DownloadFileToast fileName={activePreview.file} />,
    });
  };

  const handleDownloadAll = async () => {
    if (!destFolder) return;
    await download({
      url: zipDownloadUrl(destFolder),
      fileName: "ai-model-comparison.zip",
      successToast: <DownloadZipToast />,
    });
  };

  const handlePreviewWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!activePreview && previewMode !== "original") return;
    event.preventDefault();
    adjustPreviewZoom(event.deltaY > 0 ? -PREVIEW_ZOOM_STEP : PREVIEW_ZOOM_STEP);
  };

  const handlePreviewDoubleClick = () => {
    if (!activePreview && previewMode !== "original") return;
    if (previewZoom === MIN_PREVIEW_ZOOM) {
      setPreviewZoomClamped(2);
    } else {
      resetPreviewZoom();
    }
  };

  const handlePreviewPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((!activePreview && previewMode !== "original") || previewZoom === MIN_PREVIEW_ZOOM) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    previewPanStartRef.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      panX: previewPan.x,
      panY: previewPan.y,
    };
    setIsPreviewPanning(true);
  };

  const handlePreviewPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = previewPanStartRef.current;
    if (!start) return;
    setPreviewPan({
      x: start.panX + event.clientX - start.pointerX,
      y: start.panY + event.clientY - start.pointerY,
    });
  };

  const stopPreviewPanning = (event: React.PointerEvent<HTMLDivElement>) => {
    previewPanStartRef.current = null;
    setIsPreviewPanning(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const statusLabel = (model: string) => {
    const status = modelStatuses[model] || "queued";
    if (status === "done") return model;
    if (status === "failed") return `${model} · failed`;
    if (status === "running") return `${model} · preparing`;
    return `${model} · waiting`;
  };

  const dialogContentClass = isDarkTheme
    ? "border-white/10 bg-gradient-to-br from-slate-950/95 via-slate-900/92 to-slate-950/95 text-gray-100 shadow-[0_36px_90px_rgba(15,23,42,0.7)]"
    : "border-slate-200 bg-gradient-to-br from-slate-50/95 via-white/92 to-slate-100/95 text-slate-900 shadow-[0_24px_60px_rgba(15,23,42,0.16)]";
  const panelClass = isDarkTheme
    ? "border-white/10 bg-slate-950/70"
    : "border-slate-200 bg-white/80";
  const warningClass = isDarkTheme
    ? "border-amber-400/25 bg-amber-400/10 text-amber-100"
    : "border-amber-300 bg-amber-50 text-amber-950";
  const zoomControlClass = isDarkTheme
    ? "border-white/10 bg-slate-950/90 text-gray-100"
    : "border-slate-200 bg-white/90 text-slate-900";
  const previewZoomPercent = Math.round(previewZoom * 100);
  const activePreviewUrl = activePreview
    ? fileDownloadUrl(destFolder, activePreview.file)
    : "";
  const activePreviewModelLabel = activePreview
    ? t(`form.rembgModel.options.${activePreview.model}`, {
        defaultValue: activePreview.model,
      })
    : "";
  const canCompareOriginal = Boolean(originalPreviewUrl);
  const effectivePreviewMode: PreviewMode =
    canCompareOriginal && previewMode === "original" ? "original" : "result";
  const hasPreview = Boolean(activePreview) || effectivePreviewMode === "original";
  const isActivePreviewLoaded = Boolean(activePreviewKey && loadedPreviewKey === activePreviewKey);
  const isWaitingForActivePreview =
    Boolean(activePreview) && effectivePreviewMode !== "original" && !isActivePreviewLoaded;
  const previewTransform = `translate3d(${previewPan.x}px, ${previewPan.y}px, 0) scale(${previewZoom})`;

  return (
    <Dialog
      open={!!openFile}
      onOpenChange={(open) => {
        if (!open) closeEditor();
      }}
    >
      <DialogContent
        className={cn(
          "max-w-[95vw] w-[95vw] sm:max-w-[92vw] lg:max-w-[88vw] xl:max-w-[80vw] h-[92vh] max-h-[92vh] p-3 sm:p-4 flex flex-col gap-3 overflow-hidden border data-[state=open]:slide-in-from-left-0 data-[state=open]:slide-in-from-top-0 data-[state=closed]:slide-out-to-left-0 data-[state=closed]:slide-out-to-top-0 origin-center",
          dialogContentClass
        )}
        data-testid="rembg-compare-dialog"
      >
        <DialogHeader className="shrink-0">
          <div className="flex items-center gap-3 pr-12">
            {!disableLogo && (
              <BrandLogo
                variant="face"
                alt=""
                width={44}
                height={36}
                style={{ width: "auto", height: "auto" }}
                className="h-9 w-auto max-w-14 object-contain shrink-0 drop-shadow-sm"
              />
            )}
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-sm font-medium leading-tight truncate">
                {!disableLogo && (
                  <>
                    <span className="opacity-70">imgcompress</span>
                    <span className="opacity-40 px-1.5">·</span>
                  </>
                )}
                <span>{t("rembgCompare.editorTitle", { defaultValue: "AI editor" })}</span>
                {openFile && (
                  <>
                    <span className="opacity-40 px-1.5">·</span>
                    <span className="opacity-90">{openFile.name}</span>
                  </>
                )}
              </DialogTitle>
              <DialogDescription className="sr-only">
                {t("rembgCompare.editorDescription", {
                  defaultValue: "Compare local AI models for this image.",
                })}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className={cn("shrink-0 rounded-md border p-3", warningClass)}>
          <div className="flex gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-1 text-sm">
              <p className="font-semibold">{warningTitle}</p>
              <p className="opacity-85">
                {warningDescription}
              </p>
            </div>
          </div>
        </div>

        <div className={cn("flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs", panelClass)}>
          <span>
            {t(
              "rembgCompare.progressSummary",
              {
                defaultValue: "{{done}} of {{total}} ready · {{failed}} failed",
                done: doneCount,
                failed: failedCount,
                total: totalCount,
              }
            )}
          </span>
          {isComparing && currentModelLabel && (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-500" />
              {t("rembgCompare.currentModel", {
                defaultValue: "Preparing {{model}}",
                model: currentModelLabel,
              })}
            </span>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="flex shrink-0 gap-2 overflow-x-auto pb-1">
            <Button
              type="button"
              size="sm"
              variant={effectivePreviewMode === "original" ? "default" : "outline"}
              onClick={() => {
                if (canCompareOriginal) setPreviewMode("original");
              }}
              disabled={!canCompareOriginal}
              title={t("rembgCompare.originalTabTitle", {
                defaultValue: "Show the source image before background removal.",
              })}
              className={cn(
                "h-auto min-w-32 shrink-0 flex-col items-start gap-1 py-2 text-left",
                !canCompareOriginal && "opacity-75"
              )}
              data-testid="rembg-compare-original-tab"
            >
              <span className="flex items-center gap-1.5">
                <span>{t("rembgCompare.viewOriginal", { defaultValue: "Original" })}</span>
              </span>
              <span className="text-[11px] font-normal opacity-75">
                {t("rembgCompare.originalTabStatus", { defaultValue: "source image" })}
              </span>
            </Button>
            {rembgAvailableModels.map((model) => {
              const status = modelStatuses[model] || "queued";
              const isReady = status === "done" && modelGroups.has(model);
              const isActive = effectivePreviewMode !== "original" && activeModel === model;
              const label = t(`form.rembgModel.options.${model}`, { defaultValue: model });
              return (
                <Button
                  key={model}
                  type="button"
                  size="sm"
                  variant={isActive ? "default" : "outline"}
                  onClick={() => {
                    if (isReady) {
                      setPreviewMode("result");
                      setActiveModel(model);
                    }
                  }}
                  disabled={!isReady}
                  title={
                    isReady
                      ? label
                      : t("rembgCompare.disabledTabTitle", {
                          defaultValue: "{{model}} is still being prepared. Please wait.",
                          model: label,
                        })
                  }
                  className={cn(
                    "h-auto min-w-36 shrink-0 flex-col items-start gap-1 py-2 text-left",
                    !isReady && "opacity-75"
                  )}
                  data-testid="rembg-compare-model-tab"
                >
                  <span className="flex items-center gap-1.5">
                    {status === "done" && <Check className="h-3.5 w-3.5" />}
                    {(status === "running" || status === "queued") && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    )}
                    {status === "failed" && <AlertTriangle className="h-3.5 w-3.5" />}
                    <span>{label}</span>
                  </span>
                  <span className="text-[11px] font-normal opacity-75">
                    {statusLabel(model)}
                  </span>
                </Button>
              );
            })}
          </div>

          {error && results.length === 0 && !isComparing && (
            <div className={cn("rounded-md border border-red-500/30 bg-red-500/10 p-4", panelClass)}>
              <p className="font-semibold text-red-500">
                {t("rembgCompare.errorTitle", { defaultValue: "AI comparison failed" })}
              </p>
              <p className="mt-1 text-sm opacity-80">{error}</p>
            </div>
          )}

          <div
            className={cn(
              "relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-md border",
              hasPreview && previewZoom > MIN_PREVIEW_ZOOM && !isPreviewPanning && "cursor-grab",
              hasPreview && isPreviewPanning && "cursor-grabbing",
              panelClass
            )}
            onWheel={handlePreviewWheel}
            onDoubleClick={handlePreviewDoubleClick}
            onPointerDown={handlePreviewPointerDown}
            onPointerMove={handlePreviewPointerMove}
            onPointerUp={stopPreviewPanning}
            onPointerCancel={stopPreviewPanning}
          >
            {hasPreview ? (
              <>
                <div
                  className={cn(
                    "absolute right-2 top-2 z-30 flex items-center gap-1 rounded-md border p-1 shadow-sm backdrop-blur",
                    zoomControlClass
                  )}
                  onDoubleClick={(event) => event.stopPropagation()}
                  onPointerDown={(event) => event.stopPropagation()}
                  onWheel={(event) => event.stopPropagation()}
                >
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={previewZoom === MIN_PREVIEW_ZOOM}
                    title={t("rembgCompare.zoomOut", { defaultValue: "Zoom out" })}
                    aria-label={t("rembgCompare.zoomOut", { defaultValue: "Zoom out" })}
                    onClick={() => adjustPreviewZoom(-PREVIEW_ZOOM_STEP)}
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="min-w-11 text-center text-xs font-mono tabular-nums">
                    {previewZoomPercent}%
                  </span>
                  <input
                    type="range"
                    min={MIN_PREVIEW_ZOOM}
                    max={MAX_PREVIEW_ZOOM}
                    step={PREVIEW_ZOOM_STEP}
                    value={previewZoom}
                    aria-label={t("rembgCompare.zoomLevel", { defaultValue: "Zoom level" })}
                    onChange={(event) => setPreviewZoomClamped(Number(event.target.value))}
                    className="hidden w-24 accent-purple-500 sm:block"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={previewZoom === MAX_PREVIEW_ZOOM}
                    title={t("rembgCompare.zoomIn", { defaultValue: "Zoom in" })}
                    aria-label={t("rembgCompare.zoomIn", { defaultValue: "Zoom in" })}
                    onClick={() => adjustPreviewZoom(PREVIEW_ZOOM_STEP)}
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={previewZoom === MIN_PREVIEW_ZOOM && previewPan.x === 0 && previewPan.y === 0}
                    title={t("rembgCompare.resetZoom", { defaultValue: "Reset zoom" })}
                    aria-label={t("rembgCompare.resetZoom", { defaultValue: "Reset zoom" })}
                    onClick={resetPreviewZoom}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
                <img
                  key={`preview-${activePreviewKey || "original"}-${effectivePreviewMode}`}
                  src={effectivePreviewMode === "original" ? originalPreviewUrl : activePreviewUrl}
                  alt={
                    effectivePreviewMode === "original" || !activePreview
                      ? t("rembgCompare.originalPreviewAlt", {
                          defaultValue: "Original image preview",
                        })
                      : t("rembgCompare.previewAlt", {
                          defaultValue: "{{model}} background-removal preview",
                          model: t(`form.rembgModel.options.${activePreview.model}`, {
                            defaultValue: activePreview.model,
                          }),
                        })
                  }
                  draggable={false}
                  decoding="async"
                  onLoad={() => {
                    if (effectivePreviewMode !== "original" && activePreviewKey) {
                      setLoadedPreviewKey(activePreviewKey);
                    }
                  }}
                  style={{ transform: previewTransform }}
                  className={cn(
                    "max-h-full max-w-full select-none object-contain will-change-transform",
                    !isPreviewPanning && "transition-transform duration-100",
                    isWaitingForActivePreview && "opacity-0"
                  )}
                />
                {isWaitingForActivePreview && (
                  <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/10 text-center backdrop-blur-[1px]">
                    <Loader2 className="mb-2 h-7 w-7 animate-spin text-purple-500" />
                    <p className="text-sm font-medium">
                      {t("rembgCompare.previewLoading", {
                        defaultValue: "Loading this model preview",
                      })}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center p-6 text-center">
                {isComparing ? (
                  <>
                    <Loader2 className="mb-3 h-8 w-8 animate-spin text-purple-500" />
                    <p className="text-base font-semibold">
                      {t("rembgCompare.loadingTitle", {
                        defaultValue: "Comparing AI models",
                      })}
                    </p>
                    <p className="mt-1 max-w-md text-sm opacity-75">
                      {currentModelLabel
                        ? t(
                            "rembgCompare.modelLoadingDescription",
                            {
                              defaultValue:
                                "Preparing {{model}}. Large models can take several minutes, finished results appear as soon as they are ready, and closing this editor cancels remaining work.",
                              model: currentModelLabel,
                            }
                          )
                        : t("rembgCompare.loadingDescription", {
                            defaultValue: "Comparing AI models can take a moment.",
                          })}
                    </p>
                  </>
                ) : (
                  <p className="text-sm opacity-70">
                    {t("rembgCompare.empty", { defaultValue: "No preview available." })}
                  </p>
                )}
              </div>
            )}
          </div>

          {activePreview && effectivePreviewMode !== "original" && (
            <p className="shrink-0 truncate text-center text-xs font-mono opacity-70">
              {activePreview.file}
            </p>
          )}

          {Object.keys(modelErrors).length > 0 && (
            <p className="shrink-0 text-xs text-red-500">
              {t(
                "rembgCompare.partialFailure",
                {
                  defaultValue: "{{count}} model(s) could not be prepared.",
                  count: Object.keys(modelErrors).length,
                }
              )}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
          <p className="min-w-0 flex-1 truncate text-xs opacity-75">
            {activePreview && openFile && effectivePreviewMode !== "original"
              ? t("rembgCompare.applyHint", {
                  defaultValue: "Applies only to {{file}} · {{model}}",
                  file: openFile.name,
                  model: activePreviewModelLabel,
                })
              : t("rembgCompare.chooseModelHint", {
                  defaultValue: "Choose a finished model for this image.",
                })}
          </p>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeEditor}>
              {t("rembgCompare.close", { defaultValue: "Close" })}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleDownloadAll}
              disabled={!destFolder || isComparing || results.length === 0}
            >
              <Archive className="h-4 w-4" />
              {t("rembgCompare.downloadAll", { defaultValue: "Download all as ZIP" })}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleDownloadSelected}
              disabled={!activePreview || effectivePreviewMode === "original"}
            >
              <Download className="h-4 w-4" />
              {t("rembgCompare.downloadSelected", { defaultValue: "Download selected" })}
            </Button>
            <Button
              type="button"
              onClick={handleUseModel}
              disabled={!activePreview || effectivePreviewMode === "original"}
              data-testid="rembg-compare-use-model-btn"
              title={
                openFile && activePreview && effectivePreviewMode !== "original"
                  ? t("rembgCompare.useModelForFileTitle", {
                      defaultValue: "Use {{model}} for {{file}}",
                      file: openFile.name,
                      model: activePreviewModelLabel,
                    })
                  : undefined
              }
            >
              <Sparkles className="h-4 w-4" />
              {t("rembgCompare.useModel", { defaultValue: "Use for this image" })}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
