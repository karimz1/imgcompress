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

interface CompressedFilesDrawerProps {
  converted: string[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onDownloadAll: () => void;
  onDownloadFile: (fileName: string) => void;
}

const CompressedFilesDrawer: React.FC<CompressedFilesDrawerProps> = ({
  converted,
  isOpen,
  onOpenChange,
  onDownloadAll,
  onDownloadFile,
}) => {
  const { t } = useTranslation();
  const count = converted.length;
  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange}>
      <DrawerTrigger asChild>
        <Button variant="secondary" className="mt-8">
          {t("drawer.trigger", { count })}
        </Button>
      </DrawerTrigger>
      <DrawerContent className="border-0">
        <div className="mx-auto w-full max-w-sm">
          <DrawerHeader>
            <DrawerTitle className="text-lg font-semibold leading-none tracking-tight text-center">
              {t("drawer.title", { count })}
            </DrawerTitle>
            <DrawerDescription className="text-center">
              {t("drawer.description", { count })}
            </DrawerDescription>
          </DrawerHeader>
          <GitHubStarBanner compressionId={converted.join(",")} />
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
