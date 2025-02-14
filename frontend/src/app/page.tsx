"use client";

import React, { useState, useCallback } from "react";
import Image from "next/image";
import { useDropzone } from "react-dropzone";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { DownloadZipToast } from "@/components/CustomToast";


import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { HardDrive } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";


import FileConversionForm from "@/components/FileConversionForm";
import CompressedFilesDrawer from "@/components/CompressedFilesDrawer";
import FileManager from "@/components/StorageFileManager";
import { VisuallyHidden } from "@/components/visually-hidden";
import PageFooter from "@/components/PageFooter";
import BackendStatusBanner from "@/components/BackendStatusBanner";
import ErrorModal from "@/components/ErrorModal"; 


import { allowedExtensions } from "@/lib/constants";


import { ErrorStoreProvider, useErrorStore } from "@/context/ErrorStore";


import { useBackendHealth } from "@/hooks/useBackendHealth";

const acceptObject = {
  "image/*": allowedExtensions,
};

function HomePageContent() {
  
  const [quality, setQuality] = useState("85");
  const [width, setWidth] = useState("");
  const [resizeWidthEnabled, setResizeWidthEnabled] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [converted, setConverted] = useState<string[]>([]);
  const [destFolder, setDestFolder] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [outputFormat, setOutputFormat] = useState("jpeg");

  
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [fileManagerOpen, setFileManagerOpen] = useState(false);
  const [fileManagerRefresh, setFileManagerRefresh] = useState(0);

  
  const { error, setError, clearError } = useErrorStore();

  
  const backendDown = useBackendHealth();

  
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      clearError();
      setConverted([]);
      setDestFolder("");
      const filteredFiles = acceptedFiles.filter((file) => {
        const ext = file.name.split(".").pop()?.toLowerCase();
        if (ext && allowedExtensions.includes(`.${ext}`)) {
          return true;
        } else {
          toast.warn(`File type not allowed: ${file.name}`);
          return false;
        }
      });
      if (filteredFiles.length < acceptedFiles.length) {
        setError({
          message: "Some files were rejected due to unsupported file types.",
        });
      }
      setFiles((prev) => [...prev, ...filteredFiles]);
    },
    [clearError, setError]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled: isLoading,
    accept: acceptObject,
    multiple: true,
  });

  
  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (files.length === 0) {
        setError({ message: "Please drop or select some files first." });
        toast.error("Please drop or select some files first.");
        return;
      }
      if (outputFormat === "jpeg") {
        const qualityNum = parseInt(quality, 10);
        if (isNaN(qualityNum) || qualityNum < 1 || qualityNum > 100) {
          setError({ message: "Quality must be a number between 1 and 100." });
          toast.error("Quality must be a number between 1 and 100.");
          return;
        }
      }
      if (resizeWidthEnabled) {
        const widthNum = parseInt(width, 10);
        if (isNaN(widthNum) || widthNum <= 0) {
          setError({ message: "Width must be a positive number." });
          toast.error("Width must be a positive number.");
          return;
        }
      }
      setIsLoading(true);
      clearError();
      setConverted([]);
      setDestFolder("");

      const formData = new FormData();
      files.forEach((file) => formData.append("files[]", file));
      if (outputFormat === "jpeg") {
        formData.append("quality", quality);
      }
      if (resizeWidthEnabled) {
        formData.append("width", width);
      }
      formData.append("format", outputFormat);

      try {
        const res = await fetch("/api/compress", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) {
          const err = await res.json();
          setError({
            message: err.error || "Error uploading files.",
            details: err.message || undefined,
            isApiError: true,
          });
          toast.error(err.error || "Error uploading files.");
          return;
        }
        const data = await res.json();
        setConverted(data.converted_files);
        setDestFolder(data.dest_folder);
        setDrawerOpen(true);
        await delay(600);
        toast.success(
          `${data.converted_files.length} Image${data.converted_files.length > 1 ? "s" : ""} compressed successfully!`
        );
      } catch (err) {
        console.error(err);
        setError({
          message: "Something went wrong. Please try again.",
          details: err instanceof Error ? err.message : undefined,
          isApiError: true,
        });
        toast.error("Something went wrong. Please try again.");
      } finally {
        setIsLoading(false);
      }
    },
    [files, outputFormat, quality, resizeWidthEnabled, width, clearError, setError]
  );

  const clearFileSelection = useCallback(() => {
    setFiles([]);
    toast.info(`${files.length} Image${files.length !== 1 ? "s" : ""} selection cleared! 🧹`);
  }, [files]);

  const removeFile = useCallback((fileName: string) => {
    setFiles((prev) => prev.filter((f) => f.name !== fileName));
  }, []);

  const handleDownloadAll = useCallback(() => {
    window.location.href = `/api/download_all?folder=${encodeURIComponent(destFolder)}`;
    toast(<DownloadZipToast />);
  }, [destFolder]);

  
  const onForceCleanCallback = useCallback(async () => {
    try {
      const res = await fetch("/api/force_cleanup", { method: "POST" });
      const json = await res.json();
      if (json.status === "ok") {
        toast.success("Deletion Complete. Your processed files have been permanently removed. 🧹🧹🧹");
        setConverted([]);
        setDestFolder("");
        setDrawerOpen(false);
        setFileManagerRefresh((prev) => prev + 1);
      } else {
        toast.error(json.error || "Force cleanup failed.");
      }
    } catch (error) {
      toast.error("🚨 Cleanup failed.");
      console.error(error);
    }
  }, [setFileManagerRefresh]);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-50 flex flex-col">
      {}
      <BackendStatusBanner backendDown={backendDown} />

      <div className="p-4 flex-grow flex flex-col items-center">
        <ToastContainer />

        {}
        <Card className="w-full max-w-xl">
          <CardTitle className="text-center pt-5">An Image Compression Tool</CardTitle>
          <CardHeader>
            <Image
              src="/mascot.jpg"
              width={600}
              height={600}
              alt="Mascot of ImgCompress a Tool by Karim Zouine"
            />
            <Separator />
          </CardHeader>
          <CardContent>
            <FileConversionForm
              isLoading={isLoading}
              error={error}
              quality={quality}
              setQuality={setQuality}
              width={width}
              setWidth={setWidth}
              resizeWidthEnabled={resizeWidthEnabled}
              setResizeWidthEnabled={setResizeWidthEnabled}
              outputFormat={outputFormat}
              setOutputFormat={setOutputFormat}
              files={files}
              removeFile={removeFile}
              clearFileSelection={clearFileSelection}
              onSubmit={handleSubmit}
              getRootProps={getRootProps}
              getInputProps={getInputProps}
              isDragActive={isDragActive}
            />
          </CardContent>
        </Card>

        {}
        <div className="fixed bottom-4 right-4">
          <button
            disabled={isLoading}
            onClick={() => setFileManagerOpen(true)}
            data-testid="storage-management-btn"
            className={`rounded-full p-3 shadow-lg hover:shadow-xl ${
              isLoading ? "opacity-50 cursor-not-allowed" : "bg-blue-500"
            }`}
          >
            <HardDrive className="h-6 w-6" />
          </button>
        </div>

        {}
        <Drawer open={fileManagerOpen} onOpenChange={setFileManagerOpen}>
          <DrawerTrigger asChild>
            <button className="hidden" />
          </DrawerTrigger>
          <DrawerContent className="bg-zinc-950 border-0">
            <VisuallyHidden>
              <DrawerHeader>
                <DrawerTitle className="text-lg font-semibold text-white text-center">
                  Admin Tools
                </DrawerTitle>
              </DrawerHeader>
            </VisuallyHidden>
            <div className="p-4">
              <FileManager onForceClean={onForceCleanCallback} key={fileManagerRefresh} />
            </div>
          </DrawerContent>
        </Drawer>

        {}
        {converted.length > 0 && (
          <CompressedFilesDrawer
            converted={converted}
            destFolder={destFolder}
            isOpen={drawerOpen}
            onOpenChange={setDrawerOpen}
            onDownloadAll={handleDownloadAll}
          />
        )}

        {}
        <ErrorModal />

        <PageFooter />
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <ErrorStoreProvider>
      <TooltipProvider delayDuration={0}>
        <HomePageContent />
      </TooltipProvider>
    </ErrorStoreProvider>
  );
}
