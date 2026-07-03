"use client";

import React from "react";
import { FileX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

interface DownloadUnavailableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DownloadUnavailableDialog: React.FC<DownloadUnavailableDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="border-zinc-800 bg-zinc-950 text-zinc-50"
        data-testid="download-unavailable-dialog"
      >
        <DialogHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 ring-1 ring-amber-500/30 sm:mx-0">
            <FileX className="h-6 w-6 text-amber-400" aria-hidden />
          </div>
          <DialogTitle className="mt-2 text-center sm:text-left">
            {t("downloadError.title")}
          </DialogTitle>
          <DialogDescription className="text-center text-zinc-400 sm:text-left">
            {t("downloadError.description")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button
              variant="secondary"
              data-testid="download-unavailable-dialog-close-btn"
            >
              {t("downloadError.close")}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DownloadUnavailableDialog;
