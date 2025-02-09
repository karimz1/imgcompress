// hooks/useBackendHealth.ts
import { useEffect, useState } from "react";

/**
 * Custom hook to periodically check the backend's health.
 * It fetches from `/health/live` and returns true if the backend is down.
 *
 * @param minDelay - Minimum delay (ms) between health checks. Default: 30000 (30 seconds)
 * @param maxDelay - Maximum delay (ms) between health checks. Default: 60000 (60 seconds)
 * @returns {boolean} - True if backend is down, false otherwise.
 */
export function useBackendHealth(minDelay: number = 30000, maxDelay: number = 60000): boolean {
  const [backendDown, setBackendDown] = useState(false);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const checkHealth = async () => {
      try {
        const res = await fetch("/health/live");
        if (!res.ok) {
          setBackendDown(true);
        } else {
          setBackendDown(false);
        }
      } catch{
        setBackendDown(true);
      }

      // Schedule the next health check at a random interval between minDelay and maxDelay.
      const randomDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
      timeoutId = setTimeout(checkHealth, randomDelay);
    };

    checkHealth();

    return () => clearTimeout(timeoutId);
  }, [minDelay, maxDelay]);

  return backendDown;
}
