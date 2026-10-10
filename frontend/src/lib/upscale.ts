/**
 * AI upscaling options. The values mirror the backend `UpscaleTarget` enum
 * (backend/image_converter/domain/upscaling.py) and are sent as the `upscale`
 * form field.
 */
export const UPSCALE_TARGETS = ["2x", "4x", "8x", "1080p", "4k", "6k", "8k", "16k"] as const;
export type UpscaleTarget = (typeof UPSCALE_TARGETS)[number];

export const UPSCALE_MODELS = ["general", "anime"] as const;
export type UpscaleModel = (typeof UPSCALE_MODELS)[number];
export const UPSCALE_MODEL_NAMES: Record<UpscaleModel, string> = {
  general: "realesr-general-x4v3",
  anime: "realesr-animevideov3",
};

export interface UpscaleModelStatus {
  id: UpscaleModel;
  modelName: string;
  available: boolean;
}

export interface UpscaleSettings {
  enabled: boolean;
  target: UpscaleTarget;
  model: UpscaleModel;
}

export const DEFAULT_UPSCALE_SETTINGS: UpscaleSettings = {
  enabled: false,
  target: "2x",
  model: "general",
};

export function toUpscaleModel(value: string): UpscaleModel {
  return (UPSCALE_MODELS as readonly string[]).includes(value)
    ? (value as UpscaleModel)
    : DEFAULT_UPSCALE_SETTINGS.model;
}

export function toUpscaleTarget(value: string): UpscaleTarget {
  return (UPSCALE_TARGETS as readonly string[]).includes(value)
    ? (value as UpscaleTarget)
    : DEFAULT_UPSCALE_SETTINGS.target;
}
