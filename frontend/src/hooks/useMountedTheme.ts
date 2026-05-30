"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

export function useMountedTheme(): { mounted: boolean; isDarkTheme: boolean } {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { resolvedTheme } = useTheme();
  return {
    mounted,
    isDarkTheme: mounted ? resolvedTheme !== "light" : true,
  };
}
