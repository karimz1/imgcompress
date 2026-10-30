"use client";

import { useRef, useState } from "react";
import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { inputFileKind } from "@/lib/inputFileKind";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function InputFileBadge({ filename }: { filename: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const openOnPointerDown = useRef(false);
  const kind = inputFileKind(filename);
  if (kind === "image") return null;
  const isDocument = kind === "document";
  const label = t(isDocument ? "form.fileTypes.document" : "form.fileTypes.vectorGraphic");

  return (
    <TooltipProvider delayDuration={250}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <button
            type="button"
            data-testid="input-file-kind-badge"
            data-file-kind={kind}
            aria-label={label}
            onPointerDown={() => { openOnPointerDown.current = open; }}
            onFocus={(event) => {
              // Avoid opening tooltip simply because element received focus (e.g. on modal mount)
              event.preventDefault();
            }}
            onClick={(event) => {
              // Keep tap-to-toggle; Radix otherwise closes tooltips on click.
              event.preventDefault();
              setOpen(event.detail === 0 || !openOnPointerDown.current);
            }}
            className="inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-current opacity-75 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 data-[state=delayed-open]:opacity-100 data-[state=instant-open]:opacity-100"
          >
            <Info aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          data-testid="input-file-kind-details"
          data-file-kind-details=""
          side="bottom"
          collisionPadding={12}
          onEscapeKeyDown={(event) => {
            event.stopImmediatePropagation();
            event.preventDefault();
            setOpen(false);
          }}
          className="pointer-events-auto z-[60] w-72 max-w-[calc(100vw-2rem)] space-y-2 border-slate-200 bg-white p-4 font-sans text-sm leading-relaxed text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          <p className="font-medium">{label}</p>
          {isDocument ? (
            <p>{t("form.documentInfo.description")}</p>
          ) : (
            <>
              <p>{t("form.vectorInfo.description")}</p>
              <p>{t(kind === "svg" ? "form.vectorInfo.sharpResize" : "form.vectorInfo.pixelResize")}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t("form.vectorInfo.downloadHint")}
              </p>
            </>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
