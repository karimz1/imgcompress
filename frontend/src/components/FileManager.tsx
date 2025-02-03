"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Trash, HardDrive } from "lucide-react";
import { toast } from "react-toastify";
import { Progress } from "@/components/ui/progress";

// Import AlertDialog components from shadcn/ui
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

  // Fetch container files from the backend
  const fetchContainerFiles = async () => {
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
  };

  // Fetch storage info from the backend
  const fetchStorageInfo = async () => {
    try {
      const res = await fetch("/api/storage_info");
      const json = await res.json();
      setStorage(json);
    } catch (error) {
      toast.error("Failed to fetch storage info.");
      console.error(error);
    }
  };

  useEffect(() => {
    fetchContainerFiles();
    fetchStorageInfo();
  }, []);

  return (
    <Card className="w-full max-w-2xl mx-auto mt-4">
      <CardHeader className="flex flex-col">
        <CardTitle className="text-center">
          <div className="flex items-center justify-center gap-2">
            <HardDrive className="h-4 w-4" />
            <span>Storage Management</span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Storage Information */}
        {storage && (
          <div className="mb-4 space-y-2">
            <div className="text-center text-sm text-gray-400">
              <p>
                Total Storage: <strong>{storage.total_storage_mb} MB</strong>
              </p>
              <p>
                Used: <strong>{storage.used_storage_mb} MB</strong> • Available:{" "}
                <strong>{storage.available_storage_mb} MB</strong>
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-gray-400">
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
          {/* Header with centered Files text and Clear Processed Files button on the right */}
          <div className="relative">
            <h2 className="text-lg font-bold text-center">Files</h2>
            <div className="absolute inset-y-0 right-0 flex items-center">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="p-2" title="Clear Processed Files">
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
                {/* Totals displayed above the scrollable container */}
                <div className="mb-4 text-sm text-gray-400 text-center">
                  <p>
                    Total Files: <strong>{data.total_count}</strong>
                  </p>
                  <p>
                    Total Space Used: <strong>{data.total_size_mb} MB</strong>
                  </p>
                </div>
                {/* Scrollable container for the file list */}
                <div className="overflow-y-auto max-h-40 space-y-2">
                  {data.files.map((file, index) => (
                    <div
                      key={index}
                      className="flex justify-between bg-gray-800 rounded-md p-2"
                    >
                      <span>
                        <strong className="text-xs text-gray-400">
                          {file.filename}
                        </strong>{" "}
                        <span className="text-xs text-gray-400">
                          ({file.size_mb} MB)
                        </span>
                        {file.folder === "zip" && (
                          <span className="ml-2 text-xs text-blue-400">(ZIP)</span>
                        )}
                      </span>
                      <span className="text-xs text-gray-400">{file.folder}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-center text-gray-400">
                No converted files found.
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
