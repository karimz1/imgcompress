"use client";

import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { previewTileBox } from "@/lib/upscalePreview";
import { upscaleModelParam, type UpscaleDenoise } from "@/lib/upscale";

interface Props {
  file: File | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  denoise: UpscaleDenoise;
  onDenoiseChange: (denoise: UpscaleDenoise) => void;
  levels: readonly UpscaleDenoise[];
}

type TileState =
  | { status: "idle" | "loading" | "busy" }
  | { status: "ready"; before: string; after: string; model: string }
  | { status: "error"; message: string };

const STEP = 16;

/**
 * Upscales only a small region with the chosen image type, like a render region.
 * The latest request wins: older ones are aborted and late answers are ignored.
 */
export function UpscalePreviewDialog({ file, open, onOpenChange, denoise, onDenoiseChange, levels }: Props) {
  const { t } = useTranslation();
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [decodeFailed, setDecodeFailed] = useState(false);
  const [center, setCenter] = useState<{ x: number; y: number } | null>(null);
  const [tile, setTile] = useState<TileState>({ status: "idle" });
  const [split, setSplit] = useState(50);
  const frameRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef(0);

  useEffect(() => {
    if (!open || !file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setCenter({ x: img.naturalWidth / 2, y: img.naturalHeight / 2 });
    };
    img.onerror = () => setDecodeFailed(true);
    img.src = url;
    return () => {
      URL.revokeObjectURL(url);
      setImage(null);
      setDecodeFailed(false);
      setTile({ status: "idle" });
    };
  }, [open, file]);

  useEffect(() => {
    if (!image || !center) return;
    const id = ++requestRef.current;
    const controller = new AbortController();
    const urls: string[] = [];
    let retry: ReturnType<typeof setTimeout> | undefined;

    const run = async () => {
      const box = previewTileBox(image.naturalWidth, image.naturalHeight, center.x, center.y);
      const canvas = document.createElement("canvas");
      canvas.width = box.width;
      canvas.height = box.height;
      canvas.getContext("2d")!.drawImage(image, box.x, box.y, box.width, box.height, 0, 0, box.width, box.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob || id !== requestRef.current) return;
      const before = document.createElement("canvas");
      before.width = box.inner.width;
      before.height = box.inner.height;
      before.getContext("2d")!.drawImage(canvas, -box.inner.x, -box.inner.y);

      const form = new FormData();
      form.append("file", blob, "preview.png");
      const model = upscaleModelParam({ model: "general", denoise });
      form.append("upscale_model", model);
      form.append("inner", [box.inner.x, box.inner.y, box.inner.width, box.inner.height].join(","));
      setTile((previous) => (previous.status === "ready" ? previous : { status: "loading" }));
      const response = await fetch("/api/upscale/preview", { method: "POST", body: form, signal: controller.signal });
      if (id !== requestRef.current) return;
      if (response.status === 503) {
        setTile({ status: "busy" });
        const seconds = Number(response.headers.get("Retry-After")) || 2;
        retry = setTimeout(() => void run().catch(() => undefined), seconds * 1000);
        return;
      }
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setTile({ status: "error", message: body.error || t("form.upscale.livePreview.failed") });
        return;
      }
      const after = URL.createObjectURL(await response.blob());
      urls.push(after);
      if (id !== requestRef.current) return;
      setTile({ status: "ready", before: before.toDataURL("image/png"), after, model });
    };
    // A short pause so dragging sends one request, not one per pixel.
    const timer = setTimeout(() => void run().catch(() => undefined), 150);
    return () => {
      clearTimeout(timer);
      clearTimeout(retry);
      controller.abort();
      // Keep the shown tile's URL until the next one replaces it.
      setTimeout(() => urls.forEach((url) => URL.revokeObjectURL(url)), 30_000);
    };
  }, [image, center, denoise, t]);

  const moveTo = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!image || !frameRef.current || (event.type === "pointermove" && event.buttons === 0)) return;
    const rect = frameRef.current.getBoundingClientRect();
    setCenter({
      x: ((event.clientX - rect.left) / rect.width) * image.naturalWidth,
      y: ((event.clientY - rect.top) / rect.height) * image.naturalHeight,
    });
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const delta = { ArrowLeft: [-STEP, 0], ArrowRight: [STEP, 0], ArrowUp: [0, -STEP], ArrowDown: [0, STEP] }[event.key];
    if (!delta || !center || !image) return;
    event.preventDefault();
    const box = previewTileBox(image.naturalWidth, image.naturalHeight, center.x + delta[0], center.y + delta[1]);
    setCenter({ x: box.x + box.inner.x + box.inner.width / 2, y: box.y + box.inner.y + box.inner.height / 2 });
  };

  const region = image && center ? previewTileBox(image.naturalWidth, image.naturalHeight, center.x, center.y) : null;
  const pct = (value: number, total: number) => `${(value / total) * 100}%`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[100dvh] w-[min(100vw,36rem)] max-w-none flex-col gap-2 overflow-hidden p-3 sm:p-4"
        data-testid="upscale-preview-dialog"
      >
        <DialogTitle className="text-base">{t("form.upscale.livePreview.title")}</DialogTitle>
        <DialogDescription className="text-xs">{t("form.upscale.livePreview.description")}</DialogDescription>
        {decodeFailed && (
          <p className="text-sm" data-testid="upscale-preview-unsupported">{t("form.upscale.livePreview.unsupported")}</p>
        )}
        {image && region && (
          <>
            <div className="flex min-h-0 justify-center">
              <div
                ref={frameRef}
                role="slider"
                tabIndex={0}
                aria-label={t("form.upscale.livePreview.region")}
                aria-valuetext={`${Math.round(region.x + region.inner.x)}, ${Math.round(region.y + region.inner.y)}`}
                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture(event.pointerId);
                  moveTo(event);
                }}
                onPointerMove={moveTo}
                onKeyDown={onKeyDown}
                className="relative overflow-hidden touch-none select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                data-testid="upscale-preview-source"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.src} alt="" draggable={false} className="block max-h-[24dvh] max-w-full object-contain" />
                <div
                  className="pointer-events-none absolute border-2 border-blue-500 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
                  style={{
                    left: pct(region.x + region.inner.x, image.naturalWidth),
                    top: pct(region.y + region.inner.y, image.naturalHeight),
                    width: pct(region.inner.width, image.naturalWidth),
                    height: pct(region.inner.height, image.naturalHeight),
                  }}
                  data-testid="upscale-preview-region"
                />
              </div>
            </div>
            <div
              className="relative mx-auto aspect-square w-[min(100%,38dvh)] overflow-hidden rounded-md border bg-black/5"
              data-testid="upscale-preview-tile"
              data-status={tile.status}
              data-model={tile.status === "ready" ? tile.model : undefined}
            >
              {tile.status === "ready" && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={tile.before} alt={t("form.upscale.livePreview.before")} className="absolute inset-0 h-full w-full" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={tile.after}
                    alt={t("form.upscale.livePreview.after")}
                    className="absolute inset-0 h-full w-full"
                    style={{ clipPath: `inset(0 0 0 ${split}%)` }}
                    data-testid="upscale-preview-after"
                  />
                  <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow" style={{ left: `${split}%` }} />
                  <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[10px] text-white">{t("form.upscale.livePreview.before")}</span>
                  <span className="absolute right-1 top-1 rounded bg-black/60 px-1 text-[10px] text-white">{t("form.upscale.livePreview.after")}</span>
                </>
              )}
              {(tile.status === "loading" || tile.status === "busy" || tile.status === "idle") && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-xs">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {tile.status === "busy" && <span data-testid="upscale-preview-busy">{t("form.upscale.livePreview.busy")}</span>}
                </div>
              )}
              {tile.status === "error" && (
                <p className="absolute inset-0 flex items-center justify-center p-3 text-center text-xs" data-testid="upscale-preview-error">
                  {tile.message}
                </p>
              )}
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={split}
              onChange={(event) => setSplit(Number(event.target.value))}
              aria-label={t("form.upscale.livePreview.compare")}
              className="mx-auto w-[min(100%,38dvh)]"
              data-testid="upscale-preview-compare"
            />
            <div role="radiogroup" aria-label={t("form.upscale.denoiseLabel")} className="grid grid-cols-3 gap-1.5">
              {levels.map((level) => (
                <button
                  key={level}
                  type="button"
                  role="radio"
                  aria-checked={denoise === level}
                  onClick={() => onDenoiseChange(level)}
                  className={cn(
                    "rounded-md border px-1.5 py-1 text-xs leading-tight",
                    denoise === level ? "border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/50" : "border-slate-300"
                  )}
                  data-testid={`upscale-preview-option-${level}`}
                >
                  {t(`form.upscale.denoise.${level}`)}
                </button>
              ))}
            </div>
          </>
        )}
        <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} data-testid="upscale-preview-close">
          {t("form.upscale.livePreview.close")}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
