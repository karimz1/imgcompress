import { useState, useCallback  } from "react";
import { InternetHealthResponse } from "@/models/InternetHealthResponse";
export function useInternetHealth() {
  const [hasInternet, setHasInternet] = useState<boolean | null>(null);
  const [internetLastUpdate, setInternetLastUpdate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const checkInternet = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/health/internet");
      if (!res.ok) throw new Error("Internet Backend Route unreachable");

      const data: InternetHealthResponse = await res.json();
      setHasInternet(data.internet);
      setInternetLastUpdate(data.utc_time);
    } catch {
      setHasInternet(false);
      setInternetLastUpdate(null);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    hasInternet,
    lastUpdate: internetLastUpdate,
    loading,
    checkInternet
  };
}
