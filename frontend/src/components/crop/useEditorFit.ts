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
  active,
}: {
  imgUrl: string | null;
  crop: Rect | null;
  initialCrop: CropConfig | null;
  onSelection: (crop: Rect) => void;
  onApplyToAll?: (fit: FitOutput, signal: AbortSignal) => Promise<void>;
  active: boolean;
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
  const [automaticCrop, setAutomaticCrop] = useState<Rect | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [batchWorking, setBatchWorking] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const lastPreviewKey = useRef<string | null>(null);
  const actionController = useRef<AbortController | null>(null);
  const size = resolveFitSize(settings);
  const targetWidth = size?.width;
  const targetHeight = size?.height;
  const appliedRef = useRef(applied);
  appliedRef.current = applied;
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
  const canRefit =
    !!applied &&
    applied.mode === "crop" &&
    !!crop &&
    (!automaticCrop ||
      previewKey(applied, crop) !== previewKey(applied, automaticCrop));

  useEffect(() => () => actionController.current?.abort(), []);

  useEffect(() => {
    if (!active || !imgUrl || !applied || !crop || pending || working) {
      setLoadingPreview(false);
      return;
    }
    const key = previewKey(applied, crop);
    if (lastPreviewKey.current === key) {
      setLoadingPreview(false);
      return;
    }
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
  }, [active, imgUrl, applied, crop, pending, working, retryCount]);

  const autoFit = useCallback(async () => {
    if (!active || !imgUrl || !targetWidth || !targetHeight) return;
    actionController.current?.abort();
    const controller = new AbortController();
    actionController.current = controller;
    setWorking(true);
    setError(null);
    const fit = {
      width: targetWidth,
      height: targetHeight,
      mode: settings.mode,
    };
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
      setAutomaticCrop(result.crop);
      onSelection(result.crop);
      setPreview(result.preview);
      setLoadingPreview(false);
    } catch (err) {
      if (!controller.signal.aborted)
        setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (actionController.current === controller) setWorking(false);
    }
  }, [active, imgUrl, targetWidth, targetHeight, settings.mode, onSelection]);

  // Selecting the Fit tab or changing a target produces the preview. Reopening
  // a saved fit keeps its explicit selection instead of finding a new crop.
  useEffect(() => {
    const current = appliedRef.current;
    if (
      active &&
      imgUrl &&
      targetWidth &&
      targetHeight &&
      (!current ||
        current.width !== targetWidth ||
        current.height !== targetHeight ||
        current.mode !== settings.mode)
    ) {
      const timer = window.setTimeout(() => void autoFit(), 250);
      return () => {
        window.clearTimeout(timer);
        actionController.current?.abort();
        setWorking(false);
      };
    }
    if (!active || !targetWidth || !targetHeight) {
      actionController.current?.abort();
      setWorking(false);
    }
  }, [active, imgUrl, targetWidth, targetHeight, settings.mode, autoFit]);

  const retryPreview = () => {
    if (!applied || pending) {
      void autoFit();
      return;
    }
    setError(null);
    lastPreviewKey.current = null;
    setRetryCount((value) => value + 1);
  };

  const applyToAll = async () => {
    if (!applied || !onApplyToAll) return;
    const controller = new AbortController();
    actionController.current = controller;
    setWorking(true);
    setBatchWorking(true);
    setError(null);
    try {
      await onApplyToAll(applied, controller.signal);
    } catch (err) {
      if (!controller.signal.aborted)
        setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (actionController.current === controller) {
        setWorking(false);
        setBatchWorking(false);
      }
    }
  };

  return {
    settings,
    setSettings,
    applied,
    preview,
    error,
    working,
    batchWorking,
    loadingPreview,
    size,
    pending,
    previewCurrent,
    canRefit,
    autoFit,
    retryPreview,
    applyToAll,
  };
}
