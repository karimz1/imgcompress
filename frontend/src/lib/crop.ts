import type { FitOutput } from "./fitToSize";

export type RatioPresetId = "free" | "1:1" | "16:9" | "4:3";

export interface CropConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  preset: RatioPresetId;
  fit?: FitOutput;
}

export const RATIO_PRESETS: { id: RatioPresetId; label: string; ratio: number | null }[] = [
  { id: "free", label: "Free", ratio: null },
  { id: "1:1", label: "1:1", ratio: 1 },
  { id: "16:9", label: "16:9", ratio: 16 / 9 },
  { id: "4:3", label: "4:3", ratio: 4 / 3 },
];

export function getPresetRatio(preset: RatioPresetId): number | null {
  return RATIO_PRESETS.find((p) => p.id === preset)?.ratio ?? null;
}

export function defaultCropForRatio(
  originalWidth: number,
  originalHeight: number,
  ratio: number | null
): { x: number; y: number; width: number; height: number } {
  if (originalWidth <= 0 || originalHeight <= 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  if (ratio == null) {
    return { x: 0, y: 0, width: originalWidth, height: originalHeight };
  }
  let w = originalWidth;
  let h = w / ratio;
  if (h > originalHeight) {
    h = originalHeight;
    w = h * ratio;
  }
  w = Math.floor(w);
  h = Math.floor(h);
  const x = Math.floor((originalWidth - w) / 2);
  const y = Math.floor((originalHeight - h) / 2);
  return { x, y, width: w, height: h };
}

export function clampCrop(
  rect: { x: number; y: number; width: number; height: number },
  originalWidth: number,
  originalHeight: number
): { x: number; y: number; width: number; height: number } {
  const width = Math.max(1, Math.min(Math.round(rect.width), originalWidth));
  const height = Math.max(1, Math.min(Math.round(rect.height), originalHeight));
  const x = Math.max(0, Math.min(Math.round(rect.x), originalWidth - width));
  const y = Math.max(0, Math.min(Math.round(rect.y), originalHeight - height));
  return { x, y, width, height };
}

export function applyRatio(
  width: number,
  height: number,
  ratio: number | null,
  driver: "width" | "height"
): { width: number; height: number } {
  if (ratio == null) return { width, height };
  if (driver === "width") {
    return { width, height: Math.max(1, Math.round(width / ratio)) };
  }
  return { width: Math.max(1, Math.round(height * ratio)), height };
}

const CROP_BITMAP_MAX_ATTEMPTS = 3;
const CROP_BITMAP_ENDPOINT = "/api/crop/bitmap";

interface LoadImageOptions {
  onFallbackToServer?: () => void;
}

export class CropBitmapError extends Error {
  readonly details: string;
  constructor(message: string, details: string) {
    super(message);
    this.name = "CropBitmapError";
    this.details = details;
  }
}

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => globalThis.setTimeout(resolve, ms));

function logCropBitmap(message: string, detail?: unknown): void {
  if (detail === undefined) {
    console.debug(`[crop] ${message}`);
    return;
  }
  console.debug(`[crop] ${message}`, detail);
}

async function requestCropBitmap(file: File, attempt: number): Promise<Response> {
  const form = new FormData();
  form.append("file", file);
  const startedAt = performance.now();
  logCropBitmap(
    `requesting ${CROP_BITMAP_ENDPOINT} for "${file.name}" (${(file.size / 1024 / 1024).toFixed(1)} MB), attempt ${attempt}/${CROP_BITMAP_MAX_ATTEMPTS}`
  );
  const res = await fetch(CROP_BITMAP_ENDPOINT, { method: "POST", body: form });
  const elapsed = Math.round(performance.now() - startedAt);
  logCropBitmap(
    `${CROP_BITMAP_ENDPOINT} attempt ${attempt}/${CROP_BITMAP_MAX_ATTEMPTS} responded ${res.status} in ${elapsed} ms`
  );
  return res;
}

async function readBitmapError(res: Response): Promise<string> {
  try {
    const text = await res.text();
    try {
      const parsed = JSON.parse(text);
      return parsed.error || parsed.message || text;
    } catch {
      return text;
    }
  } catch {
    return `${res.status}`;
  }
}

function decodeImageElement(img: HTMLImageElement): Promise<void> {
  if (typeof img.decode === "function") {
    return img.decode();
  }
  return new Promise((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to decode image"));
  });
}

export async function isImageDecodable(src: string): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const img = new Image();
  img.src = src;
  try {
    await decodeImageElement(img);
    return true;
  } catch {
    return false;
  }
}

// Formats every browser can decode directly via <img>, so the crop UI can
// preview them client-side without a server round-trip. This is intentionally
// NOT the backend-supported format list (that comes from the backend at
// runtime); anything outside this set falls back to /api/crop/bitmap.
const BROWSER_NATIVE_EXTS = new Set(["png", "jpg", "jpeg"]);

function fileExtensionLower(file: File): string {
  return (file.name.split(".").pop() ?? "").toLowerCase();
}

export function isSvgFile(file: File): boolean {
  return fileExtensionLower(file) === "svg";
}

export function sourceImageSize(image: HTMLImageElement): { width: number; height: number } {
  return {
    width: Number(image.dataset.sourceWidth) || image.naturalWidth,
    height: Number(image.dataset.sourceHeight) || image.naturalHeight,
  };
}

export function isBrowserNativeFormat(file: File): boolean {
  return BROWSER_NATIVE_EXTS.has(fileExtensionLower(file));
}

export async function loadImageFromFile(
  file: File,
  options: LoadImageOptions = {}
): Promise<HTMLImageElement> {
  if (isBrowserNativeFormat(file)) {
    try {
      return await loadImageFromBlob(file);
    } catch {
      logCropBitmap(
        `browser decode failed for "${file.name}"; falling back to ${CROP_BITMAP_ENDPOINT}`
      );
      options.onFallbackToServer?.();
      return loadImageViaBackendBitmap(file);
    }
  }

  return loadImageViaBackendBitmap(file);
}

async function loadImageViaBackendBitmap(file: File): Promise<HTMLImageElement> {
  const attemptLog: string[] = [];
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= CROP_BITMAP_MAX_ATTEMPTS; attempt += 1) {
    try {
      const res = await requestCropBitmap(file, attempt);
      if (!res.ok) {
        const detail = await readBitmapError(res);
        logCropBitmap(
          `${CROP_BITMAP_ENDPOINT} attempt ${attempt}/${CROP_BITMAP_MAX_ATTEMPTS} ${res.status} body:`,
          detail
        );
        attemptLog.push(
          `Attempt ${attempt}: HTTP ${res.status} — ${detail.slice(0, 400) || "(no body)"}`
        );
        lastError =
          res.status === 404
            ? new Error(
                `${CROP_BITMAP_ENDPOINT} is not available. Restart the backend so the new route is registered.`
              )
            : new Error(detail.slice(0, 200) || `Server returned ${res.status}`);
      } else {
        const blob = await res.blob();
        logCropBitmap(
          `crop bitmap received on attempt ${attempt}/${CROP_BITMAP_MAX_ATTEMPTS}: ${(blob.size / 1024 / 1024).toFixed(1)} MB, type=${blob.type}`
        );
        const image = await loadImageFromBlob(blob);
        image.dataset.sourceWidth = res.headers.get("X-Image-Width") || "";
        image.dataset.sourceHeight = res.headers.get("X-Image-Height") || "";
        return image;
      }
    } catch (err) {
      logCropBitmap(
        `server crop bitmap attempt ${attempt}/${CROP_BITMAP_MAX_ATTEMPTS} failed:`,
        err
      );
      const message = err instanceof Error ? err.message : String(err);
      attemptLog.push(`Attempt ${attempt}: ${message || "(network error)"}`);
      lastError = new Error(message || "Server crop bitmap failed.");
    }

    if (attempt < CROP_BITMAP_MAX_ATTEMPTS) {
      await wait(350 * attempt);
    }
  }

  const summary = lastError?.message ? ` Last error: ${lastError.message}` : "";
  throw new CropBitmapError(
    `Could not prepare this file for cropping after ${CROP_BITMAP_MAX_ATTEMPTS} attempts.${summary}`,
    [
      `File: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB, type="${file.type || "unknown"}")`,
      `Endpoint: POST ${CROP_BITMAP_ENDPOINT}`,
      `Attempts: ${CROP_BITMAP_MAX_ATTEMPTS}`,
      "",
      ...attemptLog,
    ].join("\n")
  );
}

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    const rejectAndRevoke = (err: unknown) => {
      URL.revokeObjectURL(url);
      reject(err instanceof Error ? err : new Error("Failed to decode image"));
    };
    img.src = url;
    decodeImageElement(img).then(() => resolve(img)).catch(rejectAndRevoke);
  });
}

export function buildCroppedFilename(name: string, outputMime: string): string {
  const dot = name.lastIndexOf(".");
  const rawBase = dot > 0 ? name.slice(0, dot) : name;
  const base = rawBase.endsWith("_cropped") ? rawBase : `${rawBase}_cropped`;
  const ext = outputMime === "image/svg+xml" ? ".svg" : outputMime === "image/jpeg" ? ".jpg" : ".png";
  return `${base}${ext}`;
}

function fitForm(bitmap: Blob, fit: FitOutput, crop?: Pick<CropConfig, "x" | "y" | "width" | "height">): FormData {
  const form = new FormData();
  form.append("file", bitmap, bitmap instanceof File ? bitmap.name : "editor-bitmap.png");
  form.append("fit_width", String(fit.width));
  form.append("fit_height", String(fit.height));
  form.append("fit_mode", fit.mode);
  if (fit.color) {
    form.append("fit_color", fit.color);
  }
  if (fit.placement && fit.mode !== "crop") {
    form.append("fit_scale", String(fit.placement.scale));
    form.append("fit_x", String(fit.placement.x));
    form.append("fit_y", String(fit.placement.y));
  }
  if (fit.background) {
    if (fit.background.pattern !== "none") form.append("fit_pattern", fit.background.pattern);
    if (fit.background.dim > 0) form.append("fit_dim", String(fit.background.dim));
    // Sent with every request: the server keeps no copy between requests.
    if (fit.background.image && fit.mode === "image") {
      form.append("fit_background", fit.background.image.file, fit.background.image.file.name);
    }
  }
  if (crop) {
    form.append("crop_x", String(crop.x));
    form.append("crop_y", String(crop.y));
    form.append("crop_width", String(crop.width));
    form.append("crop_height", String(crop.height));
  }
  return form;
}

export async function previewFit(
  imageUrl: string,
  fit: FitOutput,
  crop?: Pick<CropConfig, "x" | "y" | "width" | "height">,
  signal?: AbortSignal,
  sourceFile?: File,
  withPreview = true
): Promise<{ crop: CropConfig; preview: string | null }> {
  const bitmap = sourceFile && isSvgFile(sourceFile)
    ? sourceFile
    : await fetch(imageUrl, { signal }).then((response) => response.blob());
  const form = fitForm(bitmap, fit, crop);
  if (!withPreview) form.append("preview", "false");
  const response = await fetch("/api/crop/fit", { method: "POST", body: form, signal });
  if (!response.ok) throw new Error(await readBitmapError(response));
  const result = await response.json();
  return { crop: withBackgroundImage(result.crop, fit), preview: result.preview ?? null };
}

/**
 * The server only echoes pattern and dim; the background picture stays in the
 * browser, so it is put back onto the fit the server returned.
 */
function withBackgroundImage(crop: CropConfig, fit: FitOutput): CropConfig {
  const image = fit.background?.image;
  if (!image || !crop.fit) return crop;
  return {
    ...crop,
    fit: {
      ...crop.fit,
      background: { pattern: "none", dim: 0, ...crop.fit.background, image },
    },
  };
}

export async function autoFitFile(file: File, fit: FitOutput, signal?: AbortSignal): Promise<CropConfig> {
  return withBackgroundImage(await autoFitSelection(file, fit, signal), fit);
}

async function autoFitSelection(file: File, fit: FitOutput, signal?: AbortSignal): Promise<CropConfig> {
  if (isSvgFile(file)) {
    const form = fitForm(file, fit);
    form.append("preview", "false");
    const response = await fetch("/api/crop/fit", { method: "POST", body: form, signal });
    if (!response.ok) throw new Error(await readBitmapError(response));
    return (await response.json()).crop;
  }
  const image = await loadImageFromFile(file);
  try {
    // Only the selection is needed here; each editor renders its own preview when opened.
    const bitmap = await fetch(image.src, { signal }).then((response) => response.blob());
    const form = fitForm(bitmap, fit);
    form.append("preview", "false");
    const response = await fetch("/api/crop/fit", { method: "POST", body: form, signal });
    if (!response.ok) throw new Error(await readBitmapError(response));
    return (await response.json()).crop;
  } finally {
    if (image.src.startsWith("blob:")) URL.revokeObjectURL(image.src);
  }
}

export async function applyCropToFile(file: File, crop: CropConfig, signal?: AbortSignal): Promise<File> {
  if (isSvgFile(file)) {
    const safe = clampCrop(crop, crop.originalWidth, crop.originalHeight);
    // Keep the source SVG embedded as vectors. Its viewport is expressed in
    // the editor's original coordinates, independently of preview resolution.
    const source = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error || new Error("Could not read SVG."));
      reader.readAsDataURL(new Blob([file], { type: "image/svg+xml" }));
    });
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${safe.width}" height="${safe.height}" viewBox="${safe.x} ${safe.y} ${safe.width} ${safe.height}"><image href="${source}" width="${crop.originalWidth}" height="${crop.originalHeight}"/></svg>`;
    const selected = new File([svg], buildCroppedFilename(file.name, "image/svg+xml"), {
      type: "image/svg+xml", lastModified: file.lastModified,
    });
    if (!crop.fit) return selected;
    const form = fitForm(selected, crop.fit);
    // The saved selection is already clipped into the SVG; preserve it
    // instead of choosing a new automatic position during export.
    form.append("crop_x", "0");
    form.append("crop_y", "0");
    form.append("crop_width", String(safe.width));
    form.append("crop_height", String(safe.height));
    form.append("render", "true");
    const response = await fetch("/api/crop/fit", { method: "POST", body: form, signal });
    if (!response.ok) throw new Error(await readBitmapError(response));
    return new File([await response.blob()], buildCroppedFilename(file.name, "image/png"), {
      type: "image/png", lastModified: file.lastModified,
    });
  }
  const img = await loadImageFromFile(file);
  try {
    const safe = clampCrop(crop, img.naturalWidth, img.naturalHeight);
    if (crop.fit) {
      const bitmap = await fetch(img.src, { signal }).then((response) => response.blob());
      const form = fitForm(bitmap, crop.fit, safe);
      form.append("render", "true");
      const response = await fetch("/api/crop/fit", { method: "POST", body: form, signal });
      if (!response.ok) throw new Error(await readBitmapError(response));
      return new File([await response.blob()], buildCroppedFilename(file.name, "image/png"), {
        type: "image/png",
        lastModified: file.lastModified,
      });
    }
    const canvas = document.createElement("canvas");
    canvas.width = safe.width;
    canvas.height = safe.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context unavailable");
    ctx.drawImage(
      img,
      safe.x,
      safe.y,
      safe.width,
      safe.height,
      0,
      0,
      safe.width,
      safe.height
    );
    const mime = file.type === "image/jpeg" ? "image/jpeg" : "image/png";
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob returned null"))),
        mime,
        mime === "image/jpeg" ? 0.95 : undefined
      );
    });
    return new File([blob], buildCroppedFilename(file.name, mime), {
      type: mime,
      lastModified: Date.now(),
    });
  } finally {
    if (img.src.startsWith("blob:")) URL.revokeObjectURL(img.src);
  }
}

export function isCropableFile(file: File, supportedExtensions: string[] = []): boolean {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ext) return false;
  const normalized = supportedExtensions.map((e) =>
    (e.startsWith(".") ? e.slice(1) : e).toLowerCase()
  );
  return normalized.includes(ext) || file.type.startsWith("image/");
}

export function isCropUnsupportedFile(
  file: File,
  unsupportedExtensions: string[] = []
): boolean {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ext) return false;
  const normalized = unsupportedExtensions.map((e) =>
    (e.startsWith(".") ? e.slice(1) : e).toLowerCase()
  );
  return normalized.includes(ext);
}

export function fileFormatLabel(file: File): string {
  const ext = file.name.split(".").pop();
  if (!ext) return "image";
  return ext.toUpperCase();
}
