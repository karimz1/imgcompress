"use client";

import { useEffect, useState } from "react";

interface UseUpscaleModelResult {
  modelName: string | null;
  available: boolean;
  isLoading: boolean;
}

/** Name of the bundled upscaling model and whether the server has it installed. */
export function useUpscaleModel(): UseUpscaleModelResult {
  const [modelName, setModelName] = useState<string | null>(null);
  const [available, setAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch("/api/upscale_model");
        if (!res.ok) {
          throw new Error("Failed to load upscaling model status");
        }
        const data = await res.json();
        setModelName(typeof data.model_name === "string" ? data.model_name : null);
        setAvailable(data.available === true);
      } catch (err) {
        console.error("Error fetching upscaling model status:", err);
        setAvailable(false);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStatus();
  }, []);

  return { modelName, available, isLoading };
}
