"use client";

import React from "react";
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
import { pluralize } from "@/lib/helpers";

interface CompressedFilesDrawerProps {
  converted: string[];
  destFolder: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onDownloadAll: () => void;
}

const CompressedFilesDrawer: React.FC<CompressedFilesDrawerProps> = ({
  converted,
  destFolder,
  isOpen,
  onOpenChange,
  onDownloadAll,
}) => {
  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange}>
      <DrawerTrigger asChild>
        <Button variant="secondary" className="mt-8">
          🗃️ Show Compressed {pluralize(converted.length, "Image", "Images")}
        </Button>
      </DrawerTrigger>
      <DrawerContent className="bg-zinc-950 dark:bg-white border-0">
        <div className="mx-auto w-full max-w-sm">
          <DrawerHeader>
            <DrawerTitle className="text-lg font-semibold leading-none tracking-tight text-white text-center">
              Compressed {pluralize(converted.length, "Image", "Images")}
            </DrawerTitle>
            <DrawerDescription className="text-center text-gray-500">
              Download your compressed {pluralize(converted.length, "Image", "Images")} individually or all at once.
            </DrawerDescription>
          </DrawerHeader>
          <div className="p-1 pb-0 flex flex-col items-center">
            {converted.length > 1 && (
              <div className="text-center p-5">
                <Button variant="secondary" onClick={onDownloadAll}>
                  Download All as Zip
                </Button>
              </div>
            )}
          </div>
          <div className="p-4 pb-0">
            <div className="overflow-y-auto max-h-40">
              <ul className="space-y-2">
                {converted.map((fname) => (
                  <li key={fname} className="text-center">
                    <a
                      href={`/api/download?folder=${encodeURIComponent(
                        destFolder
                      )}&file=${encodeURIComponent(fname)}`}
                      className="text-blue-400 underline"
                    >
                      {fname}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="pt-10">
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="destructive">Close</Button>
              </DrawerClose>
            </DrawerFooter>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default CompressedFilesDrawer;
