"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Trash } from "lucide-react";
import { toast } from "react-toastify";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";

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

export default function FileManager() {
  const [data, setData] = useState<ContainerData | null>(null);
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [forceCleaning, setForceCleaning] = useState(false);

  const fetchContainerFiles = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/container_files");
      const json = await res.json();
      setData(json);
    } catch (error) {
      toast.error("Failed to fetch container files.");
    } finally {
      setLoading(false);
    }
  };

  const fetchStorageInfo = async () => {
    try {
      const res = await fetch("/api/storage_info");
      const json = await res.json();
      setStorage(json);
    } catch (error) {
      toast.error("Failed to fetch storage info.");
    }
  };

  const handleForceCleanup = async () => {
    setForceCleaning(true);
    try {
      const res = await fetch("/api/force_cleanup", { method: "POST" });
      const json = await res.json();
      if (json.status === "ok") {
        toast.success("Forced cleanup completed.");
        fetchContainerFiles(); // refresh view
      } else {
        toast.error(json.error || "Force cleanup failed.");
      }
    } catch (error) {
      toast.error("Force cleanup failed.");
    } finally {
      setForceCleaning(false);
    }
  };

  useEffect(() => {
    fetchContainerFiles();
    fetchStorageInfo();
  }, []);

  // Simple progress bars for file counts
  const maxCount = Math.max(100, data?.total_count || 0);
  const maxSize = Math.max(100, data?.total_size_mb || 0);
  const countPercent = data ? Math.min((data.total_count / maxCount) * 100, 100) : 0;
  const sizePercent = data ? Math.min((data.total_size_mb / maxSize) * 100, 100) : 0;

  return (
    <Card className="w-full max-w-2xl mx-auto mt-4">
      <CardHeader>
        <CardTitle className="text-center">File Manager</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Display storage info if available */}
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
              <Progress value={(storage.used_storage_mb / storage.total_storage_mb) * 100} className="h-3" />
            </div>
          </div>
        )}

        <Tabs defaultValue="files" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="files">Files</TabsTrigger>
            <TabsTrigger value="chart">Usage Chart</TabsTrigger>
          </TabsList>
          <TabsContent value="files" className="mt-4">
            {loading ? (
              <div className="flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : data?.files?.length ? (
              <div className="space-y-2">
                {data.files.map((file, index) => (
                  <div key={index} className="flex justify-between bg-gray-800 rounded-md p-2">
                    <span>
                      <strong className="text-xs text-gray-400">{file.filename}</strong>{" "}
                      <span className="text-xs text-gray-400">({file.size_mb} MB)</span>
                    </span>
                    <span className="text-xs text-gray-400">{file.folder}</span>
                  </div>
                ))}
                <div className="mt-2 text-sm text-gray-400">
                  <p>
                    Total Files: <strong>{data.total_count}</strong>
                  </p>
                  <p>
                    Total Space Used: <strong>{data.total_size_mb} MB</strong>
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-center text-gray-400">No converted files found.</p>
            )}
            
          </TabsContent>
          <TabsContent value="chart" className="mt-4">
            {data ? (
              <div className="space-y-6">
                <div>
                  <p className="mb-1 text-sm font-medium text-gray-400">
                    Total Files: <span className="text-white">{data.total_count}</span>
                  </p>
                  <Progress value={countPercent} className="h-3" />
                </div>
                <div>
                  <p className="mb-1 text-sm font-medium text-gray-400">
                    Total MB Used: <span className="text-white">{data.total_size_mb}</span>
                  </p>
                  <Progress value={sizePercent} className="h-3" />
                </div>
              </div>
            ) : (
              <p className="text-center text-gray-400">No data to display.</p>
            )}
          </TabsContent>
        </Tabs>
        <div className="mt-4 flex justify-end">
          <Button variant="destructive" onClick={handleForceCleanup} disabled={forceCleaning}>
            {forceCleaning ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cleaning...
              </div>
            ) : (
              <Trash className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
