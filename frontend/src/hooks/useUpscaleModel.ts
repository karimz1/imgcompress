"use client";

import { useEffect, useState } from "react";
import { UPSCALE_MODELS, UPSCALE_MODEL_NAMES, type UpscaleModelStatus } from "@/lib/upscale";

interface UseUpscaleModelResult {
  models: UpscaleModelStatus[];
  isLoading: boolean;
}

/** Bundled upscaling models and whether each one is installed. */
export function useUpscaleModel(): UseUpscaleModelResult {
  const [models, setModels] = useState<UpscaleModelStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch("/api/upscale_model");
        if (!res.ok) {
          throw new Error("Failed to load upscaling model status");
        }
        const data = await res.json();
        const statuses = Array.isArray(data.models) ? data.models : [];
        setModels(UPSCALE_MODELS.map((id) => {
          const status = statuses.find((item: { id?: unknown } | null) => item?.id === id);
          return {
            id,
            modelName: typeof status?.model_name === "string" ? status.model_name : UPSCALE_MODEL_NAMES[id],
            available: status?.available === true,
          };
        }));
      } catch (err) {
        console.error("Error fetching upscaling model status:", err);
        setModels([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStatus();
  }, []);

  return { models, isLoading };
}
