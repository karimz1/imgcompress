"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ImagePlus, Loader2, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BACKGROUND_IMAGE_ACCEPT,
  dimSupported,
  FIT_MODES,
  FIT_PATTERNS,
  FIT_PRESET_OPTIONS,
  MAX_BACKGROUND_BYTES,
  MAX_BACKGROUND_DIM,
  MAX_FIT_DIMENSION,
  normalizeHexColor,
  patternSupported,
  toFitPreset,
} from "@/lib/fitToSize";
import { cn } from "@/lib/utils";
import { patternStyle } from "./FitPlacementStage";
import type { useEditorFit } from "./useEditorFit";

const COLOR_SWATCHES = [
  { label: "White", color: "#ffffff" },
  { label: "Black", color: "#000000" },
  { label: "Slate", color: "#0f172a" },
  { label: "Gray", color: "#64748b" },
] as const;

/** How long the colour picker may keep changing before the preview updates. */
const COLOR_COMMIT_DELAY_MS = 150;

/** #rgb and #rgba expanded to the #rrggbb a native colour input needs. */
function pickerValue(color: string): string {
  const hex = normalizeHexColor(color)?.slice(1);
  if (!hex) return "#ffffff";
  const full = hex.length <= 4 ? [...hex].map((c) => c + c).join("") : hex;
  return `#${full.slice(0, 6)}`;
}

/**
 * Colour picker, hex field and swatches. Dragging the picker or typing only
 * changes a local draft; a valid colour is committed after a short pause so
 * one adjustment produces one preview request.
 */
function FitColorPicker({
  color,
  onChange,
  disabled,
  suffix,
}: {
  color: string;
  onChange: (color: string) => void;
  disabled: boolean;
  suffix: string;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? color;
  const valid = normalizeHexColor(shown);

  // Only a new draft restarts the pause; other re-renders must not delay it.
  const latest = useRef({ color, onChange });
  latest.current = { color, onChange };
  useEffect(() => {
    if (draft === null) return;
    const timer = window.setTimeout(() => {
      const next = normalizeHexColor(draft);
      if (!next) return;
      if (next !== latest.current.color) latest.current.onChange(next);
      setDraft(null);
    }, COLOR_COMMIT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [draft]);

  const commitNow = (next: string) => {
    setDraft(null);
    if (next !== color) onChange(next);
  };

  return (
    <div className="space-y-2 rounded-md border p-2.5">
      <Label
        htmlFor={`fit-color-input${suffix}`}
        className="text-xs opacity-70"
      >
        {t("form.fitSize.mode.colorLabel")}
      </Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={pickerValue(shown)}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          className="h-8 w-10 cursor-pointer rounded border p-0.5 bg-transparent"
          title={t("form.fitSize.mode.colorLabel")}
          aria-label={t("form.fitSize.mode.colorLabel")}
          data-testid={`fit-color-picker${suffix}`}
        />
        <Input
          id={`fit-color-input${suffix}`}
          type="text"
          value={shown}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (!valid) setDraft(null);
          }}
          aria-invalid={!valid || undefined}
          className={cn(
            "h-8 text-xs font-mono",
            !valid && "border-red-500 focus-visible:ring-red-500",
          )}
          placeholder="#ffffff"
          data-testid={`fit-color-input${suffix}`}
        />
      </div>
      <div className="flex items-center gap-1.5 pt-1">
        {COLOR_SWATCHES.map(({ label, color: swatch }) => (
          <button
            key={swatch}
            type="button"
            disabled={disabled}
            onClick={() => commitNow(swatch)}
            className={cn(
              "h-6 flex-1 rounded border text-[10px] font-medium transition-transform active:scale-95",
              shown.toLowerCase() === swatch
                ? "ring-2 ring-blue-500 ring-offset-1"
                : "opacity-80 hover:opacity-100",
            )}
            style={{
              backgroundColor: swatch,
              color: swatch === "#ffffff" ? "#000000" : "#ffffff",
            }}
            aria-pressed={shown.toLowerCase() === swatch}
            data-testid={`fit-color-swatch-${swatch.slice(1)}${suffix}`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

let backgroundPicks = 0;

/**
 * Pattern swatches (solid), background picture (image) and darkening. Only
 * the settings that apply to the current mode are shown.
 */
function FitBackgroundControls({
  fit,
  suffix,
  fileInput,
}: {
  fit: ReturnType<typeof useEditorFit>;
  suffix: string;
  fileInput: React.RefObject<HTMLInputElement | null>;
}) {
  const { t } = useTranslation();
  const [fileError, setFileError] = useState<string | null>(null);
  const { mode, pattern, dim, color } = fit.settings;
  const disabled = fit.batchWorking;
  if (!patternSupported(mode) && !dimSupported(mode) && mode !== "image") return null;

  const pick = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
      setFileError(t("crop.fit.background.wrongType"));
      return;
    }
    if (file.size > MAX_BACKGROUND_BYTES) {
      setFileError(t("crop.fit.background.tooLarge", { mb: MAX_BACKGROUND_BYTES / (1024 * 1024) }));
      return;
    }
    setFileError(null);
    backgroundPicks += 1;
    fit.setBackgroundImage({ id: `${Date.now()}-${backgroundPicks}`, file });
  };

  return (
    <div className="space-y-2.5 rounded-md border p-2.5" data-testid={`fit-background-controls${suffix}`}>
      {mode === "image" && (
        <div className="space-y-1.5">
          <p className="text-xs opacity-70">{t("crop.fit.background.image")}</p>
          <input
            ref={fileInput}
            type="file"
            accept={BACKGROUND_IMAGE_ACCEPT}
            className="hidden"
            onChange={(e) => {
              pick(e.target.files?.[0]);
              e.target.value = "";
            }}
            data-testid={`fit-background-input${suffix}`}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 w-full min-w-0 justify-start gap-2 text-xs"
            disabled={disabled}
            onClick={() => fileInput.current?.click()}
            data-testid={`fit-background-choose-btn${suffix}`}
          >
            <ImagePlus className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 truncate" data-testid={`fit-background-name${suffix}`}>
              {fit.backgroundImage
                ? fit.backgroundImage.file.name
                : t("crop.fit.background.choose")}
            </span>
          </Button>
          {fileError ? (
            <p role="alert" className="text-xs text-red-500" data-testid={`fit-background-error${suffix}`}>
              {fileError}
            </p>
          ) : (
            fit.needsBackground && (
              <p className="text-xs opacity-70" data-testid={`fit-background-needed${suffix}`}>
                {t("crop.fit.background.needed")}
              </p>
            )
          )}
        </div>
      )}
      {patternSupported(mode) && (
        <div className="space-y-1.5">
          <p className="text-xs opacity-70" id={`fit-pattern-label${suffix}`}>
            {t("crop.fit.background.pattern")}
          </p>
          <div
            role="radiogroup"
            aria-labelledby={`fit-pattern-label${suffix}`}
            className="grid grid-cols-5 gap-1.5"
          >
            {FIT_PATTERNS.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={pattern === option}
                aria-label={t(`crop.fit.background.patterns.${option}`)}
                title={t(`crop.fit.background.patterns.${option}`)}
                disabled={disabled}
                onClick={() => fit.setSettings((settings) => ({ ...settings, pattern: option }))}
                className={cn(
                  "relative h-7 min-w-0 overflow-hidden rounded border transition-shadow",
                  pattern === option
                    ? "ring-2 ring-blue-500 ring-offset-1 ring-offset-background"
                    : "opacity-80 hover:opacity-100",
                )}
                style={{ backgroundColor: color }}
                data-testid={`fit-pattern-${option}${suffix}`}
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-0"
                  style={patternStyle(option, color, { width: 400, height: 400 }, 0.35)}
                />
                {option === "none" && (
                  <span
                    aria-hidden="true"
                    className="absolute left-1/2 top-1/2 h-px w-[140%] -translate-x-1/2 -translate-y-1/2 -rotate-[30deg] bg-red-500/70"
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
      {dimSupported(mode) && (
        <div className="space-y-1">
          <Label htmlFor={`fit-dim${suffix}`} className="flex items-center justify-between text-xs opacity-70">
            <span>{t("crop.fit.background.dim")}</span>
            <span className="tabular-nums" data-testid={`fit-dim-value${suffix}`}>
              {Math.round(dim * 100)}%
            </span>
          </Label>
          <input
            id={`fit-dim${suffix}`}
            type="range"
            min={0}
            max={MAX_BACKGROUND_DIM}
            step={0.05}
            value={dim}
            disabled={disabled}
            onChange={(e) =>
              fit.setSettings((settings) => ({ ...settings, dim: Number(e.target.value) }))
            }
            className="h-1.5 w-full cursor-pointer accent-blue-500 disabled:cursor-default disabled:opacity-40"
            data-testid={`fit-dim-slider${suffix}`}
          />
        </div>
      )}
    </div>
  );
}

export function FitControls({
  fit,
  suffix = "",
  canApplyToAll,
}: {
  fit: ReturnType<typeof useEditorFit>;
  suffix?: string;
  canApplyToAll: boolean;
}) {
  const { t } = useTranslation();
  const backgroundInput = useRef<HTMLInputElement | null>(null);
  // Size of the preview image as delivered. Large outputs get a smaller
  // preview (the backend caps it at 2048 px per side); export stays full size.
  const [previewSize, setPreviewSize] = useState<{
    src: string;
    width: number;
    height: number;
  } | null>(null);
  const scaledPreview =
    fit.applied &&
    fit.previewCurrent &&
    previewSize &&
    previewSize.src === fit.preview &&
    (previewSize.width < fit.applied.width ||
      previewSize.height < fit.applied.height)
      ? previewSize
      : null;
  const labelKeys = {
    "github-social": "githubSocial",
    "open-graph": "openGraph",
    custom: "custom",
  };
  return (
    <div className="space-y-3" data-testid={`crop-fit-controls${suffix}`}>
      <p className="text-xs opacity-70">{t("crop.fit.hint")}</p>
      <Label
        htmlFor={`fit-preset${suffix}`}
        className="text-xs uppercase tracking-wide opacity-70"
      >
        {t("form.fitSize.preset.label")}
      </Label>
      <Select
        value={fit.settings.preset}
        onValueChange={(value) =>
          fit.setSettings({ ...fit.settings, preset: toFitPreset(value) })
        }
        disabled={fit.batchWorking}
      >
        <SelectTrigger
          id={`fit-preset${suffix}`}
          className="h-auto min-h-10 text-left [&>span]:line-clamp-none [&>span]:whitespace-normal"
          data-testid={`fit-preset-select${suffix}`}
          aria-label={t("form.fitSize.preset.label")}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FIT_PRESET_OPTIONS.map((option) => (
            <SelectItem
              key={option}
              value={option}
              data-testid={`fit-preset-option-${option}${suffix}`}
            >
              {t(`form.fitSize.preset.options.${labelKeys[option]}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {fit.settings.preset === "custom" && (
        <div className="grid grid-cols-2 gap-2">
          {(["Width", "Height"] as const).map((dimension) => {
            const key = `custom${dimension}` as "customWidth" | "customHeight";
            return (
              <div key={key} className="space-y-1">
                <Label
                  htmlFor={`fit-${dimension.toLowerCase()}${suffix}`}
                  className="text-xs"
                >
                  {t(`form.fitSize.${dimension.toLowerCase()}Label`)}
                </Label>
                <Input
                  id={`fit-${dimension.toLowerCase()}${suffix}`}
                  data-testid={`fit-${dimension.toLowerCase()}-input${suffix}`}
                  type="number"
                  min={1}
                  max={MAX_FIT_DIMENSION}
                  step={1}
                  disabled={fit.batchWorking}
                  value={fit.settings[key]}
                  onChange={(e) =>
                    fit.setSettings({ ...fit.settings, [key]: e.target.value })
                  }
                />
              </div>
            );
          })}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        {FIT_MODES.map((mode) => (
          <Button
            key={mode}
            type="button"
            size="sm"
            className={cn(
              "h-auto min-h-9 whitespace-normal text-xs",
              // Five modes: the last one takes a full row.
              mode === "image" && "col-span-2",
            )}
            variant={fit.settings.mode === mode ? "default" : "outline"}
            disabled={fit.batchWorking}
            onClick={() => {
              fit.setSettings({ ...fit.settings, mode });
              // No picture yet: open the picker right away (after it renders).
              if (mode === "image" && !fit.backgroundImage) {
                window.setTimeout(() => backgroundInput.current?.click(), 0);
              }
            }}
            data-testid={`fit-mode-${mode}-btn${suffix}`}
          >
            {t(`form.fitSize.mode.${mode}`)}
          </Button>
        ))}
      </div>
      {fit.settings.mode === "solid" && (
        <FitColorPicker
          color={fit.settings.color}
          onChange={(color) =>
            fit.setSettings((settings) => ({ ...settings, color }))
          }
          disabled={fit.batchWorking}
          suffix={suffix}
        />
      )}
      <FitBackgroundControls fit={fit} suffix={suffix} fileInput={backgroundInput} />
      <p className="text-xs opacity-70">
        {t(`form.fitSize.mode.${fit.settings.mode}Hint`)}
      </p>
      {fit.canRefit && !fit.pending && !fit.error && (
        <Button
          type="button"
          size="sm"
          className="w-full gap-2"
          variant="outline"
          disabled={!fit.size || fit.working}
          onClick={() => void fit.autoFit()}
          data-testid={`crop-auto-fit-btn${suffix}`}
        >
          {fit.working ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <WandSparkles className="h-4 w-4" />
          )}
          {t("crop.fit.autoFit")}
        </Button>
      )}
      {!fit.size && (
        <p role="alert" className="text-xs text-red-500">
          {t("page.toast.fitSizeError")}
        </p>
      )}
      {(!fit.applied || fit.pending || fit.working) &&
        fit.size &&
        !fit.error && (
          <p
            role="status"
            className="flex items-center gap-2 text-xs opacity-70"
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            {t("crop.fit.updating")}
          </p>
        )}
      {fit.applied && (
        <div
          className="space-y-2"
          aria-busy={fit.working || fit.pending || fit.loadingPreview}
        >
          <p className="text-xs" data-testid={`crop-fit-output-size${suffix}`}>
            {t("crop.fit.output", {
              w: fit.applied.width,
              h: fit.applied.height,
            })}
          </p>
          {fit.preview && (
            <img
              src={fit.preview}
              alt={t("crop.fit.preview")}
              className={`w-full rounded border transition-opacity ${fit.working || fit.pending ? "opacity-50" : ""}`}
              data-testid={`crop-fit-preview${suffix}`}
              onLoad={(e) =>
                setPreviewSize({
                  src: e.currentTarget.getAttribute("src") ?? "",
                  width: e.currentTarget.naturalWidth,
                  height: e.currentTarget.naturalHeight,
                })
              }
            />
          )}
          {scaledPreview && fit.applied && (
            <p
              className="text-xs opacity-70"
              data-testid={`crop-fit-preview-scaled${suffix}`}
            >
              {t("crop.fit.previewScaled", {
                pw: scaledPreview.width,
                ph: scaledPreview.height,
                w: fit.applied.width,
                h: fit.applied.height,
              })}
            </p>
          )}
          {!fit.pending &&
            !fit.working &&
            (fit.loadingPreview || !fit.previewCurrent) &&
            !fit.error && (
              <p role="status" className="text-xs opacity-70">
                {t("crop.fit.updating")}
              </p>
            )}
          {canApplyToAll && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              disabled={
                fit.working || fit.pending || !fit.previewCurrent || !!fit.error
              }
              onClick={() => void fit.applyToAll()}
              data-testid={`crop-auto-fit-all-btn${suffix}`}
            >
              {t("crop.fit.applyAll")}
            </Button>
          )}
        </div>
      )}
      {fit.error && (
        <div className="space-y-2">
          <p
            role="alert"
            className="text-xs text-red-500"
            data-testid={`crop-fit-error${suffix}`}
          >
            {fit.error}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            disabled={!fit.size || fit.working}
            onClick={fit.retryPreview}
            data-testid={`crop-fit-retry-btn${suffix}`}
          >
            {t("runtimeError.tryAgain")}
          </Button>
        </div>
      )}
    </div>
  );
}
