"use client";

import React, { useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { CropConfig } from "@/lib/crop";
import { BrandLogo } from "@/components/BrandLogo";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import CropWidget, { CropWidgetHandle } from "@/components/CropWidget";

interface CropDialogProps {
  files: File[];
  crops: Record<string, CropConfig>;
  openFileName: string | null;
  setOpenFileName: (name: string | null) => void;
  setCropForFile: (name: string, crop: CropConfig | null) => void;
  confirmRemoveFor: string | null;
  setConfirmRemoveFor: (name: string | null) => void;
  onReportError?: (payload: { message: string; details?: string }) => void;
  isDarkTheme: boolean;
  disableLogo?: boolean;
}

export const CropDialog: React.FC<CropDialogProps> = ({
  files,
  crops,
  openFileName,
  setOpenFileName,
  setCropForFile,
  confirmRemoveFor,
  setConfirmRemoveFor,
  onReportError,
  isDarkTheme,
  disableLogo = false,
}) => {
  const widgetRef = useRef<CropWidgetHandle | null>(null);

  const openFile = useMemo(
    () => (openFileName ? files.find((f) => f.name === openFileName) : null),
    [openFileName, files]
  );

  const closeEditor = () => setOpenFileName(null);

  const confirmRemove = () => {
    if (!confirmRemoveFor) return;
    const removed = confirmRemoveFor;
    setCropForFile(removed, null);
    if (openFile?.name === removed) {
      closeEditor();
      return;
    }
    setConfirmRemoveFor(null);
  };

  const cropDialogContentClass = isDarkTheme
    ? "border-white/10 bg-gradient-to-br from-slate-950/95 via-slate-900/92 to-slate-950/95 text-gray-100 shadow-[0_36px_90px_rgba(15,23,42,0.7)]"
    : "border-slate-200 bg-gradient-to-br from-slate-50/95 via-white/92 to-slate-100/95 text-slate-900 shadow-[0_24px_60px_rgba(15,23,42,0.16)]";

  const cropDialog = openFile ? (
    <Dialog
      open={!!openFile}
      onOpenChange={(open) => {
        if (!open) widgetRef.current?.requestClose();
      }}
    >
      <DialogContent
        className={cn(
          "max-w-[95vw] w-[95vw] sm:max-w-[92vw] lg:max-w-[88vw] xl:max-w-[80vw] h-[92vh] max-h-[92vh] p-3 sm:p-4 flex flex-col gap-3 overflow-hidden border data-[state=open]:slide-in-from-left-0 data-[state=open]:slide-in-from-top-0 data-[state=closed]:slide-out-to-left-0 data-[state=closed]:slide-out-to-top-0 origin-center",
          cropDialogContentClass
        )}
        data-testid="crop-dialog"
      >
        <DialogHeader className="shrink-0">
          <div className="flex items-center gap-3 pr-12">
            {!disableLogo && (
              <BrandLogo
                variant="face"
                alt=""
                width={44}
                height={36}
                style={{ width: "auto", height: "auto" }}
                className="h-9 w-auto max-w-14 object-contain shrink-0 drop-shadow-sm"
              />
            )}
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-sm font-medium leading-tight truncate">
                {!disableLogo && (
                  <>
                    <span className="opacity-70">imgcompress</span>
                    <span className="opacity-40 px-1.5">·</span>
                  </>
                )}
                <span>Crop Editor</span>
                <span className="opacity-40 px-1.5">·</span>
                <span className="opacity-90">{openFile.name}</span>
              </DialogTitle>
              <DialogDescription className="sr-only">
                Adjust the crop region, ratio, and zoom for this image, then click Save Crop or Discard.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <CropWidget
          ref={widgetRef}
          file={openFile}
          initialCrop={crops[openFile.name] ?? null}
          isDarkTheme={isDarkTheme}
          onSave={(cfg) => {
            setCropForFile(openFile.name, cfg);
            closeEditor();
          }}
          onClose={closeEditor}
          onClearCrop={() => setConfirmRemoveFor(openFile.name)}
          onReportError={onReportError}
          disableLogo={disableLogo}
        />
      </DialogContent>
    </Dialog>
  ) : null;

  const removeConfirmDialog = confirmRemoveFor ? (
    <AlertDialog
      open={!!confirmRemoveFor}
      onOpenChange={(open) => {
        if (!open) setConfirmRemoveFor(null);
      }}
    >
      <AlertDialogContent data-testid="crop-remove-confirm-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>Remove saved crop?</AlertDialogTitle>
          <AlertDialogDescription>
            This clears the saved crop for this file. The original file will stay in your conversion list.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="crop-remove-cancel-btn">
            Keep Crop
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={confirmRemove}
            className="bg-red-600 text-white hover:bg-red-700 focus:ring-red-600"
            data-testid="crop-remove-confirm-btn"
          >
            Remove Crop
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ) : null;

  return (
    <>
      {cropDialog}
      {removeConfirmDialog}
    </>
  );
};
