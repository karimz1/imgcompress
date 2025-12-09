import { useEffect, useState } from "react";
import {BackendHealthResponse} from "@/models/BackendHealthResponse";
export function useBackendHealth(
  minDelay: number = 5000,
  maxDelay: number = 15000
) {
  const [isDown, setDown] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [backendLastUpdate, setBackendLastUpdate] = useState<string | null>(null);

  useEffect(() => {
    let timeout: NodeJS.Timeout;

    const check = async () => {
      try {
        const res = await fetch("/api/health/backend");
        if (!res.ok) throw new Error("Backend unreachable");

        const data: BackendHealthResponse = await res.json();

        setDown(false);
        setStatus(data.status);
        setBackendLastUpdate(data.utc_time);

      } catch {
        setDown(true);
        setStatus(null);
      }

      timeout = setTimeout(
        check,
        Math.random() * (maxDelay - minDelay) + minDelay
      );
    };

    check();
    return () => clearTimeout(timeout);
  }, [minDelay, maxDelay]);

  return { isDown, status, backendLastUpdate };
}
