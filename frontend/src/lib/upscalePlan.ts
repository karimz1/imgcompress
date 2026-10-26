import type { UpscaleTarget } from "./upscale";

/**
 * The output size of an AI upscale, worked out in the browser for the preview.
 * Mirrors plan_upscale in backend/image_converter/domain/upscaling.py exactly,
 * including Python's round() (half to even), so the preview never shows a size
 * the server would not create. Kept free of React so plain Node can test it.
 */

/** Same default as upscaling.max_output_megapixels in the backend app.json. */
export const DEFAULT_MAX_OUTPUT_MEGAPIXELS = 144;

/** The bundled model enlarges by exactly this factor (MODEL_SCALE in the backend). */
const MODEL_SCALE = 4;

/** [long side, short side] of each frame target. */
const FRAMES: Partial<Record<UpscaleTarget, [number, number]>> = {
  "1080p": [1920, 1080],
  "4k": [3840, 2160],
  "6k": [5760, 3240],
  "8k": [7680, 4320],
  "16k": [15360, 8640],
};

const LARGE_TARGETS: readonly UpscaleTarget[] = ["8x", "6k", "8k", "16k"];

export interface PixelSize {
  width: number;
  height: number;
}

export type UpscalePlan =
  | { kind: "resize"; from: PixelSize; to: PixelSize }
  /** The image already meets the frame target, so the server passes it through. */
  | { kind: "unchanged"; from: PixelSize }
  /** The server would refuse it: the output is above max_output_megapixels. */
  | { kind: "tooLarge"; from: PixelSize; to: PixelSize };

export function isLargeUpscaleTarget(target: UpscaleTarget): boolean {
  return LARGE_TARGETS.includes(target);
}

export function planUpscale(
  width: number,
  height: number,
  target: UpscaleTarget,
  maxOutputPixels: number,
): UpscalePlan | null {
  if (!(width > 0) || !(height > 0)) return null;
  const from = { width, height };
  const scale = scaleFor(width, height, target);
  if (scale <= 1) return { kind: "unchanged", from };
  const to = {
    width: Math.max(width, roundHalfEven(width * scale)),
    height: Math.max(height, roundHalfEven(height * scale)),
  };
  return to.width * to.height > maxOutputPixels ? { kind: "tooLarge", from, to } : { kind: "resize", from, to };
}

function scaleFor(width: number, height: number, target: UpscaleTarget): number {
  if (target === "2x") return 2;
  if (target === "4x") return MODEL_SCALE;
  if (target === "8x") return 8;
  const [frameLong, frameShort] = FRAMES[target]!;
  return Math.min(frameLong / Math.max(width, height), frameShort / Math.min(width, height));
}

/** Python's round(): exact halves go to the even neighbour. */
function roundHalfEven(value: number): number {
  const floor = Math.floor(value);
  const rest = value - floor;
  if (rest !== 0.5) return Math.round(value);
  return floor % 2 === 0 ? floor : floor + 1;
}
