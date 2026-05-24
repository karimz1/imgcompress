export type RatioPresetId = "free" | "1:1" | "16:9" | "4:3";

export interface CropConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  preset: RatioPresetId;
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
        return await loadImageFromBlob(blob);
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
  const ext = outputMime === "image/jpeg" ? ".jpg" : ".png";
  return `${base}${ext}`;
}

export async function applyCropToFile(file: File, crop: CropConfig): Promise<File> {
  const img = await loadImageFromFile(file);
  try {
    const safe = clampCrop(crop, img.naturalWidth, img.naturalHeight);
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
