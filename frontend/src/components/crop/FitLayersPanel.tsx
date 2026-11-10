"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  ImagePlus,
  Italic,
  Loader2,
  RotateCcw,
  Trash2,
  Type,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AngleRow } from "./FitPlacementControls";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  BACKGROUND_IMAGE_ACCEPT,
  fontHasItalic,
  MAX_IMAGE_LAYERS,
  MAX_TEXT_LAYERS,
  MAX_TEXT_LENGTH,
  MAX_TEXT_SIZE,
  MIN_TEXT_SIZE,
  TEXT_ALIGNS,
  TEXT_FONT_LABELS,
  TEXT_FONTS,
  type FitLayer,
  type PictureLayer,
  type TextAlign,
  type TextFont,
  type TextLayer,
  type TextStyleId,
} from "@/lib/fitToSize";
import { cn } from "@/lib/utils";
import { PercentSlider, pickerValue } from "./FitControls";
import { InfoHint } from "./InfoHint";
import { formatUploadLimit, maxUploadBytes } from "@/lib/uploadLimit";
import type { useEditorFit } from "./useEditorFit";

const TEXT_SWATCHES = ["#ffffff", "#000000", "#facc15", "#ef4444"] as const;
const QUICK_TEXTS: TextStyleId[] = ["title", "subtitle", "watermark"];
const ALIGN_ICONS: Record<TextAlign, LucideIcon> = {
  left: AlignLeft,
  center: AlignCenter,
  right: AlignRight,
};

const toggleClass = (on: boolean) =>
  cn(
    "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-35",
    on ? "border-blue-500 bg-blue-500/15" : "opacity-80 hover:bg-current/5 hover:opacity-100",
  );

const iconButton =
  "flex h-6 w-6 pointer-coarse:h-11 pointer-coarse:w-11 shrink-0 items-center justify-center rounded opacity-60 transition-opacity hover:bg-current/10 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-20";

/**
 * Texts and pictures on top of the image: quick add, a compact list (top
 * first, like the stage) and the settings of the selected one.
 */
export function FitLayersPanel({
  fit,
  suffix = "",
  editRequest = 0,
  onEditHandled,
}: {
  fit: ReturnType<typeof useEditorFit>;
  suffix?: string;
  /** Bumped by a double-click on a text on the stage: focus its field. */
  editRequest?: number;
  onEditHandled?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const disabled = fit.batchWorking;
  const fileInput = useRef<HTMLInputElement | null>(null);
  const textInput = useRef<HTMLTextAreaElement | null>(null);
  const focusText = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const selected = fit.layers.find((layer) => layer.id === fit.selected) ?? null;

  useEffect(() => {
    if (!editRequest) return;
    if (selected?.kind === "text") {
      textInput.current?.focus();
      textInput.current?.select();
    }
    onEditHandled?.();
    // Only a new request focuses; selecting on the stage must not steal focus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editRequest]);
  useEffect(() => {
    if (focusText.current && selected?.kind === "text") {
      focusText.current = false;
      // The sample text is selected, so typing replaces it.
      textInput.current?.focus();
      textInput.current?.select();
    }
  }, [selected]);

  const addText = (style: TextStyleId) => {
    focusText.current = true;
    fit.addText(style, t(`crop.fit.layers.sample.${style}`));
  };

  const addPicture = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
      setError(t("crop.fit.background.wrongType"));
      return;
    }
    if (file.size > maxUploadBytes()) {
      setError(t("crop.fit.background.tooLarge", { size: formatUploadLimit(i18n.language) }));
      return;
    }
    setError(null);
    setUploading(true);
    try {
      await fit.addPicture(file);
    } catch (err) {
      setError(err instanceof Error && err.message !== "too-large" ? err.message : t("crop.fit.layers.pictureFailed"));
    } finally {
      setUploading(false);
    }
  };

  const textName = (layer: TextLayer) => layer.text.split("\n")[0].trim() || t("crop.fit.layers.emptyText");
  const listed = [...fit.layers].reverse();

  return (
    <div className="space-y-3" data-testid={`fit-layers-panel${suffix}`}>
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-medium">{t("crop.fit.layers.add")}</p>
          <InfoHint
            term={t("crop.fit.info.layer.term")}
            text={t("crop.fit.info.layer.text")}
            testId={`fit-layers-info${suffix}`}
          />
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {QUICK_TEXTS.map((style) => (
            <Button
              key={style}
              type="button"
              size="sm"
              variant="outline"
              className={cn("h-8 justify-start gap-1.5 px-2 text-xs", style === "title" && "font-semibold")}
              disabled={disabled || !fit.canAddText}
              title={fit.canAddText ? undefined : t("crop.fit.layers.textLimit", { count: MAX_TEXT_LAYERS })}
              onClick={() => addText(style)}
              data-testid={`fit-add-${style}${suffix}`}
            >
              <Type className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
              <span className="truncate">{t(`crop.fit.layers.styles.${style}`)}</span>
            </Button>
          ))}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 justify-start gap-1.5 px-2 text-xs"
            disabled={disabled || uploading || !fit.canAddPicture}
            title={fit.canAddPicture ? undefined : t("crop.fit.layers.pictureLimit", { count: MAX_IMAGE_LAYERS })}
            onClick={() => fileInput.current?.click()}
            data-testid={`fit-add-picture${suffix}`}
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />
            ) : (
              <ImagePlus className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
            )}
            <span className="truncate">{t("crop.fit.layers.picture")}</span>
          </Button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept={BACKGROUND_IMAGE_ACCEPT}
          className="hidden"
          onChange={(e) => {
            void addPicture(e.target.files?.[0]);
            e.target.value = "";
          }}
          data-testid={`fit-picture-input${suffix}`}
        />
        {error && (
          <p role="alert" className="text-xs text-red-500" data-testid={`fit-layers-error${suffix}`}>
            {error}
          </p>
        )}
      </div>

      {listed.length === 0 ? (
        <p className="text-xs leading-snug opacity-70" data-testid={`fit-layers-empty${suffix}`}>
          {t("crop.fit.layers.empty")}
        </p>
      ) : (
        <ul className="space-y-0.5 rounded-md border p-1" aria-label={t("crop.fit.layers.list")} data-testid={`fit-layer-list${suffix}`}>
          {listed.map((layer, index) => {
            const isSelected = layer.id === fit.selected;
            const name = layer.kind === "text" ? textName(layer) : layer.picture.name;
            return (
              <li
                key={layer.id}
                className={cn(
                  "flex items-center gap-1.5 rounded px-1 py-0.5",
                  isSelected ? "bg-blue-500/15" : "hover:bg-current/5",
                )}
                data-testid={`fit-layer-row${suffix}`}
                data-layer-id={layer.id}
                data-kind={layer.kind}
                data-selected={isSelected ? "true" : "false"}
              >
                <button
                  type="button"
                  className={cn(
                    "flex min-w-0 flex-1 items-center gap-2 rounded py-0.5 text-left text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                    layer.hidden && "opacity-45",
                  )}
                  aria-pressed={isSelected}
                  onClick={() => fit.setSelected(layer.id)}
                  data-testid={`fit-layer-select${suffix}`}
                >
                  {layer.kind === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={layer.picture.url}
                      alt=""
                      className="h-6 w-6 shrink-0 rounded-sm border object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border text-[11px] font-semibold"
                    >
                      T
                    </span>
                  )}
                  <span className="min-w-0 truncate">{name}</span>
                </button>
                <button
                  type="button"
                  className={iconButton}
                  disabled={disabled}
                  onClick={() => fit.toggleLayer(layer.id)}
                  aria-label={t(layer.hidden ? "crop.fit.layers.show" : "crop.fit.layers.hide", { name })}
                  title={t(layer.hidden ? "crop.fit.layers.show" : "crop.fit.layers.hide", { name })}
                  data-testid={`fit-layer-visibility${suffix}`}
                >
                  {layer.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  className={iconButton}
                  disabled={disabled || index === 0}
                  onClick={() => fit.moveLayer(layer.id, 1)}
                  aria-label={t("crop.fit.layers.forward", { name })}
                  title={t("crop.fit.layers.forward", { name })}
                  data-testid={`fit-layer-up${suffix}`}
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  className={iconButton}
                  disabled={disabled || index === listed.length - 1}
                  onClick={() => fit.moveLayer(layer.id, -1)}
                  aria-label={t("crop.fit.layers.backward", { name })}
                  title={t("crop.fit.layers.backward", { name })}
                  data-testid={`fit-layer-down${suffix}`}
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  className={cn(iconButton, "hover:text-red-500")}
                  disabled={disabled}
                  onClick={() => fit.removeLayer(layer.id)}
                  aria-label={t("crop.fit.layers.remove", { name })}
                  title={t("crop.fit.layers.remove", { name })}
                  data-testid={`fit-layer-delete${suffix}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {selected?.kind === "text" && (
        <TextSettings
          layer={selected}
          fit={fit}
          disabled={disabled}
          suffix={suffix}
          inputRef={textInput}
        />
      )}
      {selected?.kind === "image" && (
        <PictureSettings layer={selected} fit={fit} disabled={disabled} suffix={suffix} />
      )}
      {!selected && listed.length > 0 && (
        <p className="text-xs leading-snug opacity-70">{t("crop.fit.layers.pick")}</p>
      )}
    </div>
  );
}

function TextSettings({
  layer,
  fit,
  disabled,
  suffix,
  inputRef,
}: {
  layer: TextLayer;
  fit: ReturnType<typeof useEditorFit>;
  disabled: boolean;
  suffix: string;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const { t } = useTranslation();
  const set = (next: Partial<TextLayer>, kind?: string) => fit.updateLayer(layer.id, next, kind);
  const italicOk = fontHasItalic(layer.font_id);
  return (
    <div className="space-y-3 rounded-md border p-2.5" data-testid={`fit-text-controls${suffix}`}>
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <Label htmlFor={`fit-text-input${suffix}`} className="text-xs opacity-70">
            {t("crop.fit.text.content")}
          </Label>
          <span className="tabular-nums opacity-60" data-testid={`fit-text-count${suffix}`}>
            {layer.text.length} / {MAX_TEXT_LENGTH}
          </span>
        </div>
        <textarea
          ref={inputRef}
          id={`fit-text-input${suffix}`}
          rows={2}
          maxLength={MAX_TEXT_LENGTH}
          value={layer.text}
          disabled={disabled}
          placeholder={t("crop.fit.text.placeholder")}
          onChange={(e) => set({ text: e.target.value }, `text:${layer.id}`)}
          className="w-full resize-y rounded-md border bg-transparent px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          data-testid={`fit-text-input${suffix}`}
        />
      </div>
      <div className="flex items-end gap-1.5">
        <div className="min-w-0 flex-1 space-y-1">
          <Label htmlFor={`fit-text-font${suffix}`} className="text-xs opacity-70">
            {t("crop.fit.text.font")}
          </Label>
          <select
            id={`fit-text-font${suffix}`}
            value={layer.font_id}
            disabled={disabled}
            onChange={(e) => {
              const font_id = e.target.value as TextFont;
              set({ font_id, ...(fontHasItalic(font_id) ? {} : { italic: false }) });
            }}
            className="h-8 w-full min-w-0 rounded-md border bg-background px-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            data-testid={`fit-text-font${suffix}`}
          >
            {TEXT_FONTS.map((font) => (
              <option key={font} value={font} style={{ fontFamily: `"imgc-${font}"` }}>
                {TEXT_FONT_LABELS[font]}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          aria-pressed={layer.bold}
          aria-label={t("crop.fit.text.bold")}
          title={`${t("crop.fit.text.bold")} (${modKey()}+B)`}
          disabled={disabled}
          onClick={() => set({ bold: !layer.bold })}
          className={toggleClass(layer.bold)}
          data-testid={`fit-text-bold${suffix}`}
        >
          <Bold className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-pressed={layer.italic}
          aria-label={t("crop.fit.text.italic")}
          title={italicOk ? `${t("crop.fit.text.italic")} (${modKey()}+I)` : t("crop.fit.text.noItalic")}
          disabled={disabled || !italicOk}
          onClick={() => set({ italic: !layer.italic })}
          className={toggleClass(layer.italic)}
          data-testid={`fit-text-italic${suffix}`}
        >
          <Italic className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs opacity-70" id={`fit-text-align-label${suffix}`}>
          {t("crop.fit.text.align")}
        </p>
        <div role="radiogroup" aria-labelledby={`fit-text-align-label${suffix}`} className="flex gap-1">
          {TEXT_ALIGNS.map((align) => {
            const Icon = ALIGN_ICONS[align];
            return (
              <button
                key={align}
                type="button"
                role="radio"
                aria-checked={layer.align === align}
                aria-label={t(`crop.fit.text.aligns.${align}`)}
                title={t(`crop.fit.text.aligns.${align}`)}
                disabled={disabled}
                onClick={() => set({ align })}
                className={toggleClass(layer.align === align)}
                data-testid={`fit-text-align-${align}${suffix}`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <Label htmlFor={`fit-text-size${suffix}`} className="text-xs opacity-70">
            {t("crop.fit.text.size")}
          </Label>
          <span className="tabular-nums opacity-70" data-testid={`fit-text-size-value${suffix}`}>
            {Math.round(layer.size * 1000) / 10}%
          </span>
        </div>
        <input
          id={`fit-text-size${suffix}`}
          type="range"
          min={MIN_TEXT_SIZE}
          max={MAX_TEXT_SIZE / 2}
          step={0.005}
          value={Math.min(layer.size, MAX_TEXT_SIZE / 2)}
          disabled={disabled}
          title={t("crop.fit.text.sizeTip")}
          onChange={(e) => set({ size: Number(e.target.value) })}
          className="h-1.5 w-full cursor-pointer accent-blue-500 disabled:cursor-default disabled:opacity-40"
          data-testid={`fit-text-size-slider${suffix}`}
        />
      </div>
      <AngleRow
        id={`fit-text-rotation${suffix}`}
        value={layer.rotation ?? 0}
        disabled={disabled}
        onChange={(rotation) => set({ rotation }, `rotate:${layer.id}`)}
        testId="fit-text-rotation"
        suffix={suffix}
      />
      <div className="space-y-1">
        <p className="text-xs opacity-70">{t("crop.fit.text.color")}</p>
        <div className="flex items-center gap-1.5">
          <input
            type="color"
            value={pickerValue(layer.color)}
            disabled={disabled}
            onChange={(e) => set({ color: e.target.value })}
            aria-label={t("crop.fit.text.color")}
            title={t("crop.fit.text.color")}
            className="h-6 w-8 shrink-0 cursor-pointer rounded border bg-transparent p-0.5"
            data-testid={`fit-text-color${suffix}`}
          />
          {TEXT_SWATCHES.map((swatch) => (
            <button
              key={swatch}
              type="button"
              disabled={disabled}
              onClick={() => set({ color: swatch })}
              className={cn(
                "h-6 min-w-0 flex-1 rounded border transition-transform active:scale-95",
                layer.color.toLowerCase() === swatch
                  ? "ring-2 ring-blue-500 ring-offset-1 ring-offset-background"
                  : "opacity-80 hover:opacity-100",
              )}
              style={{ backgroundColor: swatch }}
              aria-label={`${t("crop.fit.text.color")} ${swatch}`}
              aria-pressed={layer.color.toLowerCase() === swatch}
              data-testid={`fit-text-swatch-${swatch.slice(1)}${suffix}`}
            />
          ))}
        </div>
      </div>
      <details className="group" data-testid={`fit-text-more${suffix}`}>
        <summary className="cursor-pointer text-xs opacity-70 hover:opacity-100" data-testid={`fit-text-more-toggle${suffix}`}>
          {t("crop.fit.text.more")}
        </summary>
        <div className="space-y-3 pt-2">
          <PercentSlider
            id={`fit-text-opacity${suffix}`}
            label={t("crop.fit.text.opacity")}
            value={layer.opacity}
            disabled={disabled}
            onChange={(opacity) => set({ opacity: Math.max(0.05, opacity) })}
            testId="fit-text-opacity"
            suffix={suffix}
            info={
              <InfoHint
                term={t("crop.fit.info.opacity.term")}
                text={t("crop.fit.info.opacity.text")}
                testId={`fit-text-opacity-info${suffix}`}
              />
            }
          />
          <div className="flex items-center gap-1.5">
            <Label htmlFor={`fit-text-shadow${suffix}`} className="text-xs opacity-70">
              {t("crop.fit.text.shadow")}
            </Label>
            <InfoHint
              term={t("crop.fit.info.shadow.term")}
              text={t("crop.fit.info.shadow.text")}
              testId={`fit-text-shadow-info${suffix}`}
            />
            <Switch
              id={`fit-text-shadow${suffix}`}
              checked={layer.shadow}
              disabled={disabled}
              onCheckedChange={(shadow) => set({ shadow })}
              className="ml-auto"
              data-testid={`fit-text-shadow${suffix}`}
            />
          </div>
        </div>
      </details>
      <p className="text-[11px] leading-snug opacity-70">{t("crop.fit.text.stageHint")}</p>
    </div>
  );
}

function PictureSettings({
  layer,
  fit,
  disabled,
  suffix,
}: {
  layer: PictureLayer;
  fit: ReturnType<typeof useEditorFit>;
  disabled: boolean;
  suffix: string;
}) {
  const { t } = useTranslation();
  const canvas = fit.output ?? { width: 1, height: 1 };
  const reset = () => {
    // Straight, with the picture's own shape at the current width.
    const height = (layer.width * canvas.width * layer.picture.height) / layer.picture.width / canvas.height;
    fit.updateLayer(layer.id, { rotation: 0, height } as Partial<FitLayer>);
  };
  return (
    <div className="space-y-3 rounded-md border p-2.5" data-testid={`fit-picture-controls${suffix}`}>
      <PercentSlider
        id={`fit-picture-opacity${suffix}`}
        label={t("crop.fit.text.opacity")}
        value={layer.opacity}
        disabled={disabled}
        onChange={(opacity) => fit.updateLayer(layer.id, { opacity: Math.max(0.05, opacity) } as Partial<FitLayer>)}
        testId="fit-picture-opacity"
        suffix={suffix}
      />
      <AngleRow
        id={`fit-picture-rotation${suffix}`}
        value={layer.rotation}
        disabled={disabled}
        onChange={(rotation) => fit.updateLayer(layer.id, { rotation } as Partial<FitLayer>, `rotate:${layer.id}`)}
        testId="fit-picture-rotation"
        suffix={suffix}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 w-full gap-1.5 text-xs"
        disabled={disabled}
        onClick={reset}
        data-testid={`fit-picture-reset${suffix}`}
      >
        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
        {t("crop.fit.layers.resetShape")}
      </Button>
      <p className="text-[11px] leading-snug opacity-70">{t("crop.fit.layers.pictureHint")}</p>
    </div>
  );
}

const modKey = () =>
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";
