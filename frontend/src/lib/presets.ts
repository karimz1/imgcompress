/**
 * Compression presets: named sets of conversion settings, shared by everyone
 * using this server (see backend/image_converter/domain/compression_presets.py).
 *
 * Settings use the field names and values of the conversion request, and the
 * server normalizes them: what does not apply to the format is null. The form
 * state is turned into the same shape with `presetSettingsFromForm`, so a
 * preset is active exactly while that shape equals its settings.
 */
import { DEFAULT_PDF_QUALITY, type PdfQualityOption } from "@/lib/pdfQuality";
import {
  upscaleModelParam,
  type UpscaleDenoise,
  type UpscaleModel,
  type UpscaleModelId,
  type UpscaleSettings,
  type UpscaleTarget,
} from "@/lib/upscale";

export const PRESETS_URL = "/api/presets";
// Same limits as the server.
export const MAX_PRESETS = 100;
export const MAX_PRESET_NAME_LENGTH = 80;

export interface PresetSettings {
  format: string;
  quality: number | null;
  width: number | null;
  target_size_kb: number | null;
  use_rembg: boolean | null;
  webp_lossless: boolean | null;
  pdf_preset: string | null;
  pdf_quality: PdfQualityOption | null;
  pdf_scale: string | null;
  pdf_margin_mm: number | null;
  pdf_paginate: boolean | null;
  upscale: UpscaleTarget | null;
  upscale_model: UpscaleModelId | null;
}

export interface CompressionPreset {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  settings: PresetSettings;
}

/** The form values a preset describes, as kept in the page state. */
export interface PresetFormState {
  outputFormat: string;
  compressionMode: "quality" | "size";
  quality: string;
  targetSizeMB: string;
  resizeWidthEnabled: boolean;
  width: string;
  useRembg: boolean;
  webpLossless: boolean;
  pdfPreset: string;
  pdfQuality: PdfQualityOption;
  pdfScale: string;
  pdfMarginMm: string;
  pdfPaginate: boolean;
  upscale: UpscaleSettings;
  /** Fitted images keep their size, so the form sends neither a width nor upscaling. */
  hasFittedImages: boolean;
}

const KILOBYTES_PER_MEGABYTE = 1024;
const DEFAULT_PDF_MARGIN_MM = 10;
const MAX_PDF_MARGIN_MM = 30;

const isWholeNumber = (value: string) => /^\d+$/.test(value.trim());

/**
 * The settings the form would convert with, in the server's normalized shape;
 * null when the form cannot convert yet (no format, or an invalid number).
 * Mirrors what the page sends with a conversion.
 */
export function presetSettingsFromForm(form: PresetFormState): PresetSettings | null {
  const format = form.outputFormat;
  if (!format) return null;
  const isPdf = format === "pdf";
  const isWebp = format === "webp";
  const hasQuality = format === "jpeg" || format === "avif" || (isWebp && !form.webpLossless);
  const hasPage = isPdf && form.pdfPreset !== "original";

  let quality: number | null = null;
  let targetSizeKb: number | null = null;
  if (hasQuality && form.compressionMode === "quality") {
    if (!isWholeNumber(form.quality)) return null;
    quality = Number(form.quality);
    if (quality < 1 || quality > 100) return null;
  }
  if (hasQuality && form.compressionMode === "size") {
    const megabytes = parseFloat(form.targetSizeMB);
    targetSizeKb = Math.round(megabytes * KILOBYTES_PER_MEGABYTE);
    if (!Number.isFinite(megabytes) || targetSizeKb < 1) return null;
  }

  const upscaleActive = form.upscale.enabled && !isPdf && !form.hasFittedImages;
  let width: number | null = null;
  if (form.resizeWidthEnabled && !upscaleActive && !hasPage) {
    if (!isWholeNumber(form.width) || Number(form.width) < 1) return null;
    width = Number(form.width);
  }

  let pdfMarginMm: number | null = null;
  if (hasPage) {
    pdfMarginMm = form.pdfMarginMm.trim() === "" ? DEFAULT_PDF_MARGIN_MM : Number(form.pdfMarginMm);
    if (!Number.isFinite(pdfMarginMm) || pdfMarginMm < 0 || pdfMarginMm > MAX_PDF_MARGIN_MM) return null;
  }

  return {
    format,
    quality,
    width,
    target_size_kb: targetSizeKb,
    use_rembg: format === "png" || format === "avif" || isWebp ? form.useRembg : null,
    webp_lossless: isWebp ? form.webpLossless : null,
    pdf_preset: isPdf ? form.pdfPreset : null,
    pdf_quality: isPdf ? form.pdfQuality : null,
    pdf_scale: hasPage ? (form.pdfPaginate ? "fit" : form.pdfScale) : null,
    pdf_margin_mm: pdfMarginMm,
    pdf_paginate: hasPage ? form.pdfPaginate : null,
    upscale: upscaleActive ? form.upscale.target : null,
    upscale_model: upscaleActive ? upscaleModelParam(form.upscale) : null,
  };
}

/** The upscale card and noise preset behind an `upscale_model` value. */
function upscaleChoiceOf(model: UpscaleModelId): { model: UpscaleModel; denoise?: UpscaleDenoise } {
  switch (model) {
    case "anime":
      return { model: "anime" };
    case "general-denoise-low":
      return { model: "general", denoise: "low" };
    case "general-denoise-medium":
      return { model: "general", denoise: "medium" };
    default:
      return { model: "general", denoise: "strong" };
  }
}

/** Shortest megabyte text that still gives the same kilobytes back. */
function megabytesText(kilobytes: number): string {
  const exact = kilobytes / KILOBYTES_PER_MEGABYTE;
  const short = Number(exact.toFixed(2));
  return Math.round(short * KILOBYTES_PER_MEGABYTE) === kilobytes ? String(short) : String(exact);
}

/**
 * The form values that reproduce a preset. Values that do not apply to its
 * format keep what the form had, so switching formats later feels the same.
 */
export function presetFormState(
  settings: PresetSettings,
  current: Pick<PresetFormState, "quality" | "upscale">,
): Omit<PresetFormState, "hasFittedImages"> {
  const upscale: UpscaleSettings = settings.upscale
    ? { ...current.upscale, enabled: true, target: settings.upscale, ...upscaleChoiceOf(settings.upscale_model ?? "general") }
    : { ...current.upscale, enabled: false };
  return {
    outputFormat: settings.format,
    compressionMode: settings.target_size_kb !== null ? "size" : "quality",
    quality: settings.quality !== null ? String(settings.quality) : current.quality,
    targetSizeMB: settings.target_size_kb !== null ? megabytesText(settings.target_size_kb) : "",
    resizeWidthEnabled: settings.width !== null,
    width: settings.width !== null ? String(settings.width) : "",
    useRembg: settings.use_rembg === true,
    webpLossless: settings.webp_lossless === true,
    pdfPreset: settings.pdf_preset ?? "original",
    pdfQuality: settings.pdf_quality ?? DEFAULT_PDF_QUALITY,
    pdfScale: settings.pdf_scale ?? "fit",
    pdfMarginMm: settings.pdf_margin_mm !== null ? String(settings.pdf_margin_mm) : String(DEFAULT_PDF_MARGIN_MM),
    pdfPaginate: settings.pdf_paginate === true,
    upscale,
  };
}

const SETTING_KEYS: (keyof PresetSettings)[] = [
  "format",
  "quality",
  "width",
  "target_size_kb",
  "use_rembg",
  "webp_lossless",
  "pdf_preset",
  "pdf_quality",
  "pdf_scale",
  "pdf_margin_mm",
  "pdf_paginate",
  "upscale",
  "upscale_model",
];

export function presetSettingsEqual(a: PresetSettings | null, b: PresetSettings | null): boolean {
  if (!a || !b) return false;
  return SETTING_KEYS.every((key) => (a[key] ?? null) === (b[key] ?? null));
}

/** Error codes of the preset API; the UI shows its own text for each. */
export type PresetErrorCode = "invalid" | "disabled" | "not_found" | "limit_reached" | "name_taken" | "unavailable";

/** Thrown for any answer other than success, with the server's message and code when it sent them. */
export class PresetRequestError extends Error {
  constructor(message: string, readonly code: PresetErrorCode | null) {
    super(message);
    this.name = "PresetRequestError";
  }
}

async function presetRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });
  if (response.status === 204) return undefined as T;
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new PresetRequestError(payload?.error || response.statusText, payload?.code ?? null);
  }
  return payload as T;
}

export async function fetchPresets(): Promise<CompressionPreset[]> {
  const payload = await presetRequest<{ presets: CompressionPreset[] }>(PRESETS_URL);
  return payload.presets;
}

export function createPreset(name: string, settings: PresetSettings): Promise<CompressionPreset> {
  return presetRequest(PRESETS_URL, { method: "POST", body: JSON.stringify({ name, settings }) });
}

export function updatePreset(
  id: string,
  changes: { name?: string; settings?: PresetSettings },
): Promise<CompressionPreset> {
  return presetRequest(`${PRESETS_URL}/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(changes) });
}

export function deletePreset(id: string): Promise<void> {
  return presetRequest(`${PRESETS_URL}/${encodeURIComponent(id)}`, { method: "DELETE" });
}

