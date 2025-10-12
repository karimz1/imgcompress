"use client";

import { useState, useEffect } from "react";

interface UseSupportedExtensionsResult {
  supportedExtensions: string[];
  verifiedExtensions: string[];
  isLoading: boolean;
  error: Error | null;
}

export function useSupportedExtensions(): UseSupportedExtensionsResult {
  const [supportedExtensions, setSupportedExtensions] = useState<string[]>([]);
  const [verifiedExtensions, setVerifiedExtensions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchExtensions() {
      setIsLoading(true);
      setError(null);
      try {
        const [supportedRes, verifiedRes] = await Promise.all([
          fetch("/api/images_supported"),
          fetch("/api/images_verified"),
        ]);

        if (!supportedRes.ok || !verifiedRes.ok) {
          throw new Error("Failed to load supported or verified formats");
        }

        const supportedData = await supportedRes.json();
        const verifiedData = await verifiedRes.json();

        setSupportedExtensions(supportedData.supported_formats || []);
        setVerifiedExtensions(verifiedData.verified_formats || []);
      } catch (err) {
        console.error("Error fetching image extensions:", err);
        setError(err instanceof Error ? err : new Error("Unknown error"));
      } finally {
        setIsLoading(false);
      }
    }

    fetchExtensions();
  }, []);

  return { supportedExtensions, verifiedExtensions, isLoading, error };
}
