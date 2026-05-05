"use client";

import { useEffect, useState } from "react";

interface UseCropUnsupportedExtensionsResult {
  unsupportedExtensions: string[];
  isLoading: boolean;
  error: Error | null;
}

export function useCropUnsupportedExtensions(): UseCropUnsupportedExtensionsResult {
  const [unsupportedExtensions, setUnsupportedExtensions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchUnsupportedExtensions = async () => {
      try {
        const res = await fetch("/api/crop_unsupported_formats");
        if (!res.ok) {
          throw new Error("Failed to load unsupported crop formats");
        }
        const data = await res.json();
        setUnsupportedExtensions(data.unsupported_formats || []);
      } catch (err) {
        console.error("Error fetching unsupported crop formats:", err);
        setError(err instanceof Error ? err : new Error("Unknown error"));
      } finally {
        setIsLoading(false);
      }
    };

    fetchUnsupportedExtensions();
  }, []);

  return { unsupportedExtensions, isLoading, error };
}
