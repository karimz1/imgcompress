"use client";

import React from "react";
import { useTranslation } from "react-i18next";

interface BackendStatusBannerProps {
  backendDown: boolean;
}

export default function BackendStatusBanner({ backendDown }: BackendStatusBannerProps) {
  const { t } = useTranslation();

  if (!backendDown) return null;

  return (
    <div data-testid="backend-down-status-banner" className="w-full bg-red-600 text-white text-center p-2">
      {t("statusBanner.warning")}
    </div>
  );
}
