"use client";

import { RefObject, useCallback, useEffect, useRef, useState } from "react";
import { ZOOM_STEP } from "./cropConstants";
import { clampPan, clampZoom } from "./cropMath";
import { isEditableTarget } from "./cropDom";

interface UseCropPanZoomOptions {
  containerRef: RefObject<HTMLElement | null>;
  scale: number;
  imgSize: { width: number; height: number } | null;
  enabled: boolean;
}

interface CropPanZoom {
  zoom: number;
  setZoom: (next: number) => void;
  pan: { x: number; y: number };
  setPan: (next: { x: number; y: number }) => void;
  spaceDown: boolean;
  resetView: () => void;
}

export function useCropPanZoom({
  containerRef,
  scale,
  imgSize,
  enabled,
}: UseCropPanZoomOptions): CropPanZoom {
  const [zoom, setZoomState] = useState(1);
  const [pan, setPanState] = useState({ x: 0, y: 0 });
  const [spaceDown, setSpaceDown] = useState(false);
  const liveRef = useRef({ scale: 1, zoom: 1, pan: { x: 0, y: 0 } });

  const setZoom = useCallback((next: number) => {
    setZoomState(clampZoom(next));
  }, []);

  const setPan = useCallback((next: { x: number; y: number }) => {
    setPanState(next);
  }, []);

  const resetView = useCallback(() => {
    setZoomState(1);
    setPanState({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    if (!imgSize) return;
    setPanState((prev) => clampPan(prev, scale, imgSize, zoom));
  }, [zoom, scale, imgSize]);

  useEffect(() => {
    liveRef.current = { scale, zoom, pan };
  }, [scale, zoom, pan]);

  useEffect(() => {
    if (!enabled || !imgSize) return;
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      const dir = ev.deltaY < 0 ? 1 : -1;
      const { scale: s, zoom: oldZoom, pan: oldPan } = liveRef.current;
      const newZoom = clampZoom(oldZoom + dir * ZOOM_STEP);
      if (newZoom === oldZoom) return;
      const rect = el.getBoundingClientRect();
      const cx = ev.clientX - rect.left;
      const cy = ev.clientY - rect.top;
      const ratio = newZoom / oldZoom;
      const newPan = clampPan(
        { x: cx - (cx - oldPan.x) * ratio, y: cy - (cy - oldPan.y) * ratio },
        s,
        imgSize,
        newZoom
      );
      setZoomState(newZoom);
      setPanState(newPan);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [enabled, imgSize, containerRef]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !isEditableTarget(e.target)) {
        e.preventDefault();
        setSpaceDown(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceDown(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  return { zoom, setZoom, pan, setPan, spaceDown, resetView };
}
