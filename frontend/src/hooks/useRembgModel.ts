"use client";

import { useEffect, useState } from "react";

interface UseRembgModelResult {
  modelName: string | null;
  isLoading: boolean;
  error: Error | null;
}

export function useRembgModel(): UseRembgModelResult {
  const [modelName, setModelName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchModelName = async () => {
      try {
        const res = await fetch("/api/rembg_model");
        if (!res.ok) {
          throw new Error("Failed to load rembg model name");
        }
        const data = await res.json();
        setModelName(typeof data.model_name === "string" ? data.model_name : null);
      } catch (err) {
        console.error("Error fetching rembg model name:", err);
        setError(err instanceof Error ? err : new Error("Unknown error"));
      } finally {
        setIsLoading(false);
      }
    };

    fetchModelName();
  }, []);

  return { modelName, isLoading, error };
}
