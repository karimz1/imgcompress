import { Handle, Rect, ZOOM_MAX, ZOOM_MIN } from "./cropConstants";

export function clampPan(
  pan: { x: number; y: number },
  scale: number,
  imgSize: { width: number; height: number },
  zoom: number
): { x: number; y: number } {
  const overflowX = scale * imgSize.width * (zoom - 1);
  const overflowY = scale * imgSize.height * (zoom - 1);
  return {
    x: Math.max(-overflowX, Math.min(0, pan.x)),
    y: Math.max(-overflowY, Math.min(0, pan.y)),
  };
}

export function clampZoom(z: number): number {
  if (Number.isNaN(z)) return ZOOM_MIN;
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round(z * 100) / 100));
}

export function resizeWithHandle(
  start: Rect,
  handle: Handle,
  dxPx: number,
  dyPx: number,
  ratio: number | null,
  fromCenter = false
): Rect {
  let { x, y, width, height } = start;
  const right = start.x + start.width;
  const bottom = start.y + start.height;
  const centerX = start.x + start.width / 2;
  const centerY = start.y + start.height / 2;

  if (fromCenter) {
    switch (handle) {
      case "n":
        height = start.height - 2 * dyPx;
        break;
      case "s":
        height = start.height + 2 * dyPx;
        break;
      case "w":
        width = start.width - 2 * dxPx;
        break;
      case "e":
        width = start.width + 2 * dxPx;
        break;
      case "nw":
        width = start.width - 2 * dxPx;
        height = start.height - 2 * dyPx;
        break;
      case "ne":
        width = start.width + 2 * dxPx;
        height = start.height - 2 * dyPx;
        break;
      case "sw":
        width = start.width - 2 * dxPx;
        height = start.height + 2 * dyPx;
        break;
      case "se":
        width = start.width + 2 * dxPx;
        height = start.height + 2 * dyPx;
        break;
    }

    width = Math.max(1, width);
    height = Math.max(1, height);
    if (ratio != null) {
      const driver: "width" | "height" =
        handle === "n" || handle === "s" ? "height" : "width";
      if (driver === "width") {
        height = Math.max(1, width / ratio);
      } else {
        width = Math.max(1, height * ratio);
      }
    }
    return {
      x: centerX - width / 2,
      y: centerY - height / 2,
      width,
      height,
    };
  }

  switch (handle) {
    case "n":
      y = start.y + dyPx;
      height = bottom - y;
      break;
    case "s":
      height = start.height + dyPx;
      break;
    case "w":
      x = start.x + dxPx;
      width = right - x;
      break;
    case "e":
      width = start.width + dxPx;
      break;
    case "nw":
      x = start.x + dxPx;
      y = start.y + dyPx;
      width = right - x;
      height = bottom - y;
      break;
    case "ne":
      y = start.y + dyPx;
      width = start.width + dxPx;
      height = bottom - y;
      break;
    case "sw":
      x = start.x + dxPx;
      width = right - x;
      height = start.height + dyPx;
      break;
    case "se":
      width = start.width + dxPx;
      height = start.height + dyPx;
      break;
  }
  if (ratio != null) {
    const driver: "width" | "height" =
      handle === "n" || handle === "s" ? "height" : "width";
    if (driver === "width") {
      height = Math.max(1, width / ratio);
    } else {
      width = Math.max(1, height * ratio);
    }
    if (handle.includes("n")) y = bottom - height;
    if (handle.includes("w")) x = right - width;
  }
  return { x, y, width, height };
}

export function buildPercentClip(
  crop: Rect,
  imgSize: { width: number; height: number }
): string {
  const left = (crop.x / imgSize.width) * 100;
  const right = ((crop.x + crop.width) / imgSize.width) * 100;
  const top = (crop.y / imgSize.height) * 100;
  const bottom = ((crop.y + crop.height) / imgSize.height) * 100;
  return `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% ${top}%, ${left}% ${top}%, ${left}% ${bottom}%, ${right}% ${bottom}%, ${right}% ${top}%, 0% ${top}%)`;
}

export function fitContain(
  imgSize: { width: number; height: number },
  wrapperSize: { width: number; height: number }
): { width: number; height: number } {
  const wRatio = imgSize.width / imgSize.height;
  const cRatio = wrapperSize.width / wrapperSize.height;
  if (wRatio > cRatio) {
    const width = Math.floor(wrapperSize.width);
    return { width, height: Math.round(width / wRatio) };
  }
  const height = Math.floor(wrapperSize.height);
  return { width: Math.round(height * wRatio), height };
}
