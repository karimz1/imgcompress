"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  PDF_QUALITY_OPTIONS,
  toPdfQualityOption,
  type PdfQualityOption,
} from "@/lib/pdfQuality";
import { useDropzone } from "react-dropzone";
import { Check, Crop as CropIcon, Info, Loader2, Sparkles, Timer, Trash, TriangleAlert, X } from "lucide-react";
import { useMountedTheme } from "@/hooks/useMountedTheme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { SupportedFormatsDialog } from "@/components/SupportedFormatsDialog";
import { InputFileBadge } from "@/components/InputFileBadge";
import { CropDialog } from "@/components/crop/CropDialog";
import { clampCrop, CropConfig, isCropableFile, isCropUnsupportedFile, isSvgFile } from "@/lib/crop";
import {
  UPSCALE_TARGETS, UPSCALE_MODELS, UPSCALE_TARGET_SHORT, toUpscaleTarget,
  type UpscaleSettings, type UpscaleModelStatus, type UpscaleModel, type UpscaleDenoise,
  UPSCALE_DENOISE_LEVELS, upscaleModelParam,
} from "@/lib/upscale";
import { isLargeUpscaleTarget, planUpscale, type PixelSize, type UpscalePlan } from "@/lib/upscalePlan";
import { useMaxOutputMegapixels } from "@/lib/upscaleLimit";
import { useImagePixelSizes } from "@/hooks/useImagePixelSizes";
import { cn } from "@/lib/utils";
import { formatUploadLimit, useMaxUploadSizeMb } from "@/lib/uploadLimit";

interface FileConversionFormProps {
  isLoading: boolean;
  error: { message: string; details?: string } | null;
  quality: string;
  setQuality: (val: string) => void;
  width: string;
  setWidth: (val: string) => void;
  resizeWidthEnabled: boolean;
  setResizeWidthEnabled: (val: boolean) => void;
  upscale: UpscaleSettings;
  setUpscale: (val: UpscaleSettings) => void;
  upscaleModelName: string | null;
  upscaleAvailable: boolean;
  upscaleModels: UpscaleModelStatus[];
  outputFormat: string;
  setOutputFormat: (val: string) => void;
  formatRequired: boolean;
  pdfPreset: string;
  setPdfPreset: (val: string) => void;
  pdfScale: string;
  setPdfScale: (val: string) => void;
  pdfMarginMm: string;
  setPdfMarginMm: (val: string) => void;
  pdfPaginate: boolean;
  setPdfPaginate: (val: boolean) => void;
  pdfQuality: PdfQualityOption;
  setPdfQuality: (val: PdfQualityOption) => void;
  files: File[];
  removeFile: (name: string) => void;
  clearFileSelection: () => void;
  onSubmit: (e: React.FormEvent) => void;

  crops: Record<string, CropConfig>;
  openCropFor: string | null;
  setOpenCropFor: (name: string | null) => void;
  setCropForFile: (name: string, crop: CropConfig | null) => void;

  targetSizeMB: string;
  setTargetSizeMB: (val: string) => void;

  compressionMode: "quality" | "size";
  setCompressionMode: (val: "quality" | "size") => void;

  useRembg: boolean;
  setUseRembg: (val: boolean) => void;
  rembgModelName: string | null;

  webpLossless: boolean;
  setWebpLossless: (val: boolean) => void;

  getRootProps: ReturnType<typeof useDropzone>["getRootProps"];
  getInputProps: ReturnType<typeof useDropzone>["getInputProps"];
  isDragActive: boolean;

  supportedExtensions: string[]
  verifiedExtensions: string[]
  cropUnsupportedExtensions: string[]
  extensionsLoading: boolean
  extensionsError: Error | null
  disableLogo?: boolean

  onReportCropError?: (payload: { message: string; details?: string }) => void
}

const FileConversionForm: React.FC<FileConversionFormProps> = ({
  isLoading,
  error,
  quality,
  setQuality,
  width,
  setWidth,
  resizeWidthEnabled,
  setResizeWidthEnabled,
  upscale,
  setUpscale,
  upscaleModelName,
  upscaleAvailable,
  upscaleModels,
  outputFormat,
  setOutputFormat,
  formatRequired,
  pdfPreset,
  setPdfPreset,
  pdfScale,
  setPdfScale,
  pdfMarginMm,
  setPdfMarginMm,
  pdfPaginate,
  setPdfPaginate,
  pdfQuality,
  setPdfQuality,
  files,
  removeFile,
  clearFileSelection,
  onSubmit,
  crops,
  openCropFor,
  setOpenCropFor,
  setCropForFile,
  targetSizeMB,
  setTargetSizeMB,
  compressionMode,
  setCompressionMode,
  useRembg,
  setUseRembg,
  rembgModelName,
  webpLossless,
  setWebpLossless,
  getRootProps,
  getInputProps,
  isDragActive,
  supportedExtensions,
  verifiedExtensions,
  cropUnsupportedExtensions,
  extensionsLoading,
  extensionsError,
  disableLogo = false,
  onReportCropError,
}) => {
  const [confirmCropRemoveFor, setConfirmCropRemoveFor] = useState<string | null>(null);
  const { isDarkTheme } = useMountedTheme();
  const { t, i18n } = useTranslation();
  const onlySvgFiles = files.length > 0 && files.every(isSvgFile);
  const upscaleLabel = t(onlySvgFiles ? "form.upscale.vectorLabel" : "form.upscale.label");

  const tooltipContent = {
    outputFormat: t("form.outputFormat.tooltip"),
    pdfPreset: t("form.pdfPreset.tooltip"),
    pdfQuality: t("form.pdfQuality.tooltip"),
    pdfScale: t("form.pdfScale.tooltip"),
    pdfMargin: t("form.pdfMargin.tooltip"),
    pdfPaginate: t("form.pdfPaginate.tooltip"),
    quality: t("form.quality.tooltip"),
    resizeWidth: t("form.resizeWidth.tooltip"),
    upscale: t("form.upscale.tooltip", { model: upscaleModelName?.trim() || "Real-ESRGAN" }),
    targetSize: t("form.targetSize.tooltip"),
    rembg: t("form.rembg.tooltip"),
    webpLossless: t("form.webpLossless.tooltip"),
  };
  const subtleText = isDarkTheme ? "text-gray-400" : "text-slate-600";
  const surfaceInputClass = isDarkTheme
    ? "bg-gray-800 text-gray-100 placeholder-gray-400 border border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
    : "bg-white text-slate-900 placeholder-slate-400 border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-400";
  const selectSurface = isDarkTheme
    ? "bg-gray-800 text-gray-300 border-gray-700"
    : "bg-white text-slate-900 border-slate-300";
  const tooltipSurface = isDarkTheme
    ? "bg-gray-800 text-white border-white/10"
    : "bg-white text-slate-900 border-slate-200";
  const filePillClass = isDarkTheme
    ? "bg-gray-800 text-gray-100 border border-gray-700"
    : "bg-slate-100 text-slate-900 border border-slate-200";
  const parsedPdfMargin = parseFloat(pdfMarginMm);
  const pdfMarginValue =
    pdfMarginMm.trim() === "" || Number.isNaN(parsedPdfMargin) ? 10 : parsedPdfMargin;
  const rembgLabel = rembgModelName?.trim() || "rembg";
  // Lossless WebP has no quality knob, so it gets neither the quality slider nor
  // the max-file-size search.
  const hasQualitySettings =
    outputFormat === "jpeg" ||
    outputFormat === "avif" ||
    (outputFormat === "webp" && !webpLossless);
  // "WebP" is written in mixed case everywhere else in the UI.
  const outputFormatLabel = outputFormat === "webp" ? "WebP" : outputFormat.toUpperCase();
  const supportsBackgroundRemoval =
    outputFormat === "png" || outputFormat === "avif" || outputFormat === "webp";
  const upscaleVisible = outputFormat !== "pdf";
  const fitActive = outputFormat !== "pdf" && Object.values(crops).some((crop) => crop.fit);
  // Fitted images already have their final size, so upscaling them would undo it.
  const upscaleActive = upscaleVisible && upscale.enabled && !fitActive;
  const pixelSizes = useImagePixelSizes(files, upscaleActive);
  const maxOutputMegapixels = useMaxOutputMegapixels();
  /** What the server will make of this file; null when the browser cannot tell. */
  const upscalePlanFor = (file: File): UpscalePlan | null => {
    const measured = pixelSizes[file.name];
    if (!measured) return null;
    const crop = crops[file.name];
    // A saved crop is cut in the browser first, so the server upscales the cut-out.
    const source = crop ? clampCrop(crop, measured.width, measured.height) : measured;
    return planUpscale(source.width, source.height, upscale.target, maxOutputMegapixels * 1_000_000);
  };
  const renderError = useMemo(
    () =>
      error && (
        <div
          data-testid="error-holder"
          className="p-2 bg-red-600 text-white rounded-md"
        >
          <p data-testid="error-message-holder">
            <strong>{t("form.error.label")}</strong> {error.message}
          </p>
          {error.details && (
            <p data-testid="error-details-holder">
              <strong>{t("form.error.detailsLabel")}</strong> {error.details}
            </p>
          )}
        </div>
      ),
    [error, t]
  );

  const renderFilesList = useMemo(
    () =>
      files.length > 0 && (
        <div className="mt-2 space-y-1">
          <Label>{t("form.filesList.label")}</Label>
          {files.map((file) => {
            const cropUnsupported = isCropUnsupportedFile(file, cropUnsupportedExtensions);
            const cropable =
              !cropUnsupported && isCropableFile(file, supportedExtensions);
            const savedCrop = crops[file.name];
            const savedFit = outputFormat !== "pdf" ? savedCrop?.fit : undefined;
            const fileExt = file.name.split(".").pop()?.toLowerCase() ?? "";
            return (
              <div
                key={file.name}
                className={cn(
                  "flex flex-col items-stretch gap-2 rounded-md p-2 transition-colors sm:flex-row sm:flex-wrap sm:items-center sm:justify-between",
                  filePillClass
                )}
                data-testid="dropzone-added-file-wrapper"
              >
                <div className="flex flex-1 flex-wrap items-center gap-2 min-w-0">
                  <div className="flex min-w-0 max-w-full items-center gap-1">
                    <span
                      className="min-w-0 text-sm truncate"
                      data-testid="dropzone-added-file"
                    >
                      {file.name}
                    </span>
                    <InputFileBadge filename={file.name} />
                  </div>
                  {upscaleActive && (
                    <UpscaleSizePill
                      plan={upscalePlanFor(file)}
                      targetLabel={UPSCALE_TARGET_SHORT[upscale.target]}
                      limitMegapixels={maxOutputMegapixels}
                    />
                  )}
                  {savedCrop && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          className="inline-flex items-center gap-1 text-xs font-medium rounded-full pl-2 pr-1 py-0.5 bg-green-500/15 text-green-600 dark:text-green-300 border border-green-500/30"
                          data-testid="dropzone-crop-badge"
                        >
                          {t(savedFit ? "crop.fit.output" : "form.filesList.croppedBadge", {
                            w: savedFit?.width ?? savedCrop.width,
                            h: savedFit?.height ?? savedCrop.height,
                          })}
                          <button
                            type="button"
                            aria-label={t("form.filesList.removeSavedCropAria")}
                            disabled={isLoading}
                            onClick={() => setConfirmCropRemoveFor(file.name)}
                            className="rounded-full p-0.5 hover:bg-green-500/25 focus:outline-none focus:ring-1 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            data-testid="dropzone-crop-badge-clear-btn"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        className={cn("max-w-56 p-2 rounded shadow-lg border", tooltipSurface)}
                      >
                        {t("form.filesList.cropTooltip")}
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {cropable && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          type="button"
                          disabled={isLoading}
                          onClick={() => setOpenCropFor(file.name)}
                          className={cn(
                            "h-7 gap-1.5 px-2",
                            savedCrop
                              ? "border-green-500/40 bg-green-500/10 text-green-700 hover:bg-green-500/15 dark:text-green-200"
                              : "border-blue-500/35 bg-blue-500/5 text-blue-700 hover:bg-blue-500/10 dark:text-blue-200"
                          )}
                          data-testid="dropzone-crop-file-btn"
                        >
                          <CropIcon className="h-3.5 w-3.5" />
                          {savedCrop ? t("form.filesList.editButton") : t("crop.editorTitle")}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        className={cn("max-w-56 p-2 rounded shadow-lg border", tooltipSurface)}
                      >
                        {savedCrop
                          ? t("form.filesList.editCropTooltip")
                          : t("form.filesList.addCropTooltip")}
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {!cropable && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <Button
                            variant="outline"
                            size="sm"
                            type="button"
                            disabled
                            className="h-7 gap-1.5 px-2 opacity-55"
                            data-testid="dropzone-crop-disabled-btn"
                          >
                            <CropIcon className="h-3.5 w-3.5" />
                            {t("form.filesList.cropButton")}
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        className={cn("max-w-60 p-2 rounded shadow-lg border", tooltipSurface)}
                      >
                        {fileExt === "pdf"
                          ? t("form.filesList.cropNotSupportedPdf")
                          : t("form.filesList.cropNotSupported")}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    type="button"
                    disabled={isLoading}
                    onClick={() => removeFile(file.name)}
                    data-testid="dropzone-remove-file-btn"
                  >
                    {t("form.filesList.removeButton")}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ),
    [
      files,
      isLoading,
      removeFile,
      filePillClass,
      crops,
      setOpenCropFor,
      setCropForFile,
      supportedExtensions,
      cropUnsupportedExtensions,
      outputFormat,
      tooltipSurface,
      t,
      upscaleActive,
      upscale.target,
      pixelSizes,
      maxOutputMegapixels,
    ]
  );

  const cropDialogNode = (
    <CropDialog
      files={files}
      crops={crops}
      openFileName={openCropFor}
      setOpenFileName={setOpenCropFor}
      setCropForFile={setCropForFile}
      confirmRemoveFor={confirmCropRemoveFor}
      setConfirmRemoveFor={setConfirmCropRemoveFor}
      onReportError={onReportCropError}
      isDarkTheme={isDarkTheme}
      disableLogo={disableLogo}
      fitAvailable={outputFormat !== "pdf"}
      cropUnsupportedExtensions={cropUnsupportedExtensions}
    />
  );

  const maxUploadSizeMb = useMaxUploadSizeMb();
  const uploadLimitText = useMemo(
    () => formatUploadLimit(i18n.language),
    // The text follows the limit from the runtime config and the language.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [maxUploadSizeMb, i18n.language],
  );

  const renderDropZone = useMemo(
    () => (
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-md p-6 text-center transition-colors",
          isDragActive ? "border-blue-400" : isDarkTheme ? "border-gray-700" : "border-slate-300",
          isDarkTheme ? "bg-black/30 text-gray-100" : "bg-white/80 text-slate-800 shadow-inner",
          isLoading && "opacity-50 cursor-not-allowed"
        )}
      >
        <input {...getInputProps()} data-testid="dropzone-input" />
        {isDragActive ? (
          <p className={cn("font-semibold", isDarkTheme ? "text-blue-300" : "text-blue-600")}>
            {t("form.dropzone.dragActive")}
          </p>
        ) : isLoading ? (
          <p>{t("form.dropzone.processing")}</p>
        ) : (
          <p>{t("form.dropzone.idle")}</p>
        )}
        <p
          className={cn("mt-1 text-xs", isDarkTheme ? "text-gray-400" : "text-slate-500")}
          data-testid="dropzone-max-size"
        >
          {t("form.dropzone.maxSize", { size: uploadLimitText })}
        </p>
      </div>
    ),
    [getInputProps, getRootProps, isDarkTheme, isDragActive, isLoading, t, uploadLimitText]
  );

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="flex justify-end">
        <SupportedFormatsDialog
          supportedExtensions={supportedExtensions}
          verifiedExtensions={verifiedExtensions}
          extensionsLoading={extensionsLoading}
          extensionsError={extensionsError}
        />
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-1">
          <Label htmlFor="outputFormat" className="text-sm">
            {t("form.outputFormat.label")}
          </Label>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Info className={cn("h-4 w-4 cursor-pointer", subtleText)} />
              </span>
            </TooltipTrigger>
            <TooltipContent
              side="top"
              className={cn("p-2 rounded shadow-lg whitespace-pre-line border", tooltipSurface)}
            >
              {tooltipContent.outputFormat}
            </TooltipContent>
          </Tooltip>
        </div>
        <Select value={outputFormat} onValueChange={setOutputFormat}>
          <SelectTrigger
            id="outputFormat"
            className={cn(
              selectSurface,
              "focus:border-blue-500 focus:ring-2 focus:ring-blue-500",
              !outputFormat && "border-red-500 focus:border-red-500 focus:ring-red-500"
            )}
          >
            <SelectValue placeholder={t("form.outputFormat.placeholder")} />
          </SelectTrigger>
          <SelectContent className={selectSurface}>
            <SelectItem value="jpeg">{t("form.outputFormat.options.jpeg")}</SelectItem>
            <SelectItem value="png">{t("form.outputFormat.options.png")}</SelectItem>
            <SelectItem value="avif">{t("form.outputFormat.options.avif")}</SelectItem>
            <SelectItem value="webp">{t("form.outputFormat.options.webp")}</SelectItem>
            <SelectItem value="pdf">{t("form.outputFormat.options.pdf")}</SelectItem>
            <SelectItem value="ico">{t("form.outputFormat.options.ico")}</SelectItem>
          </SelectContent>
        </Select>
        {!outputFormat && (
          <p className={cn("text-xs", formatRequired ? "text-red-500" : subtleText)}>
            {t("form.outputFormat.hint")}
          </p>
        )}
      </div>

      {outputFormat === "pdf" && (
        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <Label htmlFor="pdfQuality" className="text-sm">
              {t("form.pdfQuality.label")}
            </Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Info className={cn("h-4 w-4 cursor-pointer", subtleText)} />
                </span>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className={cn("p-2 rounded shadow-lg whitespace-pre-line border", tooltipSurface)}
              >
                {tooltipContent.pdfQuality}
              </TooltipContent>
            </Tooltip>
          </div>
          <Select
            value={pdfQuality}
            onValueChange={(value) => setPdfQuality(toPdfQualityOption(value))}
          >
            <SelectTrigger id="pdfQuality" data-testid="pdf-quality-select" className={cn(selectSurface, "focus:border-blue-500 focus:ring-2 focus:ring-blue-500")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={selectSurface}>
              {PDF_QUALITY_OPTIONS.map((option) => (
                <SelectItem
                  key={option}
                  value={option}
                  data-testid={`pdf-quality-option-${option}`}
                >
                  {t(`form.pdfQuality.options.${option}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p data-testid="pdf-quality-hint" className={cn("text-xs", subtleText)}>
            {t(`form.pdfQuality.hints.${pdfQuality}`)}
          </p>
        </div>
      )}

      {outputFormat === "pdf" && (
        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <Label htmlFor="pdfPreset" className="text-sm">
              {t("form.pdfPreset.label")}
            </Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Info className={cn("h-4 w-4 cursor-pointer", subtleText)} />
                </span>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className={cn("p-2 rounded shadow-lg whitespace-pre-line border", tooltipSurface)}
              >
                {tooltipContent.pdfPreset}
              </TooltipContent>
            </Tooltip>
          </div>
          <Select value={pdfPreset} onValueChange={setPdfPreset}>
            <SelectTrigger
              id="pdfPreset"
              className={cn(selectSurface, "focus:border-blue-500 focus:ring-2 focus:ring-blue-500")}
            >
              <SelectValue placeholder={t("form.pdfPreset.options.original")} />
            </SelectTrigger>
            <SelectContent className={selectSurface}>
              <SelectItem value="original">{t("form.pdfPreset.options.original")}</SelectItem>
              <SelectItem value="a4-auto">{t("form.pdfPreset.options.a4Auto")}</SelectItem>
              <SelectItem value="a4-portrait">{t("form.pdfPreset.options.a4Portrait")}</SelectItem>
              <SelectItem value="a4-landscape">{t("form.pdfPreset.options.a4Landscape")}</SelectItem>
              <SelectItem value="letter-auto">{t("form.pdfPreset.options.letterAuto")}</SelectItem>
              <SelectItem value="letter-portrait">{t("form.pdfPreset.options.letterPortrait")}</SelectItem>
              <SelectItem value="letter-landscape">{t("form.pdfPreset.options.letterLandscape")}</SelectItem>
              <SelectItem value="mobile-portrait">{t("form.pdfPreset.options.mobilePortrait")}</SelectItem>
              <SelectItem value="mobile-landscape">{t("form.pdfPreset.options.mobileLandscape")}</SelectItem>
            </SelectContent>
          </Select>
          {pdfPreset !== "original" && (
            <p className={cn("text-xs", subtleText)}>
              {t("form.pdfPreset.disabledHint")}
            </p>
          )}
        </div>
      )}

      {outputFormat === "pdf" && pdfPreset !== "original" && (
        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <Label htmlFor="pdfScale" className="text-sm">
              {t("form.pdfScale.label")}
            </Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Info className={cn("h-4 w-4 cursor-pointer", subtleText)} />
                </span>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className={cn("p-2 rounded shadow-lg whitespace-pre-line border", tooltipSurface)}
              >
                {tooltipContent.pdfScale}
              </TooltipContent>
            </Tooltip>
          </div>
          <Select value={pdfScale} onValueChange={setPdfScale}>
            <SelectTrigger
              id="pdfScale"
              className={cn(selectSurface, "focus:border-blue-500 focus:ring-2 focus:ring-blue-500")}
              disabled={pdfPaginate}
            >
              <SelectValue placeholder={t("form.pdfScale.options.fit")} />
            </SelectTrigger>
            <SelectContent className={selectSurface}>
              <SelectItem value="fit">{t("form.pdfScale.options.fit")}</SelectItem>
              <SelectItem value="fill">{t("form.pdfScale.options.fill")}</SelectItem>
            </SelectContent>
          </Select>
          {pdfPaginate && (
            <p className={cn("text-xs", subtleText)}>
              {t("form.pdfScale.paginationHint")}
            </p>
          )}
        </div>
      )}

      {outputFormat === "pdf" && pdfPreset !== "original" && (
        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <Label htmlFor="pdfMargin" className="text-sm">
              {t("form.pdfMargin.label")}
            </Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Info className={cn("h-4 w-4 cursor-pointer", subtleText)} />
                </span>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className={cn("p-2 rounded shadow-lg whitespace-pre-line border", tooltipSurface)}
              >
                {tooltipContent.pdfMargin}
              </TooltipContent>
            </Tooltip>
            <span className={cn("text-sm", subtleText)}>
              {(pdfMarginMm && pdfMarginMm.trim() !== "" ? pdfMarginMm : "10")} mm
            </span>
          </div>
          <input
            id="pdfMargin"
            type="range"
            min="0"
            max="20"
            step="1"
            value={pdfMarginValue}
            onChange={(e) => setPdfMarginMm(e.target.value)}
            disabled={isLoading}
            className="w-full accent-blue-500"
          />
          <div className="relative">
            <Input
              id="pdfMarginInput"
              data-testid="pdfMarginInput"
              type="number"
              inputMode="decimal"
              step="1"
              min="0"
              max="20"
              placeholder="10"
              value={pdfMarginMm}
              onChange={(e) => setPdfMarginMm(e.target.value)}
              disabled={isLoading}
              className={cn(surfaceInputClass, "disabled:opacity-50 disabled:cursor-not-allowed pr-12")}
            />
            <span className={cn("absolute inset-y-0 right-3 flex items-center text-sm pointer-events-none", subtleText)}>
              mm
            </span>
          </div>
          <p className={cn("text-xs", subtleText)}>
            {t("form.pdfMargin.hint")}
          </p>
        </div>
      )}

      {outputFormat === "pdf" && pdfPreset !== "original" && (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Label htmlFor="pdfPaginateToggle" className="text-sm flex items-center gap-1">
              {t("form.pdfPaginate.label")}
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Info className={cn("h-4 w-4 cursor-pointer", subtleText)} />
                  </span>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className={cn("p-2 rounded shadow-lg whitespace-pre-line border", tooltipSurface)}
                >
                  <p className="text-sm">{tooltipContent.pdfPaginate}</p>
                </TooltipContent>
              </Tooltip>
            </Label>
            <Switch
              data-testid="pdf-paginate-switch"
              id="pdfPaginateToggle"
              checked={pdfPaginate}
              onCheckedChange={setPdfPaginate}
              disabled={isLoading}
            />
          </div>
        </div>
      )}

      {outputFormat === "webp" && (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Label
              htmlFor="webpLosslessToggle"
              className="text-sm flex items-center gap-1"
            >
              {t("form.webpLossless.label")}
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Info className={cn("h-4 w-4 cursor-pointer", subtleText)} />
                  </span>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className={cn("p-2 rounded shadow-lg whitespace-pre-line border", tooltipSurface)}
                >
                  <p className="text-sm">{tooltipContent.webpLossless}</p>
                </TooltipContent>
              </Tooltip>
            </Label>
            <Switch
              data-testid="webp-lossless-switch"
              id="webpLosslessToggle"
              checked={webpLossless}
              onCheckedChange={setWebpLossless}
              disabled={isLoading}
            />
          </div>
        </div>
      )}

      {hasQualitySettings && (
        <div className="space-y-2">
          <Label className="text-sm">{t("form.compressionMode.label", { format: outputFormatLabel })}</Label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={compressionMode === "quality" ? "default" : "outline"}
              disabled={isLoading}
              onClick={() => setCompressionMode("quality")}
              data-testid="compression-mode-quality-btn"
            >
              {t("form.compressionMode.byQuality")}
            </Button>
            <Button
              type="button"
              variant={compressionMode === "size" ? "default" : "outline"}
              disabled={isLoading}
              onClick={() => setCompressionMode("size")}
              data-testid="compression-mode-size-btn"
            >
              {t("form.compressionMode.bySize")}
            </Button>
          </div>
        </div>
      )}

      {supportsBackgroundRemoval && (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Label
              htmlFor="rembgToggle"
              className="text-sm flex items-center gap-1"
            >
              {t("form.rembg.label", { model: rembgLabel })}
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Info className={cn("h-4 w-4 cursor-pointer", subtleText)} />
                  </span>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className={cn("p-2 rounded shadow-lg whitespace-pre-line border", tooltipSurface)}
                >
                  <p className="text-sm">{tooltipContent.rembg}</p>
                </TooltipContent>
              </Tooltip>
            </Label>
            <Switch
              data-testid="rembg-switch"
              id="rembgToggle"
              checked={useRembg}
              onCheckedChange={setUseRembg}
              disabled={isLoading}
            />
          </div>
        </div>
      )}

      {hasQualitySettings && compressionMode === "quality" && (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Label
              htmlFor="quality"
              className="text-sm flex items-center gap-1"
            >
              {t("form.quality.label")}
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Info className={cn("h-4 w-4 cursor-pointer", subtleText)} />
                  </span>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className={cn("p-2 rounded shadow-lg border", tooltipSurface)}
                >
                  <p className="text-sm">{tooltipContent.quality}</p>
                </TooltipContent>
              </Tooltip>
            </Label>
            <span className={cn("text-sm", subtleText)}>{quality}</span>
          </div>
          <input
            id="quality"
            type="range"
            min="10"
            max="100"
            value={quality}
            onChange={(e) => setQuality(e.target.value)}
            disabled={isLoading}
            className="w-full accent-blue-500"
          />
          <div className="flex gap-2 pt-2 flex-wrap">
            <Button type="button" size="sm" variant="outline" disabled={isLoading} onClick={() => setQuality("60")}>
              {t("form.quality.presets.smaller")}
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={isLoading} onClick={() => setQuality("75")}>
              {t("form.quality.presets.balanced")}
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={isLoading} onClick={() => setQuality("85")}>
              {t("form.quality.presets.high")}
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={isLoading} onClick={() => setQuality("100")}>
              {t("form.quality.presets.max")}
            </Button>
          </div>
        </div>
      )}

      {hasQualitySettings && compressionMode === "size" && (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Label
              htmlFor="targetSizeMBRange"
              className="text-sm flex items-center gap-1"
            >
              {t("form.targetSize.label")}
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Info className={cn("h-4 w-4 cursor-pointer", subtleText)} />
                  </span>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className={cn("p-2 rounded shadow-lg border", tooltipSurface)}
                >
                  <p className="text-sm">{tooltipContent.targetSize}</p>
                </TooltipContent>
              </Tooltip>
            </Label>
            <span className={cn("text-sm", subtleText)}>
              {(targetSizeMB && targetSizeMB.trim() !== "" ? targetSizeMB : "0.50")} MB
            </span>
          </div>

          <input
            id="targetSizeMBRange"
            type="range"
            min="0.05"
            max="10"
            step="0.05"
            value={parseFloat(targetSizeMB || "0.50")}
            onChange={(e) => setTargetSizeMB(e.target.value)}
            disabled={isLoading}
            className="w-full accent-blue-500"
          />

          <div className="relative">
            <Input
              data-testid="targetSizeMBInput"
              id="targetSizeMB"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              placeholder={t("form.targetSize.placeholder")}
              value={targetSizeMB}
              onChange={(e) => setTargetSizeMB(e.target.value)}
              disabled={isLoading}
              className={cn(surfaceInputClass, "disabled:opacity-50 disabled:cursor-not-allowed pr-12")}
            />
            <span className={cn("absolute inset-y-0 right-3 flex items-center text-sm pointer-events-none", subtleText)}>
              MB
            </span>
          </div>

          <p className={cn("text-xs", subtleText)}>
            {t("form.targetSize.hint", { format: outputFormatLabel })}
          </p>
        </div>
      )}

      {upscaleVisible && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="upscaleToggle" className="text-sm flex items-center gap-1">
              {upscaleLabel}
              {!onlySvgFiles && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" data-testid="upscale-info" aria-label={upscaleLabel}>
                      <Info aria-hidden="true" className={cn("h-4 w-4 cursor-pointer", subtleText)} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className={cn("max-w-80 p-2 rounded shadow-lg whitespace-pre-line border", tooltipSurface)}
                  >
                    <p className="text-sm">{tooltipContent.upscale}</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </Label>
            <Switch
              data-testid="upscale-switch"
              id="upscaleToggle"
              checked={upscaleActive}
              onCheckedChange={(checked) => setUpscale({ ...upscale, enabled: checked })}
              disabled={isLoading || (!upscaleAvailable && !onlySvgFiles) || fitActive}
            />
          </div>
          {fitActive && (
            <p className={cn("text-xs", subtleText)} data-testid="upscale-fit-hint">
              {t("form.upscale.fitActiveHint")}
            </p>
          )}
          {!upscaleAvailable && !onlySvgFiles && (
            <p className={cn("text-xs", subtleText)} data-testid="upscale-unavailable-hint">
              {t("form.upscale.unavailableHint")}
            </p>
          )}
          {upscaleActive && (
            <div className="space-y-3">
              {!onlySvgFiles && (
                <UpscaleModelCards
                  value={upscale.model}
                  onChange={(model) => setUpscale({ ...upscale, model })}
                  models={upscaleModels}
                  disabled={isLoading}
                  isDarkTheme={isDarkTheme}
                />
              )}
              {!onlySvgFiles && upscale.model === "general" && (
                <UpscaleDenoiseOptions
                  value={upscale.denoise}
                  onChange={(denoise) => setUpscale({ ...upscale, denoise })}
                  models={upscaleModels}
                  disabled={isLoading}
                  isDarkTheme={isDarkTheme}
                />
              )}
              <div className="space-y-1.5">
                <Label htmlFor="upscaleTarget" className="text-sm">
                  {t(onlySvgFiles ? "form.upscale.vectorTargetLabel" : "form.upscale.targetLabel")}
                </Label>
                <Select
                  value={upscale.target}
                  onValueChange={(value) => setUpscale({ ...upscale, target: toUpscaleTarget(value) })}
                >
                  <SelectTrigger
                    id="upscaleTarget"
                    data-testid="upscale-target-select"
                    disabled={isLoading}
                    className={cn(selectSurface, "focus:border-blue-500 focus:ring-2 focus:ring-blue-500")}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className={selectSurface}>
                    {UPSCALE_TARGETS.map((target) => (
                      <SelectItem key={target} value={target} data-testid={`upscale-target-option-${target}`}>
                        {t(`form.upscale.options.${target}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isLargeUpscaleTarget(upscale.target) && (
                  <p
                    className={cn("flex items-center gap-1.5 text-xs", subtleText)}
                    data-testid="upscale-large-target-hint"
                  >
                    <Timer aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                    {t("form.upscale.largeTargetHint")}
                  </p>
                )}
                {!onlySvgFiles && (
                  <p className={cn("text-xs", subtleText)} data-testid="upscale-hint">
                    {t("form.upscale.hint")}
                  </p>
                )}
                {!onlySvgFiles && (
                  <p
                    role="note"
                    className="flex items-start gap-2 rounded-md border border-blue-500/30 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-900 dark:border-blue-400/30 dark:bg-blue-400/10 dark:text-blue-100"
                    data-testid="upscale-slow-hint"
                  >
                    <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-300" />
                    <span>{t("form.upscale.slowHint")}</span>
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Label
            htmlFor="resizeWidthToggle"
            className="text-sm flex items-center gap-1"
          >
            {t("form.resizeWidth.label")}
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Info className={cn("h-4 w-4 cursor-pointer", subtleText)} />
                </span>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className={cn("p-2 rounded shadow-lg border", tooltipSurface)}
              >
                <p className="text-sm">{tooltipContent.resizeWidth}</p>
              </TooltipContent>
            </Tooltip>
          </Label>
          <Switch
            data-testid="resize-width-switch"
            id="resizeWidthToggle"
            checked={resizeWidthEnabled}
            onCheckedChange={(checked) => {
              setResizeWidthEnabled(checked);
              if (checked && width === "") {
                setWidth("800");
              } else if (!checked) {
                setWidth("");
              }
            }}
            disabled={isLoading || upscaleActive || fitActive || (outputFormat === "pdf" && pdfPreset !== "original")}
          />
        </div>
        {upscaleActive && (
          <p className={cn("text-xs", subtleText)} data-testid="resize-width-upscale-hint">
            {t(onlySvgFiles ? "form.resizeWidth.vectorUpscaleActiveHint" : "form.resizeWidth.upscaleActiveHint", {
              enlargeLabel: upscaleLabel,
            })}
          </p>
        )}
        {fitActive && !upscaleActive && (
          <p className={cn("text-xs", subtleText)} data-testid="resize-width-fit-hint">
            {t("form.resizeWidth.fitActiveHint")}
          </p>
        )}
        {resizeWidthEnabled && (
          <Input
            data-testid="resize-width-input"
            id="width"
            type="number"
            placeholder="800"
            value={width}
            onChange={(e) => setWidth(e.target.value)}
            disabled={isLoading}
            className={cn(
              surfaceInputClass,
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          />
        )}
      </div>

      {renderError}

      {renderDropZone}

      {renderFilesList}

      {cropDialogNode}

      <div className="flex items-center justify-between gap-4">
        <Button
          type="submit"
          variant="default"
          disabled={isLoading || !outputFormat}
          data-testid="convert-btn"
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("form.buttons.processing")}
            </div>
          ) : (
            t("form.buttons.convert")
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={clearFileSelection}
          disabled={isLoading}
          className={cn(
            "flex items-center gap-2 outline outline-1",
            isDarkTheme ? "outline-gray-700" : "outline-slate-300"
          )}
        >
          <Trash className="h-4 w-4" />
          {t("form.buttons.clear")}
        </Button>
      </div>
    </form>
  );
};

interface UpscaleModelCardsProps {
  value: UpscaleModel;
  onChange: (model: UpscaleModel) => void;
  models: UpscaleModelStatus[];
  disabled: boolean;
  isDarkTheme: boolean;
}

/** The two models as selectable cards, each with a one-line hint. Arrow keys move between them. */
function UpscaleModelCards({ value, onChange, models, disabled, isDarkTheme }: UpscaleModelCardsProps) {
  const { t } = useTranslation();
  const isAvailable = (model: UpscaleModel) => models.some((status) => status.id === model && status.available);
  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    const next = UPSCALE_MODELS.find((model) => model !== value && isAvailable(model));
    if (!next) return;
    event.preventDefault();
    onChange(next);
    const group = event.currentTarget.parentElement;
    group?.querySelector<HTMLButtonElement>(`[data-model="${next}"]`)?.focus();
  };
  return (
    <div className="space-y-1.5">
      <Label id="upscale-model-label" className="text-sm">
        {t("form.upscale.modelLabel")}
      </Label>
      <div
        role="radiogroup"
        aria-labelledby="upscale-model-label"
        className="grid grid-cols-2 gap-2"
        data-testid="upscale-model-group"
      >
        {UPSCALE_MODELS.map((model) => {
          const selected = value === model;
          return (
            <button
              key={model}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              disabled={disabled || !isAvailable(model)}
              onClick={() => onChange(model)}
              onKeyDown={onKeyDown}
              data-model={model}
              data-testid={`upscale-model-option-${model}`}
              className={cn(
                "flex min-h-11 flex-col items-start gap-0.5 rounded-md border px-3 py-2 text-left transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                "disabled:cursor-not-allowed disabled:opacity-50",
                selected
                  ? "border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/50"
                  : isDarkTheme
                    ? "border-gray-700 bg-gray-800 hover:border-gray-500"
                    : "border-slate-300 bg-white hover:border-slate-400"
              )}
            >
              <span className="flex w-full items-center justify-between gap-2 text-sm font-medium">
                {t(`form.upscale.models.${model}`)}
                {selected && <Check aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-blue-500" />}
              </span>
              <span className={cn("text-xs leading-snug", isDarkTheme ? "text-gray-400" : "text-slate-600")}>
                {t(`form.upscale.modelHints.${model}`)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface UpscaleDenoiseOptionsProps {
  value: UpscaleDenoise;
  onChange: (denoise: UpscaleDenoise) => void;
  models: UpscaleModelStatus[];
  disabled: boolean;
  isDarkTheme: boolean;
}

/** General model presets named by the kind of photo: how much noise to smooth away. Same speed. */
function UpscaleDenoiseOptions({ value, onChange, models, disabled, isDarkTheme }: UpscaleDenoiseOptionsProps) {
  const { t } = useTranslation();
  const isAvailable = (level: UpscaleDenoise) =>
    models.some((status) => status.id === upscaleModelParam({ model: "general", denoise: level }) && status.available);
  const levels = UPSCALE_DENOISE_LEVELS.filter(isAvailable);
  if (levels.length < 2) return null;
  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const step = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = levels[(levels.indexOf(value) + step + levels.length) % levels.length];
    onChange(next);
    event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`[data-denoise="${next}"]`)?.focus();
  };
  return (
    <div className="space-y-1.5">
      <Label id="upscale-denoise-label" className="text-sm">
        {t("form.upscale.denoiseLabel")}
      </Label>
      <div
        role="radiogroup"
        aria-labelledby="upscale-denoise-label"
        className="grid gap-1.5"
        data-testid="upscale-denoise-group"
      >
        {levels.map((level) => {
          const selected = value === level;
          return (
            <button
              key={level}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              disabled={disabled}
              onClick={() => onChange(level)}
              onKeyDown={onKeyDown}
              data-denoise={level}
              data-testid={`upscale-denoise-option-${level}`}
              aria-labelledby={`upscale-denoise-${level}-name`}
              aria-describedby={`upscale-denoise-${level}-hint`}
              className={cn(
                "rounded-md border px-2.5 py-1.5 text-left transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                "disabled:cursor-not-allowed disabled:opacity-50",
                selected
                  ? "border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/50"
                  : isDarkTheme
                    ? "border-gray-700 bg-gray-800 hover:border-gray-500"
                    : "border-slate-300 bg-white hover:border-slate-400"
              )}
            >
              <span id={`upscale-denoise-${level}-name`} className="block text-sm font-medium">
                {t(`form.upscale.denoise.${level}`)}
              </span>
              <span
                id={`upscale-denoise-${level}-hint`}
                className={cn("block text-xs leading-snug", isDarkTheme ? "text-gray-400" : "text-slate-600")}
              >
                {t(`form.upscale.denoiseHints.${level}`)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface UpscaleSizePillProps {
  plan: UpscalePlan | null;
  targetLabel: string;
  limitMegapixels: number;
}

const formatSize = (size: PixelSize) => `${size.width}×${size.height}`;

/** One file's size before and after upscaling, or just the target when the browser cannot measure the file. */
function UpscaleSizePill({ plan, targetLabel, limitMegapixels }: UpscaleSizePillProps) {
  const { t } = useTranslation();
  const kind = plan?.kind ?? "target";
  const text =
    plan?.kind === "resize"
      ? `${formatSize(plan.from)} → ${formatSize(plan.to)}`
      : plan?.kind === "unchanged"
        ? t("form.upscale.preview.unchanged", { size: formatSize(plan.from) })
        : plan?.kind === "tooLarge"
          ? t("form.upscale.preview.tooLarge", { size: formatSize(plan.to), limit: limitMegapixels })
          : `→ ${targetLabel}`;
  const Icon = kind === "tooLarge" ? TriangleAlert : kind === "unchanged" ? Check : Sparkles;
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium tabular-nums",
        kind === "tooLarge"
          ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
          : kind === "unchanged"
            ? "border-slate-400/30 bg-slate-500/10 text-slate-600 dark:text-gray-300"
            : "border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-200"
      )}
      dir={kind === "resize" || kind === "target" ? "ltr" : undefined}
      data-testid="upscale-size-preview"
      data-kind={kind}
    >
      <Icon aria-hidden="true" className="h-3 w-3 shrink-0" />
      <span className="truncate">{text}</span>
    </span>
  );
}

export default FileConversionForm;
