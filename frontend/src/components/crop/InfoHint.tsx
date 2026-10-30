"use client";

import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Small ⓘ next to a label: the technical term and one sentence about it.
 * Opens on hover and keyboard focus, and on tap for touch screens.
 */
export function InfoHint({
  term,
  text,
  testId,
}: {
  term: string;
  text: string;
  testId?: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={t("crop.fit.info.label", { term })}
            aria-describedby={id}
            onClick={(e) => {
              e.preventDefault();
              setOpen((was) => !was);
            }}
            className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full opacity-60 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            data-testid={testId}
          >
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-64 text-xs leading-snug"
          data-testid={testId ? `${testId}-tip` : undefined}
        >
          <span className="font-semibold">{term}:</span> {text}
        </TooltipContent>
      </Tooltip>
      <span id={id} className="sr-only">
        {term}: {text}
      </span>
    </TooltipProvider>
  );
}
