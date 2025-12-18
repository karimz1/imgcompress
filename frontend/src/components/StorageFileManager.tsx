"use client";

import React, { useEffect, useState, useCallback } from "react";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Trash, HardDrive } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { BackendStatusFloating } from "@/components/BackendStatusFloating";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";


import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ContainerFile {
  folder: string;
  folder_path: string;
  filename: string;
  size_mb: number;
}

interface ContainerData {
  files: ContainerFile[];
  total_size_mb: number;
  total_count: number;
}

interface StorageInfo {
  total_storage_mb: number;
  used_storage_mb: number;
  available_storage_mb: number;
}

interface FileManagerProps {
  onForceClean: () => void;
}

export default function FileManager({ onForceClean }: FileManagerProps) {
  const [data, setData] = useState<ContainerData | null>(null);
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const { resolvedTheme } = useTheme();
  const isDarkTheme = resolvedTheme !== "light";
  const subtleText = isDarkTheme ? "text-gray-400" : "text-slate-500";
  const cardSurface = isDarkTheme
    ? "bg-gray-900/80 border-white/10 text-gray-100"
    : "bg-white border-slate-200 text-slate-900";
  const fileRowClass = isDarkTheme
    ? "bg-gray-800 border border-gray-700 text-gray-100"
    : "bg-slate-100 border border-slate-200 text-slate-900";
  const linkColor = isDarkTheme ? "text-blue-300" : "text-blue-600";

  
  const fetchContainerFiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/container_files");
      const json = await res.json();
      setData(json);
    } catch (error) {
      toast.error("Failed to fetch container files.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  
  const fetchStorageInfo = useCallback(async () => {
    try {
      const res = await fetch("/api/storage_info");
      const json = await res.json();
      setStorage(json);
    } catch (error) {
      toast.error("Failed to fetch storage info.");
      console.error(error);
    }
  }, []);

  useEffect(() => {
    fetchContainerFiles();
    fetchStorageInfo();
  }, [fetchContainerFiles, fetchStorageInfo]);

  return (
    <Card className={cn("w-full max-w-2xl mx-auto mt-4 border transition-colors", cardSurface)}>
      <CardHeader className="flex flex-col">
        <CardTitle className="text-center">
          <div className="flex items-center justify-center gap-2">
            <HardDrive className="h-4 w-4" />
            <span>Storage Management</span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {}
        {storage && (
          <div className="mb-4 space-y-2">
            <div className={cn("text-center text-sm", subtleText)}>
              <p>
                Total Storage: <strong>{storage.total_storage_mb} MB</strong>
              </p>
              <p>
                Used: <strong>{storage.used_storage_mb} MB</strong> • Available:{" "}
                <strong>{storage.available_storage_mb} MB</strong>
              </p>
            </div>
            <div className="space-y-1">
              <p className={cn("text-xs", subtleText)}>
                Storage Usage: {storage.used_storage_mb} MB / {storage.total_storage_mb} MB
              </p>
              <Progress
                value={(storage.used_storage_mb / storage.total_storage_mb) * 100}
                className="h-3"
              />
            </div>
          </div>
        )}

        <div className="w-full">
          {}
          <div className="relative">
            <h2 className="text-lg font-bold text-center">Files</h2>
            <div className="absolute inset-y-0 right-0 flex items-center">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="p-2" title="Clear Processed Files" disabled={data?.files?.length === 0}>
                    <Trash className="h-4 w-4" /> Clear Processed Files
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm File Deletion</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action will permanently delete all processed files. Please ensure you have downloaded any necessary files before proceeding, as this action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={onForceClean}>
                      Yes, Delete Files
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          <div className="mt-4">
            {loading ? (
              <div className="flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : data?.files?.length ? (
              <div>
                {}
                <div className={cn("mb-4 text-sm text-center", subtleText)}>
                  <p>
                    Total Files: <strong>{data.total_count}</strong>
                  </p>
                  <p>
                    Total Space Used: <strong>{data.total_size_mb} MB</strong>
                  </p>
                </div>
                {}
                <div className="overflow-y-auto max-h-40 space-y-2 pr-1">
                  {data.files.map((file, index) => {
                    const downloadUrl = `/api/download?folder=${encodeURIComponent(
                      file.folder_path
                    )}&file=${encodeURIComponent(file.filename)}`;
                    return (
                      <div
                        key={index}
                        className={cn(
                          "flex justify-between rounded-md p-2 text-xs",
                          fileRowClass
                        )}
                      >
                        <span>
                          <a
                            href={downloadUrl}
                            data-testid="storage-management-file-download-link"
                            className={cn("underline", linkColor)}
                            title={`Download ${file.filename}`}
                          >
                            <strong>{file.filename}</strong>
                          </a>{" "}
                          <span className={cn(subtleText)}>
                            ({file.size_mb} MB)
                          </span>
                          {file.folder === "zip" && (
                            <span className={cn("ml-2", linkColor)}>(ZIP)</span>
                          )}
                        </span>
                        <span className={cn(subtleText)}>{file.folder}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className={cn("text-center", subtleText)}>
                No converted files found.
              </p>
            )}
          </div>
        </div>
      </CardContent>
      <BackendStatusFloating />
    </Card>
  );
}
