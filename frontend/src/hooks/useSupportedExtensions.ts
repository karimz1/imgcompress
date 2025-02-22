"use client";

import { useState, useEffect } from "react";

interface SupportedFormatsResponse {
  supported_formats: string[];
}

export function useSupportedExtensions() {
  const [extensions, setExtensions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchExtensions = async () => {
      try {
        const response = await fetch("/api/images_supported");
        if (!response.ok) {
          throw new Error("Failed to fetch supported extensions");
        }
        const data: SupportedFormatsResponse = await response.json();
        setExtensions(data.supported_formats);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Unknown error"));
      } finally {
        setIsLoading(false);
      }
    };

    fetchExtensions();
  }, []);

  return { extensions, isLoading, error };
}