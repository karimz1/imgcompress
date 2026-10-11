"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, WandSparkles } from "lucide-react";
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
  FIT_PRESET_OPTIONS,
  MAX_FIT_DIMENSION,
  toFitPreset,
} from "@/lib/fitToSize";
import type { useEditorFit } from "./useEditorFit";

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
        {(["crop", "blur"] as const).map((mode) => (
          <Button
            key={mode}
            type="button"
            size="sm"
            className="h-auto min-h-9 whitespace-normal"
            variant={fit.settings.mode === mode ? "default" : "outline"}
            disabled={fit.batchWorking}
            onClick={() => fit.setSettings({ ...fit.settings, mode })}
            data-testid={`fit-mode-${mode}-btn${suffix}`}
          >
            {t(`form.fitSize.mode.${mode}`)}
          </Button>
        ))}
      </div>
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
