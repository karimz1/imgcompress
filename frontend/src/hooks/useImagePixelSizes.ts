import { useEffect, useState } from "react";
import type { PixelSize } from "@/lib/upscalePlan";

/**
 * The pixel size of each selected file, read by the browser for the upscale
 * preview. Only formats the browser reads the same way as the server are
 * measured; everything else (SVG, PDF, PSD, HEIC, TIFF, ...) stays unknown so
 * the preview never shows a wrong number.
 */
const MEASURABLE = new Set(["png", "jpg", "jpeg", "webp", "gif", "bmp"]);

// null: the browser could not read it.
const cache = new WeakMap<File, PixelSize | null>();

export function isMeasurableFile(file: File): boolean {
  return MEASURABLE.has((file.name.split(".").pop() ?? "").toLowerCase());
}

function measure(file: File): Promise<PixelSize | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    const done = (size: PixelSize | null) => {
      URL.revokeObjectURL(url);
      resolve(size);
    };
    // The header is enough: load gives the size (EXIF orientation applied) without painting it.
    img.onload = () =>
      done(img.naturalWidth > 0 && img.naturalHeight > 0 ? { width: img.naturalWidth, height: img.naturalHeight } : null);
    img.onerror = () => done(null);
    img.src = url;
  });
}

/** Keyed by file name, like the crops. Measures only while `enabled`. */
export function useImagePixelSizes(files: File[], enabled: boolean): Record<string, PixelSize | null> {
  const [sizes, setSizes] = useState<Record<string, PixelSize | null>>({});

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const known: Record<string, PixelSize | null> = {};
    const pending: File[] = [];
    for (const file of files) {
      if (!isMeasurableFile(file)) continue;
      if (cache.has(file)) known[file.name] = cache.get(file)!;
      else pending.push(file);
    }
    setSizes(known);
    pending.forEach((file) => {
      void measure(file).then((size) => {
        cache.set(file, size);
        if (!cancelled) setSizes((prev) => ({ ...prev, [file.name]: size }));
      });
    });
    return () => {
      cancelled = true;
    };
  }, [files, enabled]);

  return sizes;
}
