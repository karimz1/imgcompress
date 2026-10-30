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

/**
 * Noise reduction for the General model. Strong is the model as released; Medium
 * and Low are the official weak-denoise blend (built into the image) that keeps
 * more fine detail, and more noise. Same speed.
 */
export const UPSCALE_DENOISE_LEVELS = ["strong", "medium", "low"] as const;
export type UpscaleDenoise = (typeof UPSCALE_DENOISE_LEVELS)[number];

/** Every model file the server reports on: the cards plus the General noise presets. */
export const UPSCALE_MODEL_IDS = [...UPSCALE_MODELS, "general-denoise-medium", "general-denoise-low"] as const;
export type UpscaleModelId = (typeof UPSCALE_MODEL_IDS)[number];
const DENOISE_MODEL_NAMES: Record<Exclude<UpscaleModelId, UpscaleModel>, string> = {
  "general-denoise-medium": "realesr-general-x4v3-denoise-medium",
  "general-denoise-low": "realesr-general-x4v3-denoise-low",
};
export const UPSCALE_MODEL_ID_NAMES: Record<UpscaleModelId, string> = { ...UPSCALE_MODEL_NAMES, ...DENOISE_MODEL_NAMES };

export interface UpscaleModelStatus {
  id: UpscaleModelId;
  modelName: string;
  available: boolean;
}

export interface UpscaleSettings {
  enabled: boolean;
  target: UpscaleTarget;
  model: UpscaleModel;
  denoise: UpscaleDenoise;
}

export const DEFAULT_UPSCALE_SETTINGS: UpscaleSettings = {
  enabled: false,
  target: "2x",
  model: "general",
  denoise: "strong",
};

/** The `upscale_model` form value: General's noise presets are model files of their own. */
export function upscaleModelParam(settings: Pick<UpscaleSettings, "model" | "denoise">): UpscaleModelId {
  return settings.model === "general" && settings.denoise !== "strong"
    ? `general-denoise-${settings.denoise}`
    : settings.model;
}

export function toUpscaleModel(value: string): UpscaleModel {
  return (UPSCALE_MODELS as readonly string[]).includes(value)
    ? (value as UpscaleModel)
    : DEFAULT_UPSCALE_SETTINGS.model;
}

export function isUpscaleCardModel(value: string): value is UpscaleModel {
  return (UPSCALE_MODELS as readonly string[]).includes(value);
}

export function toUpscaleTarget(value: string): UpscaleTarget {
  return (UPSCALE_TARGETS as readonly string[]).includes(value)
    ? (value as UpscaleTarget)
    : DEFAULT_UPSCALE_SETTINGS.target;
}

/** Short, language-neutral names for the size preview of files the browser cannot measure. */
export const UPSCALE_TARGET_SHORT: Record<UpscaleTarget, string> = {
  "2x": "2×",
  "4x": "4×",
  "8x": "8×",
  "1080p": "Full HD",
  "4k": "4K",
  "6k": "6K",
  "8k": "8K",
  "16k": "16K",
};
