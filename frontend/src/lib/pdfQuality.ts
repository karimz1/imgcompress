/**
 * PDF document-quality presets. Mirrors the backend `PdfQuality` enum
 * (backend/image_converter/domain/pdf_quality.py) — these strings are the wire
 * values sent as the `pdf_quality` form field.
 */
export const PDF_QUALITY_OPTIONS = ["small", "medium", "high", "ultra"] as const;

export type PdfQualityOption = (typeof PDF_QUALITY_OPTIONS)[number];

export const DEFAULT_PDF_QUALITY: PdfQualityOption = "high";

/**
 * Narrows an untrusted string to a known preset, falling back to the default.
 * The TypeScript counterpart of `PdfQuality.from_string_result` — call it where
 * an unconstrained string enters (select callbacks, persisted state, query params)
 * so everything downstream can rely on the union type.
 */
export function toPdfQualityOption(value: string): PdfQualityOption {
  return (PDF_QUALITY_OPTIONS as readonly string[]).includes(value)
    ? (value as PdfQualityOption)
    : DEFAULT_PDF_QUALITY;
}
