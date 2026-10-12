"use client";

import { useState } from "react";
import { FileText, Spline } from "lucide-react";
import { useTranslation } from "react-i18next";
import { inputFileKind } from "@/lib/inputFileKind";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function InputFileBadge({ filename }: { filename: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const kind = inputFileKind(filename);
  if (kind === "image") return null;
  const isDocument = kind === "document";
  const Icon = isDocument ? FileText : Spline;
  const label = t(isDocument ? "form.fileTypes.document" : "form.fileTypes.vectorGraphic");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid="input-file-kind-badge"
          data-file-kind={kind}
          className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-full border border-blue-500/25 bg-blue-500/10 px-2 py-0.5 font-sans text-xs font-medium text-blue-800 hover:bg-blue-500/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:text-blue-200"
        >
          <Icon aria-hidden="true" className="h-3.5 w-3.5" />
          <span className="underline decoration-dotted underline-offset-2">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        data-testid="input-file-kind-details"
        data-file-kind-details=""
        aria-label={label}
        onEscapeKeyDown={(event) => {
          event.stopImmediatePropagation();
          event.preventDefault();
          setOpen(false);
        }}
        className="max-w-[calc(100vw-2rem)] space-y-2 border-slate-200 bg-white font-sans text-sm leading-relaxed text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
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
      </PopoverContent>
    </Popover>
  );
}
