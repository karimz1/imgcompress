"use client";

import React, { useState, useCallback, useEffect } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useDropzone } from "react-dropzone";
import Image from "next/image";
import { useTheme } from "next-themes";
import { HardDrive } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HelpButton } from "@/components/HelpButton";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { VisuallyHidden } from "@/components/visually-hidden";

import BackendStatusBanner from "@/components/BackendStatusBanner";
import ErrorModal from "@/components/ErrorModal";
import FileManager from "@/components/StorageFileManager";
import CompressedFilesDrawer from "@/components/CompressedFilesDrawer";
import PageFooter from "@/components/PageFooter";
import FileConversionForm from "@/components/FileConversionForm";
import { DownloadZipToast } from "@/components/CustomToast";
import { SplashScreen } from "@/components/SplashScreen";
import { ErrorStoreProvider, useErrorStore } from "@/context/ErrorStore";
import { useBackendHealth } from "@/hooks/useBackendHealth";
import { useSupportedExtensions } from "@/hooks/useSupportedExtensions";
import { cn } from "@/lib/utils";


function HomePageContent() {
  const [disableLogo, setDisableLogo] = useState(false);
  const [configReady, setConfigReady] = useState(false);
  const [storageManagementDisabled, setStorageManagementDisabled] = useState(false);

  useEffect(() => {
    const loadRuntimeConfig = async () => {
      try {
        const res = await fetch("/config/runtime.json");
        if (!res.ok) throw new Error("Config not found");
        const config = await res.json();
        setDisableLogo(config.DISABLE_LOGO === "true");
        const disableStorage =
          config.DISABLE_STORAGE_MANAGEMENT === "true";
        setStorageManagementDisabled(disableStorage);
      } catch (err) {
        console.warn("DISABLE_LOGO config missing or invalid, defaulting to false", err);
        setDisableLogo(false);
        setStorageManagementDisabled(false);
      } finally {
        setConfigReady(true);
      }
    };

    loadRuntimeConfig();
  }, []);

  const {
    supportedExtensions,
    verifiedExtensions,
    isLoading: extensionsLoading,
    error: extensionsError,
  } = useSupportedExtensions();

  const formattedSupportedExtensions = supportedExtensions.map((ext) =>
    ext.startsWith(".") ? ext : `.${ext}`
  );
  const formattedVerifiedExtensions = verifiedExtensions.map((ext) =>
    ext.startsWith(".") ? ext : `.${ext}`
  );

  const [quality, setQuality] = useState("85");
  const [width, setWidth] = useState("");
  const [resizeWidthEnabled, setResizeWidthEnabled] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [converted, setConverted] = useState<string[]>([]);
  const [destFolder, setDestFolder] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [outputFormat, setOutputFormat] = useState("");
  const [formatRequired, setFormatRequired] = useState(false);
  const [targetSizeMB, setTargetSizeMB] = useState("");
  const [compressionMode, setCompressionMode] = useState<"quality" | "size">("quality");
  const [useRembg, setUseRembg] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [fileManagerOpen, setFileManagerOpen] = useState(false);

  const [fileManagerRefresh, setFileManagerRefresh] = useState(0);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  const { error, setError, clearError } = useErrorStore();
  const { isDown } = useBackendHealth();
  const { resolvedTheme } = useTheme();
  const isDarkTheme = resolvedTheme !== "light";
  const backgroundClass = isDarkTheme
    ? "bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-gray-50"
    : "bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900";
  const cardClass = isDarkTheme
    ? "border-white/10 bg-gray-900/80 shadow-[0_45px_120px_rgba(15,23,42,0.85)] text-gray-100"
    : "border-slate-200 bg-white/95 shadow-[0_30px_80px_rgba(15,23,42,0.2)] text-slate-900";
  const cardTitleClass = isDarkTheme
    ? "text-white"
    : "text-slate-900";
  const accentOneClass = isDarkTheme ? "bg-slate-500/10" : "bg-slate-300/15";
  const accentTwoClass = isDarkTheme ? "bg-slate-400/10" : "bg-slate-200/15";

  useEffect(() => {
    if (outputFormat !== "jpeg" && outputFormat !== "avif") {
      setCompressionMode("quality");
      setTargetSizeMB("");
    }
    if (outputFormat !== "png" && outputFormat !== "avif") {
      setUseRembg(false);
    }
    if (outputFormat) {
      setFormatRequired(false);
    }
  }, [outputFormat]);


  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      clearError();
      setConverted([]);
      setDestFolder("");

      const supportedFiles: File[] = [];
      const unsupportedFiles: string[] = [];

      acceptedFiles.forEach((file) => {
        const ext = file.name.split(".").pop()?.toLowerCase();
        if (ext && formattedSupportedExtensions.includes(`.${ext}`)) {
          supportedFiles.push(file);
        } else {
          unsupportedFiles.push(file.name);
        }
      });

      unsupportedFiles.forEach((fileName) => {
        toast.error(`Unsupported File Format: ${fileName}`);
      });

      if (unsupportedFiles.length > 0) {
        setError({
          message: `${unsupportedFiles.length} file(s) were rejected due to unsupported file types.`,
        });
      }

      setFiles((prev) => [...prev, ...supportedFiles]);
    },
    [clearError, setError, formattedSupportedExtensions]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled: isLoading,
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

      if (!outputFormat) {
        setError({ message: "Please select an output format first." });
        toast.error("Please select an output format first.");
        setFormatRequired(true);
        return;
      }

      if ((outputFormat === "jpeg" || outputFormat === "avif") && compressionMode === "quality") {
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

        if (outputFormat === "ico" && widthNum > 256) {
          toast.info(
            "ICO format is limited to a max width of 256px. Your input has been clamped to 256."
          );
          setWidth("256");
        }
      }

      if ((outputFormat === "jpeg" || outputFormat === "avif") && compressionMode === "size") {
        const trimmed = (targetSizeMB || "").trim();
        const t = parseFloat(trimmed);
        if (!trimmed || isNaN(t) || t <= 0) {
          setError({ message: "Please set a positive Max file size (in MB)." });
          toast.error("Please set a positive Max file size (in MB).");
          return;
        }
      }

      setIsLoading(true);
      clearError();
      setConverted([]);
      setDestFolder("");

      const formData = new FormData();
      files.forEach((file) => formData.append("files[]", file));
      if ((outputFormat === "jpeg" || outputFormat === "avif") && compressionMode === "quality") {
        formData.append("quality", quality);
      }
      if (resizeWidthEnabled) {
        formData.append("width", width);
      }
      formData.append("format", outputFormat);
      if ((outputFormat === "jpeg" || outputFormat === "avif") && compressionMode === "size") {
        const kb = Math.round(parseFloat(targetSizeMB) * 1024);
        if (!isNaN(kb) && kb > 0) {
          formData.append("target_size_kb", String(kb));
        }
      }
      if ((outputFormat === "png" || outputFormat === "avif") && useRembg) {
        formData.append("use_rembg", "true");
      }

      try {
        const controller = new AbortController();
        abortControllerRef.current = controller;

        const res = await fetch("/api/compress", {
          method: "POST",
          body: formData,
          signal: controller.signal,
        });

        const contentType = res.headers.get("content-type") || "";
        const responseText = await res.text();

        let payload: any | null = null;
        if (contentType.includes("application/json") && responseText) {
          try {
            payload = JSON.parse(responseText);
          } catch (jsonErr) {
            console.warn("Failed to parse JSON response:", jsonErr);
          }
        }

        if (!res.ok) {
          const fallbackMessage = responseText || "Error uploading files.";
          const message = payload?.message || payload?.error || fallbackMessage;
          const details =
            payload?.stacktrace ||
            payload?.details ||
            (!payload ? fallbackMessage : undefined);
          setError({
            message,
            details,
            isApiError: true,
          });
          toast.error(message);
          return;
        }

        if (!payload) {
          throw new Error("Received unexpected response from server.");
        }
        const data = payload;
        setConverted(data.converted_files);
        setDestFolder(data.dest_folder);
        setDrawerOpen(true);
        await delay(600);
        toast.success(
          `${data.converted_files.length} Image${data.converted_files.length > 1 ? "s" : ""
          } compressed successfully!`
        );
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          console.log("Upload aborted");
          return;
        }
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
    [
      files,
      outputFormat,
      quality,
      resizeWidthEnabled,
      width,
      clearError,
      setError,
      compressionMode,
      targetSizeMB,
      useRembg,
    ]
  );

  const clearFileSelection = useCallback(() => {
    setFiles([]);
    if (files.length > 0) {
      toast.info(
        `${files.length} Image${files.length !== 1 ? "s" : ""} selection cleared! 🧹`
      );
    }
  }, [files]);

  const removeFile = useCallback((fileName: string) => {
    setFiles((prev) => prev.filter((f) => f.name !== fileName));
  }, []);

  const handleDownloadAll = useCallback(() => {
    window.location.href = `/api/download_all?folder=${encodeURIComponent(
      destFolder
    )}`;
    toast(<DownloadZipToast />);
  }, [destFolder]);

  const onForceCleanCallback = useCallback(async () => {
    try {
      const res = await fetch("/api/force_cleanup", { method: "POST" });
      const json = await res.json();
      if (json.status === "ok") {
        toast.success(
          "Deletion Complete. Your processed files have been permanently removed. 🧹🧹🧹"
        );
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
  }, []);

  const handleAbort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
      toast.info("Compression cancelled.");
    }
  }, []);

  return (
    <div className={cn("min-h-screen flex flex-col transition-colors", backgroundClass)}>
      <SplashScreen
        isVisible={isLoading}
        onAbort={handleAbort}
        disableLogo={configReady ? disableLogo : false}
      />
      <BackendStatusBanner backendDown={isDown} />

      <div className="relative w-full px-4 py-10 sm:px-6 flex-grow flex flex-col items-center text-foreground">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        >
          <div className={cn("absolute -top-20 right-0 h-56 w-56 rounded-full blur-[100px]", accentOneClass)} />
          <div className={cn("absolute bottom-0 left-0 h-64 w-64 rounded-full blur-[120px]", accentTwoClass)} />
        </div>
        <ToastContainer />
        <Card className={cn("w-full max-w-3xl border backdrop-blur-xl transition-colors", cardClass)}>
          {configReady && !disableLogo ? (
            <CardHeader className="pt-12 pb-8 flex flex-col items-center">
              <Image
                src="/logo_transparent.png"
                width={260}
                height={260}
                alt="ImgCompress - Image Compression Tool"
                priority
                className="h-auto w-[220px] sm:w-[240px] md:w-[260px] drop-shadow-xl"
              />
            </CardHeader>
          ) : (
            <CardHeader className="pt-12 pb-10 flex flex-col items-center">
              <CardTitle
                className={`text-center text-3xl md:text-4xl font-bold tracking-tight ${cardTitleClass}`}
              >
                imgcompress
              </CardTitle>
              <p className="text-center text-sm md:text-base text-muted-foreground mt-2">
                An Image Compression Tool
              </p>
            </CardHeader>
          )}
          <CardContent className="px-6 pb-8 sm:px-10 sm:pb-12">
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
              formatRequired={formatRequired}
              files={files}
              removeFile={removeFile}
              clearFileSelection={clearFileSelection}
              onSubmit={handleSubmit}
              targetSizeMB={targetSizeMB}
              setTargetSizeMB={setTargetSizeMB}
              compressionMode={compressionMode}
              setCompressionMode={setCompressionMode}
              useRembg={useRembg}
              setUseRembg={setUseRembg}
              getRootProps={getRootProps}
              getInputProps={getInputProps}
              isDragActive={isDragActive}
              supportedExtensions={formattedSupportedExtensions}
              verifiedExtensions={formattedVerifiedExtensions}
              extensionsLoading={extensionsLoading}
              extensionsError={extensionsError}
            />
          </CardContent>
        </Card>

        {!storageManagementDisabled && (
          <>
            {/* A floating button to open the FileManager drawer */}
            <div className="fixed bottom-4 right-4">
              <button
                disabled={isLoading}
                onClick={() => setFileManagerOpen(true)}
                data-testid="storage-management-btn"
                className={`rounded-full p-3 shadow-lg hover:shadow-xl ${isLoading ? "opacity-50 cursor-not-allowed" : "bg-blue-500"
                  }`}
              >
                <HardDrive className="h-6 w-6" />
              </button>
            </div>

            {/* Drawer for File Manager */}
            <Drawer open={fileManagerOpen} onOpenChange={setFileManagerOpen}>
              <DrawerTrigger asChild>
                <button className="hidden" />
              </DrawerTrigger>
              <DrawerContent className="border-0">
                  <VisuallyHidden>
                    <DrawerHeader>
                      <DrawerTitle className="text-lg font-semibold text-center">
                        Admin Tools
                      </DrawerTitle>
                    </DrawerHeader>
                  </VisuallyHidden>
                  <div className="p-4">
                    <FileManager onForceClean={onForceCleanCallback} key={fileManagerRefresh} />
                </div>
              </DrawerContent>
            </Drawer>
          </>
        )}

        <div className="fixed bottom-4 left-4 z-40">
          <HelpButton />
        </div>

        {converted.length > 0 && (
          <CompressedFilesDrawer
            converted={converted}
            destFolder={destFolder}
            isOpen={drawerOpen}
            onOpenChange={setDrawerOpen}
            onDownloadAll={handleDownloadAll}
          />
        )}

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
