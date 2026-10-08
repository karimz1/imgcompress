/**
 * AI upscaling options. The values mirror the backend `UpscaleTarget` enum
 * (backend/image_converter/domain/upscaling.py) and are sent as the `upscale`
 * form field.
 */
export const UPSCALE_TARGETS = ["2x", "4x", "1080p", "4k"] as const;
export type UpscaleTarget = (typeof UPSCALE_TARGETS)[number];

export interface UpscaleSettings {
  enabled: boolean;
  target: UpscaleTarget;
}

export const DEFAULT_UPSCALE_SETTINGS: UpscaleSettings = {
  enabled: false,
  target: "2x",
};

export function toUpscaleTarget(value: string): UpscaleTarget {
  return (UPSCALE_TARGETS as readonly string[]).includes(value)
    ? (value as UpscaleTarget)
    : DEFAULT_UPSCALE_SETTINGS.target;
}
