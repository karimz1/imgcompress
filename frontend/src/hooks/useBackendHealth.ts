import { useEffect, useState } from "react";


export interface HealthResponse {
  utc_time: string;
  internet: boolean;
  status: string;
}

export function useBackendHealth(
  minDelay: number = 5000,
  maxDelay: number = 15000
) {
  const [isDown, setDown] = useState(false);
  const [hasInternet, setInternet] = useState<boolean | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  useEffect(() => {
    let timeout: NodeJS.Timeout;

    const check = async () => {
      try {
        const res = await fetch("/api/health/live");
        if (!res.ok) throw new Error("Backend unreachable");

        const data: HealthResponse = await res.json();

        setDown(false);
        setInternet(data.internet);
        setStatus(data.status);
        setLastUpdate(data.utc_time);

      } catch {
        setDown(true);
        setInternet(null);
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

  return { isDown, hasInternet, status, lastUpdate };
}
