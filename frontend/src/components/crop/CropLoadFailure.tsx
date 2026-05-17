"use client";

import React from "react";
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

function causesFor(file: File, message: string): string[] {
  const causes: string[] = [];
  const lower = message.toLowerCase();

  if (lower.includes("/api/crop/bitmap is not available") || lower.includes("404")) {
    causes.push(
      "The backend service isn't reachable yet. If you just rebuilt the container, give it a few seconds to come up and try again."
    );
  }
  if (lower.includes("network") || lower.includes("failed to fetch")) {
    causes.push(
      "The connection to the backend dropped mid-upload. Check that the container is still running and try again."
    );
  }
  if (lower.includes("not compatible") || lower.includes("could not decode")) {
    causes.push(
      `This file may be a ${fileFormatLabel(file)} variant the decoder can't read (multi-layer, non-standard color mode, encrypted, etc.). Re-exporting from the source app as a flat ${fileFormatLabel(
        file
      )} or a regular PNG / JPG usually fixes this.`
    );
  }
  if (!isBrowserNativeFormat(file)) {
    causes.push(
      `${fileFormatLabel(
        file
      )} files always go through the backend's decoder. If the decoder is missing native libraries (e.g. libheif for HEIC), the build may have skipped them — re-running the build with the optional codecs enabled usually resolves it.`
    );
  }
  causes.push(
    "If none of the above fits, copy the technical details below and open a ticket — the trace shows exactly which step failed."
  );
  return causes;
}

export const CropLoadFailure: React.FC<CropLoadFailureProps> = ({
  file,
  message,
  details,
  onDiscard,
  onReport,
}) => {
  const label = fileFormatLabel(file);
  const causes = causesFor(file, message);

  return (
    <div
      className="flex-1 min-h-0 flex flex-col items-center justify-center gap-3 p-6 text-center"
      data-testid="crop-load-failure"
    >
      <div className="flex items-center gap-2 text-red-500">
        <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        <p className="text-sm font-medium">
          Couldn&apos;t prepare this {label} for cropping.
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
          Why did this happen?
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
          <summary className="cursor-pointer">Technical details</summary>
          <pre className="mt-1 whitespace-pre-wrap break-all">{details}</pre>
        </details>
      )}

      <p className="text-xs opacity-60 max-w-md">
        You can still convert this file as-is. It just won&apos;t have a crop
        applied.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onDiscard}
          data-testid="crop-load-failure-close-btn"
        >
          Close
        </Button>
        {onReport && (
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => onReport({ message, details })}
            data-testid="crop-load-failure-report-btn"
          >
            Report this issue
          </Button>
        )}
      </div>
    </div>
  );
};
