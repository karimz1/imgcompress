"use client";

import { RefObject, useEffect, useState } from "react";
import { fitContain } from "./cropMath";

interface UseFitPreviewBoxOptions {
  enabled: boolean;
  imgSize: { width: number; height: number } | null;
}

export function useFitPreviewBox(
  wrapperRef: RefObject<HTMLElement | null>,
  { enabled, imgSize }: UseFitPreviewBoxOptions
): { width: number; height: number } | null {
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    if (!enabled || !imgSize || !wrapperRef.current) return;
    const wrapper = wrapperRef.current;
    const fit = () => {
      const rect = wrapper.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      setBox(fitContain(imgSize, { width: rect.width, height: rect.height }));
    };
    fit();
    const obs = new ResizeObserver(fit);
    obs.observe(wrapper);
    return () => obs.disconnect();
  }, [enabled, imgSize, wrapperRef]);

  return box;
}
