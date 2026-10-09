"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { previewFit, type CropConfig } from "@/lib/crop";
import {
  DEFAULT_FIT_SETTINGS,
  FIT_PRESETS,
  resolveFitSize,
  type FitOutput,
  type FitSettings,
} from "@/lib/fitToSize";
import type { Rect } from "./cropConstants";

const previewKey = (fit: FitOutput, crop: Rect) =>
  JSON.stringify([
    fit.width,
    fit.height,
    fit.mode,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
  ]);

export function useEditorFit({
  imgUrl,
  crop,
  initialCrop,
  onSelection,
  onApplyToAll,
}: {
  imgUrl: string | null;
  crop: Rect | null;
  initialCrop: CropConfig | null;
  onSelection: (crop: Rect) => void;
  onApplyToAll?: (fit: FitOutput, signal: AbortSignal) => Promise<void>;
}) {
  const [settings, setSettings] = useState<FitSettings>(() => {
    const fit = initialCrop?.fit;
    if (!fit) return DEFAULT_FIT_SETTINGS;
    const preset = Object.entries(FIT_PRESETS).find(
      ([, size]) => size.width === fit.width && size.height === fit.height,
    )?.[0] as FitSettings["preset"] | undefined;
    return {
      ...DEFAULT_FIT_SETTINGS,
      preset: preset ?? "custom",
      customWidth: String(fit.width),
      customHeight: String(fit.height),
      mode: fit.mode,
    };
  });
  const [applied, setApplied] = useState<FitOutput | null>(
    initialCrop?.fit ?? null,
  );
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const lastPreviewKey = useRef<string | null>(null);
  const actionController = useRef<AbortController | null>(null);
  const size = resolveFitSize(settings);
  const pending =
    !!applied &&
    (!size ||
      size.width !== applied.width ||
      size.height !== applied.height ||
      settings.mode !== applied.mode);
  const previewCurrent =
    !!applied &&
    !!crop &&
    !!preview &&
    lastPreviewKey.current === previewKey(applied, crop);

  useEffect(() => () => actionController.current?.abort(), []);

  useEffect(() => {
    if (!imgUrl || !applied || !crop) return;
    const key = previewKey(applied, crop);
    if (lastPreviewKey.current === key) return;
    const controller = new AbortController();
    setLoadingPreview(true);
    setError(null);
    const timer = window.setTimeout(() => {
      previewFit(imgUrl, applied, crop, controller.signal)
        .then((result) => {
          if (controller.signal.aborted) return;
          lastPreviewKey.current = key;
          setPreview(result.preview);
          setLoadingPreview(false);
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          setError(err instanceof Error ? err.message : String(err));
          setLoadingPreview(false);
        });
    }, 200);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [imgUrl, applied, crop]);

  const autoFit = async () => {
    if (!imgUrl || !size) return;
    actionController.current?.abort();
    const controller = new AbortController();
    actionController.current = controller;
    setWorking(true);
    setError(null);
    const fit = { ...size, mode: settings.mode };
    try {
      const result = await previewFit(
        imgUrl,
        fit,
        undefined,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      lastPreviewKey.current = previewKey(fit, result.crop);
      setApplied(fit);
      onSelection(result.crop);
      setPreview(result.preview);
      setLoadingPreview(false);
    } catch (err) {
      if (!controller.signal.aborted)
        setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (!controller.signal.aborted) setWorking(false);
    }
  };

  const applyToAll = async () => {
    if (!applied || !onApplyToAll) return;
    const controller = new AbortController();
    actionController.current = controller;
    setWorking(true);
    setError(null);
    try {
      await onApplyToAll(applied, controller.signal);
    } catch (err) {
      if (!controller.signal.aborted)
        setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (!controller.signal.aborted) setWorking(false);
    }
  };

  const clear = useCallback(() => {
    actionController.current?.abort();
    setWorking(false);
    setApplied(null);
    setPreview(null);
    setError(null);
    setLoadingPreview(false);
    lastPreviewKey.current = null;
  }, []);

  return {
    settings,
    setSettings,
    applied,
    preview,
    error,
    working,
    loadingPreview,
    size,
    pending,
    previewCurrent,
    autoFit,
    applyToAll,
    clear,
  };
}
