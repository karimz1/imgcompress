import { useEffect, useState } from "react";


export function useBackendHealth(minDelay: number = 5000, maxDelay: number = 15000): boolean {
  const [backendDown, setBackendDown] = useState(false);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const checkHealth = async () => {
      try {
        const res = await fetch("/api/health/live");
        if (!res.ok) {
          setBackendDown(true);
        } else {
          setBackendDown(false);
        }
      } catch{
        setBackendDown(true);
      }

      
      const randomDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
      timeoutId = setTimeout(checkHealth, randomDelay);
    };

    checkHealth();

    return () => clearTimeout(timeoutId);
  }, [minDelay, maxDelay]);

  return backendDown;
}
