"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import DownloadUnavailableDialog from "@/components/DownloadUnavailableDialog";

interface DownloadErrorContextProps {
  /** Show the shared "file no longer available" dialog. */
  notifyDownloadUnavailable: () => void;
}

const DownloadErrorContext = createContext<DownloadErrorContextProps | undefined>(
  undefined
);

/**
 * Owns the single "file no longer here" dialog so every download entry point
 * (compressed-files drawer, storage manager, ...) surfaces the same UI instead
 * of navigating to the raw JSON error.
 */
export const DownloadErrorProvider = ({ children }: { children: ReactNode }) => {
  const [open, setOpen] = useState(false);
  const notifyDownloadUnavailable = useCallback(() => setOpen(true), []);

  return (
    <DownloadErrorContext.Provider value={{ notifyDownloadUnavailable }}>
      {children}
      <DownloadUnavailableDialog open={open} onOpenChange={setOpen} />
    </DownloadErrorContext.Provider>
  );
};

export const useDownloadError = (): DownloadErrorContextProps => {
  const context = useContext(DownloadErrorContext);
  if (!context) {
    throw new Error(
      "useDownloadError must be used within a DownloadErrorProvider"
    );
  }
  return context;
};
