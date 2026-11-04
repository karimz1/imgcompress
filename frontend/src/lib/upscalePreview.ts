/**
 * Live upscale preview: which pixels go to POST /api/upscale/preview.
 * The browser sends only the selected region plus a border of real pixels
 * (the server crops the border away again), never the whole file.
 */
export const PREVIEW_REGION = 160;
export const PREVIEW_PAD = 32;

export interface TileBox {
  /** Crop sent to the server, in image pixels. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** The selected region inside that crop. */
  inner: { x: number; y: number; width: number; height: number };
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** Region centred on (cx, cy), kept inside the image; the border shrinks at the edges. */
export function previewTileBox(imageWidth: number, imageHeight: number, cx: number, cy: number): TileBox {
  const width = Math.min(PREVIEW_REGION, imageWidth);
  const height = Math.min(PREVIEW_REGION, imageHeight);
  const rx = Math.round(clamp(cx - width / 2, 0, imageWidth - width));
  const ry = Math.round(clamp(cy - height / 2, 0, imageHeight - height));
  const x = Math.max(0, rx - PREVIEW_PAD);
  const y = Math.max(0, ry - PREVIEW_PAD);
  const right = Math.min(imageWidth, rx + width + PREVIEW_PAD);
  const bottom = Math.min(imageHeight, ry + height + PREVIEW_PAD);
  return { x, y, width: right - x, height: bottom - y, inner: { x: rx - x, y: ry - y, width, height } };
}
