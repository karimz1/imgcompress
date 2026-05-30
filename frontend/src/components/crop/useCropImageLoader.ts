"use client";

import { useEffect, useState } from "react";
import {
  CropBitmapError,
  isBrowserNativeFormat,
  loadImageFromFile,
} from "@/lib/crop";

export type LoadingVariant = "local" | "server";

interface CropImageLoadResult {
  imgUrl: string | null;
  imgSize: { width: number; height: number } | null;
  loadError: string | null;
  loadErrorDetails: string | null;
  loadingVariant: LoadingVariant;
}

export function useCropImageLoader(file: File): CropImageLoadResult {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [imgSize, setImgSize] = useState<{ width: number; height: number } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadErrorDetails, setLoadErrorDetails] = useState<string | null>(null);
  const [loadingVariant, setLoadingVariant] = useState<LoadingVariant>(() =>
    isBrowserNativeFormat(file) ? "local" : "server"
  );

  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;
    setImgUrl(null);
    setImgSize(null);
    setLoadError(null);
    setLoadErrorDetails(null);
    setLoadingVariant(isBrowserNativeFormat(file) ? "local" : "server");

    loadImageFromFile(file, {
      onFallbackToServer: () => {
        if (!cancelled) setLoadingVariant("server");
      },
    })
      .then((img) => {
        if (cancelled) {
          if (img.src.startsWith("blob:")) URL.revokeObjectURL(img.src);
          return;
        }
        createdUrl = img.src;
        setImgUrl(img.src);
        setImgSize({ width: img.naturalWidth, height: img.naturalHeight });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof CropBitmapError) {
          setLoadError(err.message);
          setLoadErrorDetails(err.details);
        } else {
          const message = err instanceof Error ? err.message : String(err);
          setLoadError(message);
        }
      });

    return () => {
      cancelled = true;
      if (createdUrl && createdUrl.startsWith("blob:")) URL.revokeObjectURL(createdUrl);
    };
  }, [file]);

  return { imgUrl, imgSize, loadError, loadErrorDetails, loadingVariant };
}
