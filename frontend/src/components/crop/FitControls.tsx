"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowDown,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  ImagePlus,
  Loader2,
  Palette,
  RotateCcw,
  SlidersHorizontal,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BACKGROUND_IMAGE_ACCEPT,
  blurSupported,
  defaultBlur,
  dimSupported,
  FIT_MODES,
  FIT_PATTERNS,
  FIT_PRESET_GROUPS,
  FIT_PRESET_LABELS,
  FIT_PRESETS,
  GRADIENT_DIRECTIONS,
  GRADIENT_PRESETS,
  gradientCss,
  DEFAULT_PLACEMENT,
  MAX_BACKGROUND_DIM,
  MAX_BACKGROUND_SCALE,
  MIN_BACKGROUND_SCALE,
  MAX_FIT_DIMENSION,
  normalizeHexColor,
  patternSupported,
  TINT_SWATCHES,
  tintSupported,
  type FitMode,
  type FitPreset,
} from "@/lib/fitToSize";
import { formatUploadLimit, maxUploadBytes } from "@/lib/uploadLimit";
import { cn } from "@/lib/utils";
import { AngleRow, NumberField } from "./FitPlacementControls";
import { patternStyle } from "./FitPlacementStage";
import { InfoHint } from "./InfoHint";
import type { useEditorFit } from "./useEditorFit";

// Colour chips like the other swatches; the hex value is the label in every language.
const COLOR_SWATCHES = [
  { color: "#ffffff" },
  { color: "#000000" },
  { color: "#0f172a" },
  { color: "#64748b" },
] as const;

/** How long the colour picker may keep changing before the preview updates. */
const COLOR_COMMIT_DELAY_MS = 150;

/** #rgb and #rgba expanded to the #rrggbb a native colour input needs. */
export function pickerValue(color: string): string {
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
        {COLOR_SWATCHES.map(({ color: swatch }) => (
          <button
            key={swatch}
            type="button"
            disabled={disabled}
            onClick={() => commitNow(swatch)}
            className={cn(
              "h-6 flex-1 rounded border transition-transform active:scale-95",
              shown.toLowerCase() === swatch
                ? "ring-2 ring-blue-500 ring-offset-1 ring-offset-background"
                : "opacity-80 hover:opacity-100",
            )}
            style={{ backgroundColor: swatch }}
            title={swatch}
            aria-label={`${t("form.fitSize.mode.colorLabel")} ${swatch}`}
            aria-pressed={shown.toLowerCase() === swatch}
            data-testid={`fit-color-swatch-${swatch.slice(1)}${suffix}`}
          />
        ))}
      </div>
    </div>
  );
}

/** A colour input that commits after a short pause, so dragging it sends one preview. */
function DelayedColorInput({
  value,
  onChange,
  disabled,
  label,
  testId,
  className,
}: {
  value: string;
  onChange: (color: string) => void;
  disabled: boolean;
  label: string;
  testId: string;
  className?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const latest = useRef(onChange);
  latest.current = onChange;
  useEffect(() => {
    if (draft === null) return;
    const timer = window.setTimeout(() => {
      latest.current(draft);
      setDraft(null);
    }, COLOR_COMMIT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [draft]);
  return (
    <input
      type="color"
      value={pickerValue(draft ?? value)}
      disabled={disabled}
      onChange={(e) => setDraft(e.target.value)}
      className={cn("h-7 w-9 shrink-0 cursor-pointer rounded border bg-transparent p-0.5", className)}
      title={label}
      aria-label={label}
      data-testid={testId}
    />
  );
}

const DIRECTION_ICONS: Record<(typeof GRADIENT_DIRECTIONS)[number], LucideIcon> = {
  90: ArrowRight,
  180: ArrowDown,
  135: ArrowDownRight,
  45: ArrowUpRight,
};

/** The four gradient directions as icon buttons (CSS angles). */
function DirectionPicker({
  value,
  onChange,
  disabled,
  testId,
}: {
  value: number;
  onChange: (angle: number) => void;
  disabled: boolean;
  testId: string;
}) {
  const { t } = useTranslation();
  return (
    <div role="radiogroup" aria-label={t("crop.fit.background.direction")} className="flex gap-1">
      {GRADIENT_DIRECTIONS.map((angle) => {
        const Icon = DIRECTION_ICONS[angle];
        const name = t(`crop.fit.background.directions.d${angle}`);
        return (
          <button
            key={angle}
            type="button"
            role="radio"
            aria-checked={value === angle}
            aria-label={name}
            title={name}
            disabled={disabled}
            onClick={() => onChange(angle)}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded border transition-colors disabled:opacity-40",
              value === angle ? "border-blue-500 bg-blue-500/15" : "opacity-75 hover:opacity-100",
            )}
            data-testid={`${testId}-${angle}`}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}

/** Solid fill: optional two-colour gradient with a few ready-made pairs. */
function GradientFillControls({
  fit,
  suffix,
}: {
  fit: ReturnType<typeof useEditorFit>;
  suffix: string;
}) {
  const { t } = useTranslation();
  const { fillGradient, color, colorTo, gradientAngle } = fit.settings;
  const disabled = fit.batchWorking;
  const set = (next: Partial<typeof fit.settings>) => fit.setSettings((settings) => ({ ...settings, ...next }));
  const opaque = pickerValue(color);
  return (
    <div className="space-y-2 rounded-md border p-2.5" data-testid={`fit-gradient${suffix}`}>
      <div className="flex items-center gap-1.5">
        <label className="flex cursor-pointer items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={fillGradient}
            disabled={disabled}
            onChange={(e) =>
              // A see-through start colour cannot start a gradient: make it opaque.
              set({ fillGradient: e.target.checked, ...(e.target.checked ? { color: opaque } : {}) })
            }
            className="h-3.5 w-3.5 accent-blue-500"
            data-testid={`fit-gradient-toggle${suffix}`}
          />
          {t("crop.fit.background.gradient")}
        </label>
        <InfoHint
          term={t("crop.fit.info.gradient.term")}
          text={t("crop.fit.info.gradient.text")}
          testId={`fit-gradient-info${suffix}`}
        />
      </div>
      {fillGradient && (
        <>
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-7 flex-1 rounded border"
              style={{ backgroundImage: gradientCss(opaque, colorTo, gradientAngle) }}
              data-testid={`fit-gradient-sample${suffix}`}
            />
            <DelayedColorInput
              value={colorTo}
              onChange={(value) => set({ colorTo: value })}
              disabled={disabled}
              label={t("crop.fit.background.gradientTo")}
              testId={`fit-gradient-to${suffix}`}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs opacity-70">{t("crop.fit.background.direction")}</span>
            <DirectionPicker
              value={gradientAngle}
              onChange={(angle) => set({ gradientAngle: angle })}
              disabled={disabled}
              testId={`fit-gradient-direction${suffix}`}
            />
          </div>
          <div className="grid grid-cols-6 gap-1.5" role="group" aria-label={t("crop.fit.background.gradientPresets")}>
            {GRADIENT_PRESETS.map((preset) => {
              const active = opaque === preset.from && colorTo === preset.to;
              return (
                <button
                  key={preset.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => set({ color: preset.from, colorTo: preset.to })}
                  className={cn(
                    "h-6 rounded border transition-transform active:scale-95",
                    active ? "ring-2 ring-blue-500 ring-offset-1 ring-offset-background" : "opacity-85 hover:opacity-100",
                  )}
                  style={{ backgroundImage: gradientCss(preset.from, preset.to, 135) }}
                  aria-label={t(`crop.fit.background.gradientNames.${preset.id}`)}
                  title={t(`crop.fit.background.gradientNames.${preset.id}`)}
                  aria-pressed={active}
                  data-testid={`fit-gradient-preset-${preset.id}${suffix}`}
                />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/** A compact labelled range with its value in percent, like Darken. */
export function PercentSlider({
  id,
  label,
  value,
  max = 1,
  disabled,
  onChange,
  testId,
  suffix,
  info,
}: {
  id: string;
  label: string;
  value: number;
  max?: number;
  disabled: boolean;
  onChange: (value: number) => void;
  testId: string;
  suffix: string;
  info?: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1 text-xs">
        <Label htmlFor={id} className="text-xs opacity-70">
          {label}
        </Label>
        {info}
        <span className="ml-auto tabular-nums opacity-70" data-testid={`${testId}-value${suffix}`}>
          {Math.round(value * 100)}%
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={max}
        step={0.05}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer accent-blue-500 disabled:cursor-default disabled:opacity-40"
        data-testid={`${testId}-slider${suffix}`}
      />
    </div>
  );
}

/**
 * Tint colour (native picker plus a few swatches) and its opacity. The picker
 * commits after a short pause, like the fill colour, so dragging it does not
 * flood the preview.
 */
function TintControls({
  color,
  opacity,
  disabled,
  suffix,
  onColor,
  onOpacity,
  gradient,
  colorTo,
  angle,
  onGradient,
}: {
  color: string;
  opacity: number;
  disabled: boolean;
  suffix: string;
  onColor: (color: string) => void;
  onOpacity: (opacity: number) => void;
  gradient: boolean;
  colorTo: string;
  angle: number;
  onGradient: (next: { gradient?: boolean; colorTo?: string; angle?: number }) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<string | null>(null);
  const latest = useRef(onColor);
  latest.current = onColor;
  useEffect(() => {
    if (draft === null) return;
    const timer = window.setTimeout(() => {
      latest.current(draft);
      setDraft(null);
    }, COLOR_COMMIT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [draft]);
  const shown = (draft ?? color).toLowerCase();

  return (
    <div className="space-y-1.5" data-testid={`fit-tint${suffix}`}>
      <PercentSlider
        id={`fit-tint${suffix}-range`}
        label={t("crop.fit.background.tint")}
        value={opacity}
        disabled={disabled}
        onChange={onOpacity}
        testId="fit-tint"
        suffix={suffix}
        info={
          <InfoHint
            term={t("crop.fit.info.tint.term")}
            text={t("crop.fit.info.tint.text")}
            testId={`fit-tint-info${suffix}`}
          />
        }
      />
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          value={pickerValue(shown)}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          className="h-6 w-8 shrink-0 cursor-pointer rounded border bg-transparent p-0.5"
          title={t("crop.fit.background.tintColor")}
          aria-label={t("crop.fit.background.tintColor")}
          data-testid={`fit-tint-color${suffix}`}
        />
        {TINT_SWATCHES.map((swatch) => (
          <button
            key={swatch}
            type="button"
            disabled={disabled}
            onClick={() => {
              setDraft(null);
              onColor(swatch);
              if (opacity === 0) onOpacity(0.3);
            }}
            className={cn(
              "h-6 min-w-0 flex-1 rounded border transition-transform active:scale-95",
              shown === swatch ? "ring-2 ring-blue-500 ring-offset-1 ring-offset-background" : "opacity-80 hover:opacity-100",
            )}
            style={{ backgroundColor: swatch }}
            aria-label={`${t("crop.fit.background.tintColor")} ${swatch}`}
            aria-pressed={shown === swatch}
            data-testid={`fit-tint-swatch-${swatch.slice(1)}${suffix}`}
          />
        ))}
      </div>
      {opacity > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <div
            role="radiogroup"
            aria-label={t("crop.fit.background.tintStyle")}
            className="inline-flex rounded-md border p-0.5 text-[11px]"
          >
            {([false, true] as const).map((value) => (
              <button
                key={String(value)}
                type="button"
                role="radio"
                aria-checked={gradient === value}
                disabled={disabled}
                onClick={() => onGradient({ gradient: value })}
                className={cn(
                  "rounded px-2 py-0.5 transition-colors",
                  gradient === value ? "bg-blue-500/15 font-medium" : "opacity-70 hover:opacity-100",
                )}
                data-testid={`fit-tint-style-${value ? "gradient" : "solid"}${suffix}`}
              >
                {t(value ? "crop.fit.background.tintGradient" : "crop.fit.background.tintSolid")}
              </button>
            ))}
          </div>
          {gradient && (
            <>
              <DelayedColorInput
                value={colorTo}
                onChange={(value) => onGradient({ colorTo: value })}
                disabled={disabled}
                label={t("crop.fit.background.gradientTo")}
                testId={`fit-tint-color-to${suffix}`}
                className="h-6 w-8"
              />
              <DirectionPicker
                value={angle}
                onChange={(value) => onGradient({ angle: value })}
                disabled={disabled}
                testId={`fit-tint-direction${suffix}`}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Log slider from 10 % to 1000 % of the size that just covers the canvas. */
const LAYER_SLIDER_MIN = Math.log2(MIN_BACKGROUND_SCALE);
const LAYER_SLIDER_MAX = Math.log2(MAX_BACKGROUND_SCALE);

/** Zoom and turn of the background picture; moving it happens on the stage. */
function BackgroundLayerControls({
  fit,
  suffix,
}: {
  fit: ReturnType<typeof useEditorFit>;
  suffix: string;
}) {
  const { t } = useTranslation();
  const current = fit.backgroundPlacement ?? DEFAULT_PLACEMENT;
  const disabled = fit.batchWorking;
  const set = (next: Partial<typeof current>) => fit.setBackgroundPlacement({ ...current, ...next });
  return (
    <div className="space-y-2 pt-1" data-testid={`fit-background-layer${suffix}`}>
      <div className="space-y-1">
        <div className="flex items-center gap-1">
          <Label htmlFor={`fit-bg-scale-slider${suffix}`} className="text-xs opacity-70">
            {t("crop.fit.background.layerScale")}
          </Label>
          <InfoHint
            term={t("crop.fit.info.cover.term")}
            text={t("crop.fit.info.cover.text")}
            testId={`fit-bg-scale-info${suffix}`}
          />
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <input
            id={`fit-bg-scale-slider${suffix}`}
            type="range"
            min={LAYER_SLIDER_MIN}
            max={LAYER_SLIDER_MAX}
            step="any"
            disabled={disabled}
            value={Math.log2(current.scale)}
            onChange={(e) => set({ scale: 2 ** Number(e.target.value) })}
            className="h-1.5 min-w-0 flex-1 cursor-pointer accent-blue-500 disabled:cursor-default disabled:opacity-40"
            data-testid={`fit-bg-scale-slider${suffix}`}
          />
          <NumberField
            id={`fit-bg-scale${suffix}`}
            label={t("crop.fit.background.layerScale")}
            value={Math.round(current.scale * 1000) / 10}
            min={MIN_BACKGROUND_SCALE * 100}
            max={MAX_BACKGROUND_SCALE * 100}
            disabled={disabled}
            testId={`fit-bg-scale-input${suffix}`}
            onCommit={(value) => value > 0 && set({ scale: value / 100 })}
          />
          <span className="-ml-1 text-xs opacity-70" aria-hidden="true">%</span>
        </div>
      </div>
      <AngleRow
        id={`fit-bg-rotation${suffix}`}
        value={current.rotation ?? 0}
        disabled={disabled}
        onChange={(rotation) => set({ rotation })}
        testId="fit-bg-rotation"
        suffix={suffix}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 w-full gap-1.5 text-xs"
        disabled={disabled || !fit.backgroundPlacement}
        onClick={() => fit.setBackgroundPlacement(null)}
        data-testid={`fit-bg-reset-btn${suffix}`}
      >
        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
        {t("crop.fit.background.layerReset")}
      </Button>
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
  const { t, i18n } = useTranslation();
  const [fileError, setFileError] = useState<string | null>(null);
  const { mode, pattern, dim, color, blur, tint, tintColor } = fit.settings;
  const disabled = fit.batchWorking;
  if (!patternSupported(mode) && !dimSupported(mode) && mode !== "image") return null;

  const pick = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
      setFileError(t("crop.fit.background.wrongType"));
      return;
    }
    if (file.size > maxUploadBytes()) {
      setFileError(t("crop.fit.background.tooLarge", { size: formatUploadLimit(i18n.language) }));
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
          {fit.backgroundImage && <BackgroundLayerControls fit={fit} suffix={suffix} />}
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
      {blurSupported(mode) && (
        <PercentSlider
          id={`fit-blur${suffix}`}
          label={t("crop.fit.background.blur")}
          value={blur ?? defaultBlur(mode)}
          disabled={disabled}
          onChange={(value) => fit.setSettings((settings) => ({ ...settings, blur: value }))}
          testId="fit-blur"
          suffix={suffix}
          info={
            <InfoHint
              term={t("crop.fit.info.blur.term")}
              text={t("crop.fit.info.blur.text")}
              testId={`fit-blur-info${suffix}`}
            />
          }
        />
      )}
      {dimSupported(mode) && (
        <PercentSlider
          id={`fit-dim${suffix}`}
          label={t("crop.fit.background.dim")}
          value={dim}
          max={MAX_BACKGROUND_DIM}
          disabled={disabled}
          onChange={(value) => fit.setSettings((settings) => ({ ...settings, dim: value }))}
          testId="fit-dim"
          suffix={suffix}
        />
      )}
      {tintSupported(mode) && (
        <TintControls
          color={tintColor}
          opacity={tint}
          disabled={disabled}
          suffix={suffix}
          onColor={(value) => fit.setSettings((settings) => ({ ...settings, tintColor: value }))}
          onOpacity={(value) => fit.setSettings((settings) => ({ ...settings, tint: value }))}
          gradient={fit.settings.tintGradient}
          colorTo={fit.settings.tintColorTo}
          angle={fit.settings.tintAngle}
          onGradient={(next) =>
            fit.setSettings((settings) => ({
              ...settings,
              ...(next.gradient !== undefined ? { tintGradient: next.gradient } : {}),
              ...(next.colorTo ? { tintColorTo: next.colorTo } : {}),
              ...(next.angle !== undefined ? { tintAngle: next.angle } : {}),
            }))
          }
        />
      )}
    </div>
  );
}

/** A target size as a small card: its shape, name and pixels. */
function PresetTile({
  preset,
  selected,
  disabled,
  suffix,
  onSelect,
}: {
  preset: FitPreset;
  selected: boolean;
  disabled: boolean;
  suffix: string;
  onSelect: () => void;
}) {
  const { t, i18n } = useTranslation();
  const size = preset === "custom" ? null : FIT_PRESETS[preset];
  // Some tiles say where the size is used, e.g. Shorts, Reels and TikTok.
  const detailsKey = `form.fitSize.preset.details.${FIT_PRESET_LABELS[preset]}`;
  const details = i18n.exists(detailsKey) ? t(detailsKey) : undefined;
  // The shape fits an 18 × 18 box.
  const shape = size
    ? size.width >= size.height
      ? { width: 18, height: Math.max(5, (18 * size.height) / size.width) }
      : { width: Math.max(5, (18 * size.width) / size.height), height: 18 }
    : null;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      title={details}
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-md border px-2 py-1 text-left transition-colors disabled:opacity-50",
        selected ? "border-blue-500 bg-blue-500/10" : "hover:bg-current/5",
      )}
      data-testid={`fit-preset-${preset}${suffix}`}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden="true">
        {shape ? (
          <span
            className={cn("rounded-[2px] border-[1.5px]", selected ? "border-blue-500" : "border-current opacity-60")}
            style={shape}
          />
        ) : (
          <span className={cn("h-4 w-4 rounded-[2px] border-[1.5px] border-dashed", selected ? "border-blue-500" : "border-current opacity-60")} />
        )}
      </span>
      <span className="min-w-0">
        <span className="block break-words text-xs font-medium leading-tight">
          {t(`form.fitSize.preset.short.${FIT_PRESET_LABELS[preset]}`)}
        </span>
        <span className="block text-[10px] tabular-nums leading-tight opacity-60">
          {size ? `${size.width} × ${size.height}` : t("form.fitSize.preset.ownSize")}
        </span>
      </span>
    </button>
  );
}

/**
 * Modes whose look is set in the background tab: the size tab links there and
 * focuses the control people look for first.
 */
const BACKGROUND_LINKS: Partial<Record<FitMode, { icon: LucideIcon; target: string }>> = {
  solid: { icon: Palette, target: "fit-color-input" },
  blur: { icon: SlidersHorizontal, target: "fit-blur-slider" },
  image: { icon: ImagePlus, target: "fit-background-choose-btn" },
};

function BackgroundLink({
  mode,
  suffix,
  onOpen,
}: {
  mode: FitMode;
  suffix: string;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const link = BACKGROUND_LINKS[mode];
  if (!link) return null;
  const Icon = link.icon;
  return (
    <button
      type="button"
      onClick={() => {
        onOpen();
        // The tab panel is shown on the next render; then focus its control.
        window.setTimeout(() => {
          const control = document.querySelector<HTMLElement>(`[data-testid="${link.target}${suffix}"]`);
          control?.scrollIntoView({ block: "center" });
          control?.focus();
        }, 0);
      }}
      className="group flex min-h-11 w-full items-center gap-2 rounded-md px-2 text-left text-xs font-medium text-blue-600 transition-colors hover:bg-blue-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-400"
      data-testid={`fit-mode-background-link${suffix}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">{t(`form.fitSize.mode.backgroundLink.${mode}`)}</span>
      <ArrowRight
        className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5"
        aria-hidden="true"
      />
    </button>
  );
}

/** No background settings for this mode: say so instead of an empty tab. */
const hasBackgroundSettings = (mode: FitMode) =>
  mode === "solid" || patternSupported(mode) || dimSupported(mode) || mode === "image";

/**
 * One tab of the target size settings: "size" holds the output size and
 * fit mode, "background" what fills the canvas around the image.
 */
export function FitControls({
  fit,
  suffix = "",
  section,
  backgroundInput,
  onNeedBackground,
  compact = false,
}: {
  fit: ReturnType<typeof useEditorFit>;
  suffix?: string;
  section: "size" | "background";
  /** Small screens: no background tab, so the fill colour sits here. */
  compact?: boolean;
  /** Shared by both sections: the mode buttons open the picker in the other one. */
  backgroundInput: React.RefObject<HTMLInputElement | null>;
  onNeedBackground?: () => void;
}) {
  const { t } = useTranslation();
  if (section === "background") {
    return (
      <div className="space-y-3" data-testid={`crop-fit-background${suffix}`}>
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
        {fit.settings.mode === "solid" && <GradientFillControls fit={fit} suffix={suffix} />}
        <FitBackgroundControls fit={fit} suffix={suffix} fileInput={backgroundInput} />
        {!hasBackgroundSettings(fit.settings.mode) && (
          <p className="text-xs opacity-70" data-testid={`fit-background-none${suffix}`}>
            {t("crop.fit.background.none")}
          </p>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-3" data-testid={`crop-fit-controls${suffix}`}>
      <div className="flex items-center gap-1.5">
        <p
          id={`fit-preset-label${suffix}`}
          className="text-xs uppercase tracking-wide opacity-70"
        >
          {t("form.fitSize.preset.label")}
        </p>
        <InfoHint
          term={t("form.fitSize.preset.label")}
          text={t("crop.fit.hint")}
          testId={`fit-size-info${suffix}`}
        />
      </div>
      <div
        role="radiogroup"
        aria-labelledby={`fit-preset-label${suffix}`}
        className="space-y-2"
        data-testid={`fit-presets${suffix}`}
      >
        {FIT_PRESET_GROUPS.map((group) => (
          <div
            key={group.id}
            role="group"
            aria-labelledby={`fit-preset-group-${group.id}-label${suffix}`}
            data-testid={`fit-preset-group-${group.id}${suffix}`}
          >
            <p
              id={`fit-preset-group-${group.id}-label${suffix}`}
              className="mb-1 text-[11px] font-medium opacity-60"
            >
              {t(`form.fitSize.preset.groups.${group.id}`)}
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {group.presets.map((option: FitPreset) => (
                <PresetTile
                  key={option}
                  preset={option}
                  selected={fit.settings.preset === option}
                  disabled={fit.batchWorking}
                  suffix={suffix}
                  onSelect={() => {
                    // A preset also fills the custom fields, so "Custom" starts from it.
                    const size = option === "custom" ? null : FIT_PRESETS[option];
                    fit.setSettings((settings) => ({
                      ...settings,
                      preset: option,
                      ...(size ? { customWidth: String(size.width), customHeight: String(size.height) } : {}),
                    }));
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
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
      <p
        id={`fit-mode-label${suffix}`}
        className="pt-1 text-xs uppercase tracking-wide opacity-70"
      >
        {t("form.fitSize.mode.label")}
      </p>
      <div
        role="group"
        aria-labelledby={`fit-mode-label${suffix}`}
        className="grid grid-cols-2 gap-2"
      >
        {FIT_MODES.filter(
          // The picture is chosen in the background tab, which small screens do not have.
          (mode) => !compact || mode !== "image" || fit.settings.mode === "image",
        ).map((mode) => (
          <Button
            key={mode}
            type="button"
            size="sm"
            className={cn(
              "h-auto min-h-9 whitespace-normal text-xs",
              // Five modes: the last one takes a full row.
              mode === "image" && !compact && "col-span-2",
            )}
            variant={fit.settings.mode === mode ? "default" : "outline"}
            disabled={fit.batchWorking}
            onClick={() => {
              fit.setSettings({ ...fit.settings, mode });
              // No picture yet: show the background tab and open the picker.
              if (mode === "image" && !fit.backgroundImage) {
                onNeedBackground?.();
                window.setTimeout(() => backgroundInput.current?.click(), 0);
              }
            }}
            data-testid={`fit-mode-${mode}-btn${suffix}`}
          >
            {t(`form.fitSize.mode.${mode}`)}
          </Button>
        ))}
      </div>
      <p className="text-xs opacity-70">
        {t(`form.fitSize.mode.${fit.settings.mode}Hint`)}
      </p>
      {!compact && onNeedBackground && (
        <BackgroundLink mode={fit.settings.mode} suffix={suffix} onOpen={onNeedBackground} />
      )}
      {compact && fit.settings.mode === "solid" && (
        <FitColorPicker
          color={fit.settings.color}
          onChange={(color) => fit.setSettings((settings) => ({ ...settings, color }))}
          disabled={fit.batchWorking}
          suffix={suffix}
        />
      )}
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
    </div>
  );
}

/** Output size, preview, apply to all and errors, shown below every fit tab. */
export function FitStatus({
  fit,
  suffix = "",
  canApplyToAll,
}: {
  fit: ReturnType<typeof useEditorFit>;
  suffix?: string;
  canApplyToAll: boolean;
}) {
  const { t } = useTranslation();
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
  return (
    <div className="space-y-3" data-testid={`crop-fit-status${suffix}`}>
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
