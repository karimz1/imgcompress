"use client";

import React, { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Crosshair, Expand, Grid3x3, RotateCcw, RotateCw, Shrink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  coverScale,
  DEFAULT_PLACEMENT,
  MAX_PLACEMENT_SCALE,
  MIN_PLACEMENT_SCALE,
  normalizeAngle,
  snapAngle,
  type FitOutput,
  type FitPlacement,
} from "@/lib/fitToSize";
import { cn } from "@/lib/utils";

/** The slider covers 10 % to 400 % on a log scale; the field takes the full range. */
const SLIDER_MIN = Math.log2(0.1);
const SLIDER_MAX = Math.log2(4);

/** "⌘" on Apple devices, "Ctrl" elsewhere. Starts as Ctrl so SSR and first paint match. */
export function useModifierLabel(): string {
  const [label, setLabel] = useState("Ctrl");
  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) setLabel("⌘");
  }, []);
  return label;
}

/** A number input that keeps what is being typed and commits valid numbers. */
export function NumberField({
  id,
  label,
  value,
  onCommit,
  disabled,
  testId,
  min,
  max,
}: {
  id: string;
  label: string;
  value: number;
  onCommit: (value: number) => void;
  disabled: boolean;
  testId: string;
  min?: number;
  max?: number;
}) {
  // What is typed while the field has focus; outside changes show otherwise.
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <Input
      id={id}
      aria-label={label}
      data-testid={testId}
      type="number"
      inputMode="decimal"
      step={1}
      min={min}
      max={max}
      disabled={disabled}
      className="h-7 w-[4.5rem] shrink-0 px-1.5 text-right text-xs tabular-nums"
      value={draft ?? String(value)}
      onChange={(e) => {
        setDraft(e.target.value);
        const parsed = Number(e.target.value);
        if (e.target.value.trim() !== "" && Number.isFinite(parsed)) onCommit(parsed);
      }}
      onBlur={() => setDraft(null)}
    />
  );
}

function ToolButton({
  icon,
  label,
  tip,
  onClick,
  disabled,
  testId,
}: {
  icon: ReactNode;
  label: string;
  tip: string;
  onClick: () => void;
  disabled: boolean;
  testId: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          data-testid={testId}
          className={cn(
            "flex min-w-0 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[11px] leading-tight transition-colors",
            "hover:bg-black/5 dark:hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-400",
            "disabled:pointer-events-none disabled:opacity-40",
          )}
        >
          {icon}
          <span className="w-full truncate text-center">{label}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-56 text-xs">
        {tip}
      </TooltipContent>
    </Tooltip>
  );
}

export function FitPlacementControls({
  fit,
  source,
  placement,
  onChange,
  disabled,
  showGrid,
  onShowGridChange,
  suffix = "",
}: {
  fit: FitOutput;
  source: { width: number; height: number };
  placement: FitPlacement | null;
  onChange: (placement: FitPlacement | null) => void;
  disabled: boolean;
  showGrid: boolean;
  onShowGridChange: (show: boolean) => void;
  suffix?: string;
}) {
  const { t } = useTranslation();
  const mod = useModifierLabel();
  const canvas = { width: fit.width, height: fit.height };
  const current = placement ?? DEFAULT_PLACEMENT;
  const iconClass = "h-4 w-4 shrink-0";
  return (
    <TooltipProvider delayDuration={300}>
      <div
        className="space-y-2.5 rounded-md border p-2.5"
        data-testid={`fit-placement-controls${suffix}`}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 truncate text-xs font-medium">{t("crop.fit.placement.title")}</p>
          <Tooltip>
            <TooltipTrigger asChild>
              <label
                htmlFor={`fit-grid${suffix}`}
                className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs opacity-80"
              >
                <Grid3x3 className="h-3.5 w-3.5" aria-hidden="true" />
                {t("crop.fit.placement.grid")}
                <Switch
                  id={`fit-grid${suffix}`}
                  checked={showGrid}
                  onCheckedChange={onShowGridChange}
                  className="h-4 w-7 [&>span]:h-3 [&>span]:w-3 [&>span[data-state=checked]]:translate-x-3"
                  data-testid={`fit-grid-toggle${suffix}`}
                />
              </label>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-56 text-xs">
              {t("crop.fit.placement.gridTip")}
            </TooltipContent>
          </Tooltip>
        </div>
        <div
          role="toolbar"
          aria-label={t("crop.fit.placement.title")}
          className="grid grid-cols-4 divide-x overflow-hidden rounded-md border"
        >
          <ToolButton
            icon={<Crosshair className={iconClass} aria-hidden="true" />}
            label={t("crop.fit.placement.center")}
            tip={t("crop.fit.placement.centerTip")}
            disabled={disabled}
            onClick={() => onChange({ ...current, x: 0.5, y: 0.5 })}
            testId={`fit-placement-center-btn${suffix}`}
          />
          <ToolButton
            icon={<Shrink className={iconClass} aria-hidden="true" />}
            label={t("crop.fit.placement.fit")}
            tip={t("crop.fit.placement.fitTip", { mod })}
            disabled={disabled}
            onClick={() => onChange({ scale: 1, x: 0.5, y: 0.5, rotation: current.rotation })}
            testId={`fit-placement-fit-btn${suffix}`}
          />
          <ToolButton
            icon={<Expand className={iconClass} aria-hidden="true" />}
            label={t("crop.fit.placement.fill")}
            tip={t("crop.fit.placement.fillTip")}
            disabled={disabled}
            onClick={() =>
              onChange({ scale: coverScale(source, canvas), x: 0.5, y: 0.5, rotation: current.rotation })
            }
            testId={`fit-placement-fill-btn${suffix}`}
          />
          <ToolButton
            icon={<RotateCcw className={iconClass} aria-hidden="true" />}
            label={t("crop.fit.placement.reset")}
            tip={t("crop.fit.placement.resetTip")}
            disabled={disabled || !placement}
            onClick={() => onChange(null)}
            testId={`fit-placement-reset-btn${suffix}`}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`fit-scale-slider${suffix}`} className="text-xs opacity-80">
            {t("crop.fit.placement.scale")}
          </Label>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex min-w-0 items-center gap-2">
                <input
                  id={`fit-scale-slider${suffix}`}
                  type="range"
                  min={SLIDER_MIN}
                  max={SLIDER_MAX}
                  step="any"
                  disabled={disabled}
                  value={Math.min(SLIDER_MAX, Math.max(SLIDER_MIN, Math.log2(current.scale)))}
                  onChange={(e) =>
                    onChange({ ...current, scale: 2 ** Number(e.target.value) })
                  }
                  className="h-1.5 min-w-0 flex-1 cursor-pointer accent-blue-500 disabled:cursor-default disabled:opacity-40"
                  data-testid={`fit-scale-slider${suffix}`}
                />
                <NumberField
                  id={`fit-scale${suffix}`}
                  label={t("crop.fit.placement.scale")}
                  value={Math.round(current.scale * 1000) / 10}
                  min={MIN_PLACEMENT_SCALE * 100}
                  max={MAX_PLACEMENT_SCALE * 100}
                  disabled={disabled}
                  testId={`fit-scale-input${suffix}`}
                  onCommit={(value) => value > 0 && onChange({ ...current, scale: value / 100 })}
                />
                <span className="-ml-1 text-xs opacity-70" aria-hidden="true">%</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-56 text-xs">
              {t("crop.fit.placement.scaleTip", { mod })}
            </TooltipContent>
          </Tooltip>
        </div>
        <AngleRow
          id={`fit-rotation${suffix}`}
          value={current.rotation ?? 0}
          disabled={disabled}
          onChange={(rotation) => onChange({ ...current, rotation })}
          testId="fit-rotation"
          suffix={suffix}
        />
        <p className="text-[11px] leading-snug opacity-70" data-testid={`fit-placement-hint${suffix}`}>
          {t("crop.fit.placement.hint", { mod })}
        </p>
      </div>
    </TooltipProvider>
  );
}

/**
 * Turn slider, degree field and a reset, shared by every element that turns:
 * the image, the background picture, text and picture layers. Shift keeps to
 * 15° steps, like the turn handle on the stage.
 */
export function AngleRow({
  id,
  value,
  disabled,
  onChange,
  testId,
  suffix,
}: {
  id: string;
  value: number;
  disabled: boolean;
  onChange: (angle: number) => void;
  testId: string;
  suffix: string;
}) {
  const { t } = useTranslation();
  const shown = Math.round(value * 10) / 10;
  const shift = useRef(false);
  const track = (e: { shiftKey: boolean }) => {
    shift.current = e.shiftKey;
  };
  // Shift with the arrow keys goes to the next 15° step, in the slider and the field.
  const stepKeys = (e: React.KeyboardEvent) => {
    track(e);
    const direction =
      e.key === "ArrowUp" || e.key === "ArrowRight" ? 1 : e.key === "ArrowDown" || e.key === "ArrowLeft" ? -1 : 0;
    if (!e.shiftKey || !direction || disabled) return;
    e.preventDefault();
    const steps = direction > 0 ? Math.floor(shown / 15 + 1e-6) + 1 : Math.ceil(shown / 15 - 1e-6) - 1;
    onChange(normalizeAngle(steps * 15));
  };
  return (
    <div className="space-y-1" onKeyDownCapture={stepKeys} onKeyUpCapture={track}>
      <Label htmlFor={`${id}-slider`} className="flex items-center gap-1.5 text-xs opacity-80">
        <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
        {t("crop.fit.placement.rotation")}
      </Label>
      <div className="flex min-w-0 items-center gap-2">
        <input
          id={`${id}-slider`}
          type="range"
          min={-180}
          max={180}
          step={1}
          disabled={disabled}
          value={shown}
          onPointerDown={track}
          onPointerMove={track}
          onChange={(e) => {
            const angle = Number(e.target.value);
            onChange(shift.current ? snapAngle(angle, true) : angle);
          }}
          title={t("crop.fit.placement.rotationTip")}
          className="h-1.5 min-w-0 flex-1 cursor-pointer accent-blue-500 disabled:cursor-default disabled:opacity-40"
          data-testid={`${testId}-slider${suffix}`}
        />
        <NumberField
          id={id}
          label={t("crop.fit.placement.rotationField")}
          value={shown}
          min={-360}
          max={360}
          disabled={disabled}
          testId={`${testId}-input${suffix}`}
          onCommit={(angle) => onChange(normalizeAngle(angle))}
        />
        <span className="-ml-1 text-xs opacity-70" aria-hidden="true">°</span>
        <button
          type="button"
          disabled={disabled || shown === 0}
          onClick={() => onChange(0)}
          aria-label={t("crop.fit.placement.rotationReset")}
          title={t("crop.fit.placement.rotationReset")}
          className="rounded p-1 opacity-70 hover:bg-black/5 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:opacity-30 dark:hover:bg-white/10"
          data-testid={`${testId}-reset${suffix}`}
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
