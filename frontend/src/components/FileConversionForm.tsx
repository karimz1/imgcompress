"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDropzone } from "react-dropzone";
import { Crop as CropIcon, Info, Loader2, Trash, X } from "lucide-react";
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
import { CropDialog } from "@/components/crop/CropDialog";
import { CropConfig, isCropableFile, isCropUnsupportedFile } from "@/lib/crop";
import { cn } from "@/lib/utils";

interface FileConversionFormProps {
  isLoading: boolean;
  error: { message: string; details?: string } | null;
  quality: string;
  setQuality: (val: string) => void;
  width: string;
  setWidth: (val: string) => void;
  resizeWidthEnabled: boolean;
  setResizeWidthEnabled: (val: boolean) => void;
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
  const { t } = useTranslation();

  const tooltipContent = {
    outputFormat: t("form.outputFormat.tooltip"),
    pdfPreset: t("form.pdfPreset.tooltip"),
    pdfScale: t("form.pdfScale.tooltip"),
    pdfMargin: t("form.pdfMargin.tooltip"),
    pdfPaginate: t("form.pdfPaginate.tooltip"),
    quality: t("form.quality.tooltip"),
    resizeWidth: t("form.resizeWidth.tooltip"),
    targetSize: t("form.targetSize.tooltip"),
    rembg: t("form.rembg.tooltip"),
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
            const fileExt = file.name.split(".").pop()?.toLowerCase() ?? "";
            return (
              <div
                key={file.name}
                className={cn(
                  "flex flex-wrap items-center justify-between gap-2 rounded-md p-2 transition-colors",
                  filePillClass
                )}
                data-testid="dropzone-added-file-wrapper"
              >
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <span
                    className="text-sm truncate"
                    data-testid="dropzone-added-file"
                  >
                    {file.name}
                  </span>
                  {savedCrop && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          className="inline-flex items-center gap-1 text-xs font-medium rounded-full pl-2 pr-1 py-0.5 bg-green-500/15 text-green-600 dark:text-green-300 border border-green-500/30"
                          data-testid="dropzone-crop-badge"
                        >
                          {t("form.filesList.croppedBadge", { w: savedCrop.width, h: savedCrop.height })}
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
                          {savedCrop ? t("form.filesList.editButton") : t("form.filesList.cropButton")}
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
                <div className="flex items-center gap-2">
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
      tooltipSurface,
      t,
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
    />
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
      </div>
    ),
    [getInputProps, getRootProps, isDarkTheme, isDragActive, isLoading]
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

      {(outputFormat === "jpeg" || outputFormat === "avif") && (
        <div className="space-y-2">
          <Label className="text-sm">{t("form.compressionMode.label", { format: outputFormat.toUpperCase() })}</Label>
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

      {(outputFormat === "png" || outputFormat === "avif") && (
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

      {(outputFormat === "jpeg" || outputFormat === "avif") && compressionMode === "quality" && (
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

      {(outputFormat === "jpeg" || outputFormat === "avif") && compressionMode === "size" && (
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
            {t("form.targetSize.hint", { format: outputFormat.toUpperCase() })}
          </p>
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
            disabled={isLoading || (outputFormat === "pdf" && pdfPreset !== "original")}
          />
        </div>
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

export default FileConversionForm;
