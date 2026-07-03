import { useCallback } from "react";
import type { ReactNode } from "react";
import { toast } from "react-toastify";
import { fetchDownload } from "@/lib/download";
import { useDownloadError } from "@/context/DownloadErrorStore";

interface DownloadRequest {
  url: string;
  fileName: string;
  successToast: ReactNode;
  onUnavailable?: () => void;
}

/**
 * Single entry point for downloads: saves the file, or shows the shared
 * "file no longer here" dialog when the server no longer has it. `onUnavailable`
 * lets a caller add its own cleanup (drop stale list, refresh listing, ...).
 */
export function useDownload() {
  const { notifyDownloadUnavailable } = useDownloadError();

  return useCallback(
    async ({ url, fileName, successToast, onUnavailable }: DownloadRequest) => {
      if (await fetchDownload(url, fileName)) {
        toast(successToast);
        return;
      }
      notifyDownloadUnavailable();
      onUnavailable?.();
    },
    [notifyDownloadUnavailable]
  );
}
