"use client";

import React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DrawerClose,
  DrawerDescription,
  DrawerFooter,
} from "@/components/ui/drawer";
import GitHubStarBanner from "@/components/GitHubStarBanner";
import { Download } from "lucide-react";
import type { LocalPdfFile } from "@/lib/pdfWorkspace";

interface CompressedFilesDrawerProps {
  localPdfFiles?: LocalPdfFile[];
  onDownloadLocalPdf?: (file: LocalPdfFile) => void;
  converted: string[];
  /** How long the job took on the server, when known. */
  durationSeconds?: number | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onDownloadAll: () => void;
  onDownloadFile: (fileName: string) => void;
}

const CompressedFilesDrawer: React.FC<CompressedFilesDrawerProps> = ({
  localPdfFiles = [],
  onDownloadLocalPdf,
  converted,
  durationSeconds = null,
  isOpen,
  onOpenChange,
  onDownloadAll,
  onDownloadFile,
}) => {
  const { t } = useTranslation();
  const count = converted.length + localPdfFiles.length;
  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange}>
      <DrawerTrigger asChild>
        <Button type="button" variant="secondary" className="mt-8" data-testid="results-drawer-trigger">
          {localPdfFiles.length ? t("pdfWorkspace.filesTrigger", { count }) : t("drawer.trigger", { count })}
        </Button>
      </DrawerTrigger>
      <DrawerContent className="border-0">
        <div className="mx-auto w-full max-w-sm">
          <DrawerHeader>
            <DrawerTitle className="text-lg font-semibold leading-none tracking-tight text-center">
              {localPdfFiles.length ? t("pdfWorkspace.filesTitle") : t("drawer.title", { count })}
            </DrawerTitle>
            <DrawerDescription className="text-center">
              {localPdfFiles.length ? t("pdfWorkspace.filesDescription") : t("drawer.description", { count })}
            </DrawerDescription>
            {durationSeconds !== null && (
              <p className="text-center text-sm text-muted-foreground" data-testid="job-duration">
                {t("drawer.doneIn", { time: formatDuration(durationSeconds, t) })}
              </p>
            )}
          </DrawerHeader>
          {converted.length > 0 && <GitHubStarBanner compressionId={converted.join(",")} />}
          <div className="p-1 pb-0 flex flex-col items-center">
            {converted.length > 1 && (
              <div className="text-center p-5">
                <Button variant="default" onClick={onDownloadAll} data-testid="drawer-download-all-as-zip-btn">
                  {t("drawer.downloadAll")}
                </Button>
              </div>
            )}
          </div>
          <div className="p-4 pb-0">
            <div className="overflow-y-auto max-h-40">
              <ul className="space-y-2">
                {localPdfFiles.map((file) => <li key={file.id} className="rounded-lg border p-3" data-testid="drawer-local-pdf"><button type="button" onClick={() => onDownloadLocalPdf?.(file)} className="flex max-w-full items-center gap-2 text-blue-600 hover:underline dark:text-blue-400" data-testid="drawer-local-pdf-download"><Download className="h-4 w-4 shrink-0" /><span className="truncate">{file.filename}</span></button></li>)}
                {converted.map((fname) => (
                  <li key={fname} className="text-center" data-testid="drawer-uploaded-file-item">
                    <button
                      type="button"
                      data-testid="drawer-uploaded-file-item-link"
                      onClick={() => onDownloadFile(fname)}
                      className="text-blue-400 underline"
                    >
                      {fname}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="pt-10">
            <DrawerFooter>
              <DrawerClose asChild>
                <Button
                  variant="destructive"
                  data-testid="compressed-files-drawer-close-btn"
                >
                  {t("drawer.close")}
                </Button>
              </DrawerClose>
            </DrawerFooter>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default CompressedFilesDrawer;

function formatDuration(
  seconds: number,
  t: (key: string, options?: Record<string, unknown>) => string
): string {
  const total = Math.max(1, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  if (minutes === 0) return t("drawer.durationSeconds", { seconds: rest });
  return t("drawer.durationMinutes", { minutes, seconds: rest });
}
