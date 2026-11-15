"use client";

import { useEffect, useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SkippedFile } from "@/models/ErrorMessage";
import { formatUploadLimit } from "@/lib/uploadLimit";
import { cn } from "@/lib/utils";

// A folder can hold thousands of files; the list stays scrollable and stops here.
export const MAX_LISTED_SKIPPED_FILES = 100;

/**
 * "Show details" under the skipped-files message: which files were left out,
 * from which folder, and why. Collapsed until asked for.
 */
export function SkippedFilesDetails({ files }: { files: SkippedFile[] }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const listId = useId();
  // Every drop brings a new list, and it starts collapsed again.
  useEffect(() => setOpen(false), [files]);
  if (files.length === 0) return null;
  const listed = files.slice(0, MAX_LISTED_SKIPPED_FILES);
  const hidden = files.length - listed.length;
  const size = formatUploadLimit(i18n.language);

  return (
    <div className="mt-1">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-[44px] items-center gap-1 rounded text-sm font-medium underline underline-offset-2 hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white sm:min-h-0 sm:py-1"
        data-testid="skipped-files-toggle"
      >
        <ChevronDown
          aria-hidden="true"
          className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")}
        />
        {t(open ? "form.error.hideDetails" : "form.error.showDetails")}
      </button>
      {open && (
        <ul
          id={listId}
          aria-label={t("form.error.skippedListLabel")}
          className="mt-1 max-h-48 space-y-1 overflow-y-auto rounded bg-black/15 p-2 text-sm"
          data-testid="skipped-files-list"
        >
          {listed.map((file, index) => (
            <li
              key={`${file.folder}/${file.name}/${index}`}
              className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between sm:gap-3"
              data-testid="skipped-file"
            >
              <span className="min-w-0 break-all">
                {file.folder && (
                  <span className="opacity-75" data-testid="skipped-file-folder">
                    {file.folder}/
                  </span>
                )}
                <span data-testid="skipped-file-name">{file.name}</span>
              </span>
              <span className="shrink-0 text-xs opacity-80" data-testid="skipped-file-reason">
                {file.reason === "tooLarge"
                  ? t("form.error.reasonTooLarge", { size })
                  : t("form.error.reasonUnsupported")}
              </span>
            </li>
          ))}
          {hidden > 0 && (
            <li className="opacity-80" data-testid="skipped-files-more">
              {t("form.error.moreSkipped", { count: hidden })}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
