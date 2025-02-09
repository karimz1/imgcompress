"use client";

import React from "react";

interface BackendStatusBannerProps {
  backendDown: boolean;
}

export default function BackendStatusBanner({ backendDown }: BackendStatusBannerProps) {
  if (!backendDown) return null;

  return (
    <div data-testid="backend-down-status-banner" className="w-full bg-red-600 text-white text-center p-2">
      Warning: Backend is currently unavailable.
    </div>
  );
}
