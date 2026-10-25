"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { previewFit, type CropConfig } from "@/lib/crop";
import {
  clampPlacement,
  DEFAULT_FIT_SETTINGS,
  FIT_PRESETS,
  placementSupported,
  resolveFitBackground,
  resolveFitSize,
  sameBackground,
  type FitBackgroundImage,
  type FitOutput,
  type FitPlacement,
  type FitSettings,
} from "@/lib/fitToSize";
import type { Rect } from "./cropConstants";

const previewKey = (fit: FitOutput, crop: Rect) =>
  JSON.stringify([
    fit.width,
    fit.height,
    fit.mode,
    fit.color ?? "",
    fit.placement ? [fit.placement.scale, fit.placement.x, fit.placement.y] : null,
    fit.background
      ? [fit.background.pattern, fit.background.dim, fit.background.image?.id ?? null]
      : null,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
  ]);

/** Size and mode decide the selection; colour and placement only repaint it. */
const sameLayout = (a: FitOutput, b: FitOutput) =>
  a.width === b.width && a.height === b.height && a.mode === b.mode;

const fitColor = (settings: FitSettings) =>
  settings.mode === "solid"
    ? settings.color
    : settings.mode === "transparent"
      ? "transparent"
      : undefined;

export function useEditorFit({
  file,
  imgUrl,
  crop,
  initialCrop,
  onSelection,
  onApplyToAll,
  active,
}: {
  file: File;
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
      color:
        fit.mode === "solid" && fit.color
          ? fit.color
          : DEFAULT_FIT_SETTINGS.color,
      pattern: fit.background?.pattern ?? DEFAULT_FIT_SETTINGS.pattern,
      dim: fit.background?.dim ?? DEFAULT_FIT_SETTINGS.dim,
    };
  });
  // Kept when switching modes, so going back to "image" does not ask again.
  const [backgroundImage, setBackgroundImage] = useState<FitBackgroundImage | null>(
    initialCrop?.fit?.background?.image ?? null,
  );
  const [applied, setApplied] = useState<FitOutput | null>(() => {
    const fit = initialCrop?.fit;
    return fit
      ? {
          width: fit.width,
          height: fit.height,
          mode: fit.mode,
          color: fit.color,
          ...(fit.background ? { background: fit.background } : {}),
        }
      : null;
  });
  const [placement, setPlacementState] = useState<FitPlacement | null>(
    initialCrop?.fit?.placement ?? null,
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
  // Latest request wins: every preview request gets a new id, the previous one
  // is aborted, and a response whose id is no longer current is ignored.
  const previewRequest = useRef(0);
  const previewController = useRef<AbortController | null>(null);
  const size = resolveFitSize(settings);
  const targetWidth = size?.width;
  const targetHeight = size?.height;
  const color = fitColor(settings);
  const background = useMemo(
    () => resolveFitBackground(settings.mode, settings.pattern, settings.dim, backgroundImage),
    [settings.mode, settings.pattern, settings.dim, backgroundImage],
  );
  const desired = useMemo<FitOutput | null>(
    () =>
      targetWidth && targetHeight
        ? {
            width: targetWidth,
            height: targetHeight,
            mode: settings.mode,
            color,
            ...(background ? { background } : {}),
          }
        : null,
    [targetWidth, targetHeight, settings.mode, color, background],
  );
  const desiredRef = useRef(desired);
  desiredRef.current = desired;
  const placementRef = useRef(placement);
  placementRef.current = placement;

  const output = useMemo<FitOutput | null>(
    () =>
      applied
        ? placement && placementSupported(applied.mode)
          ? { ...applied, placement }
          : applied
        : null,
    [applied, placement],
  );
  const pending = !!applied && (!desired || !sameLayout(desired, applied));
  // Image mode without a picture yet: the selection can be found, but there is
  // nothing to render until one is chosen.
  const needsBackground = !!output && output.mode === "image" && !output.background?.image;
  const previewCurrent =
    !!output &&
    !!crop &&
    !!preview &&
    lastPreviewKey.current === previewKey(output, crop);
  const canRefit =
    !!output &&
    output.mode === "crop" &&
    !!crop &&
    (!automaticCrop ||
      previewKey(output, crop) !== previewKey(output, automaticCrop));

  useEffect(
    () => () => {
      actionController.current?.abort();
      previewController.current?.abort();
    },
    [],
  );

  // A new colour or background keeps the size, mode and selection, so it only
  // needs a new preview, not another automatic fit.
  useEffect(() => {
    if (!applied || !desired || !sameLayout(applied, desired)) return;
    if (
      (applied.color ?? undefined) !== desired.color ||
      !sameBackground(applied.background, desired.background)
    ) {
      setApplied({
        ...applied,
        color: desired.color,
        background: desired.background,
      });
    }
  }, [applied, desired]);

  useEffect(() => {
    if (!active || !imgUrl || !output || !crop || pending || working || needsBackground) {
      setLoadingPreview(false);
      return;
    }
    const key = previewKey(output, crop);
    if (lastPreviewKey.current === key) {
      setLoadingPreview(false);
      return;
    }
    setLoadingPreview(true);
    setError(null);
    const timer = window.setTimeout(() => {
      previewController.current?.abort();
      const controller = new AbortController();
      previewController.current = controller;
      const id = ++previewRequest.current;
      const isLatest = () =>
        !controller.signal.aborted && id === previewRequest.current;
      previewFit(imgUrl, output, crop, controller.signal, file)
        .then((result) => {
          if (!isLatest()) return;
          lastPreviewKey.current = key;
          setPreview(result.preview);
          setLoadingPreview(false);
        })
        .catch((err: unknown) => {
          if (!isLatest()) return;
          setError(err instanceof Error ? err.message : String(err));
          setLoadingPreview(false);
        });
    }, 200);
    return () => {
      window.clearTimeout(timer);
      previewController.current?.abort();
    };
  }, [active, imgUrl, output, crop, pending, working, needsBackground, retryCount, file]);

  const autoFit = useCallback(async () => {
    // Read the target at call time so a delayed call never sends stale settings.
    const target = desiredRef.current;
    if (!active || !imgUrl || !target) return;
    actionController.current?.abort();
    previewController.current?.abort();
    const controller = new AbortController();
    actionController.current = controller;
    const id = ++previewRequest.current;
    setWorking(true);
    setError(null);
    try {
      const current = placementSupported(target.mode) ? placementRef.current : null;
      const request = current ? { ...target, placement: current } : target;
      const result = await previewFit(
        imgUrl,
        request,
        undefined,
        controller.signal,
        file,
        !(target.mode === "image" && !target.background?.image),
      );
      if (controller.signal.aborted || id !== previewRequest.current) return;
      lastPreviewKey.current = previewKey(request, result.crop);
      setApplied(target);
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
  }, [active, imgUrl, onSelection, file]);

  // Selecting the Fit tab or changing the size or mode produces the preview.
  // Reopening a saved fit keeps its explicit selection instead of finding a new crop.
  const layoutChanged =
    !!desired && (!applied || !sameLayout(applied, desired));
  useEffect(() => {
    if (active && imgUrl && layoutChanged) {
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
  }, [active, imgUrl, layoutChanged, targetWidth, targetHeight, settings.mode, autoFit]);

  const setPlacement = useCallback((next: FitPlacement | null) => {
    setPlacementState(next ? clampPlacement(next) : null);
  }, []);

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
    if (!output || !onApplyToAll) return;
    const controller = new AbortController();
    actionController.current = controller;
    setWorking(true);
    setBatchWorking(true);
    setError(null);
    try {
      await onApplyToAll(output, controller.signal);
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
    output,
    placement,
    setPlacement,
    backgroundImage,
    setBackgroundImage,
    needsBackground,
    placementEnabled: !!output && placementSupported(output.mode) && !pending,
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
