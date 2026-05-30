"use client";

import { useEffect } from "react";
import { installFrontendLogCapture } from "@/lib/logBuffer";

export function LogCaptureBootstrap() {
  useEffect(() => {
    installFrontendLogCapture();
  }, []);
  return null;
}
