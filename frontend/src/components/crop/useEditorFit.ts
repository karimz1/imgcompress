"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type SetStateAction,
} from "react";
import { previewFit, type CropConfig } from "@/lib/crop";
import { uploadEditorPicture } from "@/lib/editorAssets";
import { maxUploadBytes } from "@/lib/uploadLimit";
import {
  clampBackgroundPlacement,
  clampLayer,
  clampPlacement,
  DEFAULT_FIT_SETTINGS,
  DEFAULT_TEXT,
  FIT_PRESETS,
  layerVisible,
  MAX_IMAGE_LAYERS,
  MAX_TEXT_LAYERS,
  newLayerId,
  pictureLayerFor,
  placementFor,
  placementSupported,
  resolveFitBackground,
  resolveFitSize,
  sameBackground,
  TEXT_STYLES,
  type EditorPicture,
  type FitBackground,
  type FitBackgroundImage,
  type FitLayer,
  type FitOutput,
  type FitPlacement,
  type FitSettings,
  type TextLayer,
  type TextStyleId,
} from "@/lib/fitToSize";
import type { Rect } from "./cropConstants";

/** What the stage has selected: the image, the background picture or a layer id. */
export type StageSelection = "image" | "background" | string | null;


/** A change of the same kind within this time is one undo step (a drag, a slider). */
const MERGE_MS = 600;
const MAX_HISTORY = 100;

interface Snapshot {
  settings: FitSettings;
  placement: FitPlacement | null;
  backgroundPlacement: FitPlacement | null;
  backgroundImage: FitBackgroundImage | null;
  layers: FitLayer[];
}

const layerKey = (layer: FitLayer) =>
  layer.kind === "image"
    ? [layer.picture.id, layer.x, layer.y, layer.width, layer.height, layer.rotation, layer.opacity]
    : [layer.text, layer.font_id, layer.size, layer.color, layer.bold, layer.italic, layer.opacity,
       layer.x, layer.y, layer.shadow, layer.align, layer.rotation ?? 0];

const previewKey = (fit: FitOutput, crop: Rect) =>
  JSON.stringify([
    fit.width,
    fit.height,
    fit.mode,
    fit.color ?? "",
    fit.placement
      ? [fit.placement.scale, fit.placement.x, fit.placement.y, fit.placement.rotation ?? 0]
      : null,
    fit.background
      ? [
          fit.background.pattern,
          fit.background.dim,
          fit.background.image?.id ?? null,
          fit.background.blur ?? null,
          fit.background.tint ?? null,
          fit.background.colorTo ?? null,
          fit.background.gradientAngle ?? null,
          fit.background.imagePlacement ?? null,
        ]
      : null,
    (fit.layers ?? []).filter(layerVisible).map(layerKey),
    crop.x,
    crop.y,
    crop.width,
    crop.height,
  ]);

/** The background picture's placement lives in its own state, like the image's. */
const withoutLayer = (background: FitBackground): FitBackground => {
  const { imagePlacement: _layer, ...rest } = background;
  return rest;
};

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
  const [settings, setSettingsState] = useState<FitSettings>(() => {
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
      blur: fit.background?.blur ?? DEFAULT_FIT_SETTINGS.blur,
      tint: fit.background?.tint?.opacity ?? DEFAULT_FIT_SETTINGS.tint,
      tintColor: fit.background?.tint?.color ?? DEFAULT_FIT_SETTINGS.tintColor,
      fillGradient: !!fit.background?.colorTo,
      colorTo: fit.background?.colorTo ?? DEFAULT_FIT_SETTINGS.colorTo,
      gradientAngle: fit.background?.gradientAngle ?? DEFAULT_FIT_SETTINGS.gradientAngle,
      tintGradient: !!fit.background?.tint?.colorTo,
      tintColorTo: fit.background?.tint?.colorTo ?? DEFAULT_FIT_SETTINGS.tintColorTo,
      tintAngle: fit.background?.tint?.angle ?? DEFAULT_FIT_SETTINGS.tintAngle,
    };
  });
  // Kept when switching modes, so going back to "image" does not ask again.
  const [backgroundImage, setBackgroundImageState] = useState<FitBackgroundImage | null>(
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
          ...(fit.background ? { background: withoutLayer(fit.background) } : {}),
        }
      : null;
  });
  const [placement, setPlacementState] = useState<FitPlacement | null>(
    initialCrop?.fit?.placement ?? null,
  );
  // The background picture's own move, zoom and turn ("image" mode only).
  const [backgroundPlacement, setBackgroundPlacementState] = useState<FitPlacement | null>(
    initialCrop?.fit?.background?.imagePlacement ?? null,
  );
  // Object URLs made here; freed when the editor closes. A saved fit keeps the
  // files, so reopening makes new URLs for them.
  const objectUrls = useRef<string[]>([]);
  const urlFor = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    objectUrls.current.push(url);
    return url;
  }, []);
  useEffect(() => () => objectUrls.current.forEach((url) => URL.revokeObjectURL(url)), []);
  // Texts are kept while being typed, even when still empty.
  const [layers, setLayersState] = useState<FitLayer[]>(() => {
    const pictures = new Map<string, EditorPicture>();
    return (initialCrop?.fit?.layers ?? []).map((layer) => {
      if (layer.kind !== "image") return layer;
      const known = pictures.get(layer.picture.id);
      const picture = known ?? { ...layer.picture, url: urlFor(layer.picture.file) };
      pictures.set(picture.id, picture);
      return { ...layer, picture };
    });
  });
  const [selected, setSelected] = useState<StageSelection>(null);
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
    () =>
      resolveFitBackground(settings.mode, settings.pattern, settings.dim, backgroundImage, {
        blur: settings.blur,
        tint: settings.tint,
        tintColor: settings.tintColor,
        colorTo: settings.fillGradient ? settings.colorTo : null,
        gradientAngle: settings.gradientAngle,
        tintColorTo: settings.tintGradient ? settings.tintColorTo : null,
        tintAngle: settings.tintAngle,
      }),
    [
      settings.mode,
      settings.pattern,
      settings.dim,
      backgroundImage,
      settings.blur,
      settings.tint,
      settings.tintColor,
      settings.fillGradient,
      settings.colorTo,
      settings.gradientAngle,
      settings.tintGradient,
      settings.tintColorTo,
      settings.tintAngle,
    ],
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
  const snapshot: Snapshot = { settings, placement, backgroundPlacement, backgroundImage, layers };
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  const history = useRef({
    past: [] as Snapshot[],
    future: [] as Snapshot[],
    kind: null as string | null,
    at: 0,
  });
  const [, setHistoryVersion] = useState(0);
  /** Remembers the state before a change; repeated changes of one kind merge. */
  const record = useCallback((kind: string) => {
    const h = history.current;
    const now = Date.now();
    const merge = h.kind === kind && now - h.at < MERGE_MS;
    h.kind = kind;
    h.at = now;
    if (merge) return;
    h.past.push(snapshotRef.current);
    if (h.past.length > MAX_HISTORY) h.past.shift();
    h.future = [];
    setHistoryVersion((value) => value + 1);
  }, []);
  const restore = useCallback((next: Snapshot) => {
    setSettingsState(next.settings);
    setPlacementState(next.placement);
    setBackgroundPlacementState(next.backgroundPlacement);
    setBackgroundImageState(next.backgroundImage);
    setLayersState(next.layers);
    setSelected((current) =>
      current && current !== "image" && current !== "background" &&
      !next.layers.some((layer) => layer.id === current)
        ? null
        : current,
    );
  }, []);
  const undo = useCallback(() => {
    const h = history.current;
    const previous = h.past.pop();
    if (!previous) return;
    h.future.push(snapshotRef.current);
    h.kind = null;
    restore(previous);
    setHistoryVersion((value) => value + 1);
  }, [restore]);
  const redo = useCallback(() => {
    const h = history.current;
    const next = h.future.pop();
    if (!next) return;
    h.past.push(snapshotRef.current);
    h.kind = null;
    restore(next);
    setHistoryVersion((value) => value + 1);
  }, [restore]);
  const setSettings = useCallback(
    (next: SetStateAction<FitSettings>) => {
      record("settings");
      setSettingsState(next);
    },
    [record],
  );
  const setBackgroundImage = useCallback(
    (next: FitBackgroundImage | null) => {
      record("background-image");
      setBackgroundImageState(next);
    },
    [record],
  );
  const desiredRef = useRef(desired);
  desiredRef.current = desired;
  const placementRef = useRef(placement);
  placementRef.current = placement;
  const layersRef = useRef({ backgroundPlacement, layers });
  layersRef.current = { backgroundPlacement, layers };

  const output = useMemo<FitOutput | null>(() => {
    if (!applied) return null;
    let next: FitOutput = applied;
    const placed = placementFor(applied.mode, placement);
    if (placed) next = { ...next, placement: placed };
    if (backgroundPlacement && applied.mode === "image" && applied.background?.image) {
      next = { ...next, background: { ...applied.background, imagePlacement: backgroundPlacement } };
    }
    if (layers.length) next = { ...next, layers };
    return next;
  }, [applied, placement, backgroundPlacement, layers]);
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
      const current = placementFor(target.mode, placementRef.current);
      const layers = layersRef.current;
      let request: FitOutput = current ? { ...target, placement: current } : target;
      if (layers.backgroundPlacement && target.mode === "image" && target.background?.image) {
        request = {
          ...request,
          background: { ...target.background, imagePlacement: layers.backgroundPlacement },
        };
      }
      if (layers.layers.length) request = { ...request, layers: layers.layers };
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

  const setPlacement = useCallback(
    (next: FitPlacement | null) => {
      record("placement");
      setPlacementState(next ? clampPlacement(next) : null);
    },
    [record],
  );
  const setBackgroundPlacement = useCallback(
    (next: FitPlacement | null) => {
      record("background-placement");
      setBackgroundPlacementState(next ? clampBackgroundPlacement(next) : null);
    },
    [record],
  );

  // Layers: bottom first, like the export draws them.
  const commitLayers = useCallback(
    (kind: string, change: (layers: FitLayer[]) => FitLayer[]) => {
      record(kind);
      setLayersState((current) => change(current));
    },
    [record],
  );
  const updateLayer = useCallback(
    (id: string, patch: Partial<TextLayer> | Partial<FitLayer>, kind?: string) =>
      commitLayers(kind ?? `layer:${id}`, (current) =>
        current.map((layer) =>
          layer.id === id ? clampLayer({ ...layer, ...patch } as FitLayer) : layer,
        ),
      ),
    [commitLayers],
  );
  const textCount = layers.filter((layer) => layer.kind === "text").length;
  const pictureCount = layers.length - textCount;
  const canAddText = textCount < MAX_TEXT_LAYERS;
  const canAddPicture = pictureCount < MAX_IMAGE_LAYERS;
  const addText = useCallback(
    (style: TextStyleId, text: string) => {
      if (!canAddText) return null;
      const layer: TextLayer = {
        ...DEFAULT_TEXT,
        ...TEXT_STYLES[style],
        text,
        kind: "text",
        id: newLayerId("text"),
      };
      commitLayers("add", (current) => [...current, layer]);
      setSelected(layer.id);
      return layer.id;
    },
    [canAddText, commitLayers],
  );
  /** Uploads the picture first, so a broken file fails here and not in the preview. */
  const addPicture = useCallback(
    async (file: File) => {
      if (!canAddPicture) return null;
      if (file.size > maxUploadBytes()) throw new Error("too-large");
      const { width, height } = await uploadEditorPicture(file);
      const canvas = desiredRef.current ?? { width: 1, height: 1 };
      const picture: EditorPicture = {
        id: newLayerId("image"),
        file,
        name: file.name,
        url: urlFor(file),
        width,
        height,
      };
      const offset = (layersRef.current.layers.length % 4) * 0.03;
      const layer = pictureLayerFor(picture, canvas, offset);
      commitLayers("add", (current) => [...current, layer]);
      setSelected(layer.id);
      return layer.id;
    },
    [canAddPicture, commitLayers, urlFor],
  );
  const removeLayer = useCallback(
    (id: string) => {
      commitLayers("remove", (current) => current.filter((layer) => layer.id !== id));
      setSelected((current) => (current === id ? null : current));
    },
    [commitLayers],
  );
  const duplicateLayer = useCallback(
    (id: string) => {
      const source = layersRef.current.layers.find((layer) => layer.id === id);
      if (!source) return null;
      const full = source.kind === "text" ? !canAddText : !canAddPicture;
      if (full) return null;
      const copy = clampLayer({
        ...source,
        id: newLayerId(source.kind),
        x: source.x + 0.02,
        y: source.y + 0.02,
        hidden: false,
      } as FitLayer);
      commitLayers("duplicate", (current) => {
        const index = current.findIndex((layer) => layer.id === id);
        return [...current.slice(0, index + 1), copy, ...current.slice(index + 1)];
      });
      setSelected(copy.id);
      return copy.id;
    },
    [canAddPicture, canAddText, commitLayers],
  );
  /** ``step`` 1 brings the layer forward (drawn later), -1 sends it back. */
  const moveLayer = useCallback(
    (id: string, step: 1 | -1) =>
      commitLayers("order", (current) => {
        const index = current.findIndex((layer) => layer.id === id);
        const target = index + step;
        if (index < 0 || target < 0 || target >= current.length) return current;
        const next = [...current];
        [next[index], next[target]] = [next[target], next[index]];
        return next;
      }),
    [commitLayers],
  );
  const toggleLayer = useCallback(
    (id: string) =>
      commitLayers("visibility", (current) =>
        current.map((layer) => (layer.id === id ? { ...layer, hidden: !layer.hidden } : layer)),
      ),
    [commitLayers],
  );

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
    backgroundPlacement,
    setBackgroundPlacement,
    layers,
    updateLayer,
    addText,
    addPicture,
    removeLayer,
    duplicateLayer,
    moveLayer,
    toggleLayer,
    canAddText,
    canAddPicture,
    selected,
    setSelected,
    undo,
    redo,
    canUndo: history.current.past.length > 0,
    canRedo: history.current.future.length > 0,
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
