"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Archive, Check, Download, Loader2, Sparkles } from "lucide-react";
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
  const [destFolder, setDestFolder] = useState("");
  const [results, setResults] = useState<RembgCompareResult[]>([]);
  const [activeModel, setActiveModel] = useState("");
  const [currentModel, setCurrentModel] = useState("");
  const [modelStatuses, setModelStatuses] = useState<Record<string, ModelStatus>>({});
  const [modelErrors, setModelErrors] = useState<Record<string, string>>({});
  const [isComparing, setIsComparing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onReportErrorRef.current = onReportError;
  }, [onReportError]);

  const openFile = useMemo(
    () => (openFileName ? files.find((f) => f.name === openFileName) : null),
    [openFileName, files]
  );
  const selectedModelForOpenFile = openFile ? selectedModels[openFile.name] || "" : "";

  const closeEditor = () => setOpenFileName(null);

  const modelGroups = useMemo(() => {
    const groups = new Map<string, RembgCompareResult[]>();
    for (const result of results) {
      groups.set(result.model, [...(groups.get(result.model) || []), result]);
    }
    return groups;
  }, [results]);

  const activeResults = activeModel ? modelGroups.get(activeModel) || [] : [];
  const activePreview = activeResults[0];
  const doneCount = rembgAvailableModels.filter((model) => modelStatuses[model] === "done").length;
  const failedCount = rembgAvailableModels.filter((model) => modelStatuses[model] === "failed").length;
  const totalCount = rembgAvailableModels.length;
  const currentModelLabel = currentModel
    ? t(`form.rembgModel.options.${currentModel}`, currentModel)
    : "";

  const runComparison = useCallback(
    async (
      file: File,
      selectedModel: string,
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

      let uploadFile: File;
      try {
        const crop = crops[file.name];
        uploadFile = crop ? await applyCropToFile(file, crop) : file;
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
      resizeWidthEnabled,
      width,
    ]
  );

  useEffect(() => {
    if (!openFile) return;
    let cancelled = false;
    const controller = new AbortController();
    void runComparison(openFile, selectedModelForOpenFile, () => cancelled, controller.signal);
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [openFile, selectedModelForOpenFile, runComparison]);

  const handleUseModel = () => {
    if (!openFile || !activePreview) return;
    setModelForFile(openFile.name, activePreview.model);
    closeEditor();
  };

  const handleDownloadSelected = async () => {
    if (!activePreview || !destFolder) return;
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

  const statusLabel = (model: string) => {
    const status = modelStatuses[model] || "queued";
    if (status === "done") return t("rembgCompare.statusReady");
    if (status === "failed") return t("rembgCompare.statusFailed");
    if (status === "running") return t("rembgCompare.statusPreparing");
    return t("rembgCompare.statusWaiting");
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
                <span>{t("rembgCompare.editorTitle")}</span>
                {openFile && (
                  <>
                    <span className="opacity-40 px-1.5">·</span>
                    <span className="opacity-90">{openFile.name}</span>
                  </>
                )}
              </DialogTitle>
              <DialogDescription className="sr-only">
                {t("rembgCompare.editorDescription")}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className={cn("shrink-0 rounded-md border p-3", warningClass)}>
          <div className="flex gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-1 text-sm">
              <p className="font-semibold">{t("rembgCompare.warningTitle")}</p>
              <p className="opacity-85">
                {t("rembgCompare.warningDescription", { count: totalCount })}
              </p>
            </div>
          </div>
        </div>

        <div className={cn("flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs", panelClass)}>
          <span>
            {t("rembgCompare.progressSummary", {
              done: doneCount,
              failed: failedCount,
              total: totalCount,
            })}
          </span>
          {isComparing && currentModelLabel && (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-500" />
              {t("rembgCompare.currentModel", { model: currentModelLabel })}
            </span>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="flex shrink-0 gap-2 overflow-x-auto pb-1">
            {rembgAvailableModels.map((model) => {
              const status = modelStatuses[model] || "queued";
              const isReady = status === "done" && modelGroups.has(model);
              const isActive = activeModel === model;
              const label = t(`form.rembgModel.options.${model}`, model);
              return (
                <Button
                  key={model}
                  type="button"
                  size="sm"
                  variant={isActive ? "default" : "outline"}
                  onClick={() => {
                    if (isReady) setActiveModel(model);
                  }}
                  disabled={!isReady}
                  title={
                    isReady
                      ? label
                      : t("rembgCompare.disabledTabTitle", { model: label })
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
                      <Loader2
                        className={cn(
                          "h-3.5 w-3.5",
                          status === "running" && "animate-spin"
                        )}
                      />
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
              <p className="font-semibold text-red-500">{t("rembgCompare.errorTitle")}</p>
              <p className="mt-1 text-sm opacity-80">{error}</p>
            </div>
          )}

          <div className={cn("flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-md border", panelClass)}>
            {activePreview ? (
              <img
                src={fileDownloadUrl(destFolder, activePreview.file)}
                alt={t("rembgCompare.previewAlt", {
                  model: t(`form.rembgModel.options.${activePreview.model}`, activePreview.model),
                })}
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <div className="flex flex-col items-center justify-center p-6 text-center">
                {isComparing ? (
                  <>
                    <Loader2 className="mb-3 h-8 w-8 animate-spin text-purple-500" />
                    <p className="text-base font-semibold">{t("rembgCompare.loadingTitle")}</p>
                    <p className="mt-1 max-w-md text-sm opacity-75">
                      {currentModelLabel
                        ? t("rembgCompare.modelLoadingDescription", { model: currentModelLabel })
                        : t("rembgCompare.loadingDescription")}
                    </p>
                  </>
                ) : (
                  <p className="text-sm opacity-70">{t("rembgCompare.empty")}</p>
                )}
              </div>
            )}
          </div>

          {activePreview && (
            <p className="shrink-0 truncate text-center text-xs font-mono opacity-70">
              {activePreview.file}
            </p>
          )}

          {Object.keys(modelErrors).length > 0 && (
            <p className="shrink-0 text-xs text-red-500">
              {t("rembgCompare.partialFailure", { count: Object.keys(modelErrors).length })}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={closeEditor}>
            {t("rembgCompare.close")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleDownloadAll}
            disabled={!destFolder || isComparing || results.length === 0}
          >
            <Archive className="h-4 w-4" />
            {t("rembgCompare.downloadAll")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleDownloadSelected}
            disabled={!activePreview}
          >
            <Download className="h-4 w-4" />
            {t("rembgCompare.downloadSelected")}
          </Button>
          <Button
            type="button"
            onClick={handleUseModel}
            disabled={!activePreview}
            data-testid="rembg-compare-use-model-btn"
          >
            <Sparkles className="h-4 w-4" />
            {t("rembgCompare.useModel")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
