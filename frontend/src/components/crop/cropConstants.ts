export type Handle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 4;
export const ZOOM_STEP = 0.25;

export const HANDLE_DEFS: { id: Handle; classes: string; cursor: string }[] = [
  { id: "nw", classes: "left-0 top-0 -translate-x-1/2 -translate-y-1/2", cursor: "cursor-nwse-resize" },
  { id: "n", classes: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2", cursor: "cursor-ns-resize" },
  { id: "ne", classes: "right-0 top-0 translate-x-1/2 -translate-y-1/2", cursor: "cursor-nesw-resize" },
  { id: "e", classes: "right-0 top-1/2 translate-x-1/2 -translate-y-1/2", cursor: "cursor-ew-resize" },
  { id: "se", classes: "right-0 bottom-0 translate-x-1/2 translate-y-1/2", cursor: "cursor-nwse-resize" },
  { id: "s", classes: "left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2", cursor: "cursor-ns-resize" },
  { id: "sw", classes: "left-0 bottom-0 -translate-x-1/2 translate-y-1/2", cursor: "cursor-nesw-resize" },
  { id: "w", classes: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2", cursor: "cursor-ew-resize" },
];
