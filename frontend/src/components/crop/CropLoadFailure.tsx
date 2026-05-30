"use client";

import React from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, ChevronDown, ServerCrash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fileFormatLabel, isBrowserNativeFormat } from "@/lib/crop";

interface CropLoadFailureProps {
  file: File;
  message: string;
  details?: string;
  onDiscard: () => void;
  onReport?: (payload: { message: string; details?: string }) => void;
}

export const CropLoadFailure: React.FC<CropLoadFailureProps> = ({
  file,
  message,
  details,
  onDiscard,
  onReport,
}) => {
  const { t } = useTranslation();
  const label = fileFormatLabel(file);
  const lower = message.toLowerCase();

  const causes: string[] = [];
  if (lower.includes("/api/crop/bitmap is not available") || lower.includes("404")) {
    causes.push(t("crop.failure.causes.backendNotReachable"));
  }
  if (lower.includes("network") || lower.includes("failed to fetch")) {
    causes.push(t("crop.failure.causes.networkDropped"));
  }
  if (lower.includes("not compatible") || lower.includes("could not decode")) {
    causes.push(t("crop.failure.causes.variantNotSupported", { label }));
  }
  if (!isBrowserNativeFormat(file)) {
    causes.push(t("crop.failure.causes.missingLibraries", { label }));
  }
  causes.push(t("crop.failure.causes.reportIssue"));

  return (
    <div
      className="flex-1 min-h-0 flex flex-col items-center justify-center gap-3 p-6 text-center"
      data-testid="crop-load-failure"
    >
      <div className="flex items-center gap-2 text-red-500">
        <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        <p className="text-sm font-medium">
          {t("crop.failure.header", { label })}
        </p>
      </div>

      <p
        className="text-xs opacity-70 max-w-md break-words"
        data-testid="crop-load-failure-message"
      >
        {message}
      </p>

      <details
        className="text-xs opacity-80 max-w-md w-full text-left rounded-md border border-current/20 bg-current/5 px-3 py-2"
        data-testid="crop-load-failure-causes"
        open
      >
        <summary className="cursor-pointer flex items-center gap-1.5 select-none">
          <ServerCrash className="h-3.5 w-3.5" aria-hidden="true" />
          {t("crop.failure.whyTitle")}
          <ChevronDown className="h-3 w-3 ml-auto opacity-60" aria-hidden="true" />
        </summary>
        <ul className="mt-2 space-y-1.5 list-disc pl-4 leading-relaxed">
          {causes.map((cause, i) => (
            <li key={i}>{cause}</li>
          ))}
        </ul>
      </details>

      {details && (
        <details
          className="text-xs opacity-60 max-w-md text-left"
          data-testid="crop-load-failure-details"
        >
          <summary className="cursor-pointer">{t("crop.failure.technicalDetails")}</summary>
          <pre className="mt-1 whitespace-pre-wrap break-all">{details}</pre>
        </details>
      )}

      <p className="text-xs opacity-60 max-w-md">
        {t("crop.failure.stillConvert")}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onDiscard}
          data-testid="crop-load-failure-close-btn"
        >
          {t("crop.failure.closeButton")}
        </Button>
        {onReport && (
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => onReport({ message, details })}
            data-testid="crop-load-failure-report-btn"
          >
            {t("crop.failure.reportButton")}
          </Button>
        )}
      </div>
    </div>
  );
};
