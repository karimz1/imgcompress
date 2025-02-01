"use client";

import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Info, Trash } from "lucide-react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Image from "next/image";
import { Separator } from "@/components/ui/separator";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

// Import Tooltip components
import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

// Import shadcn Select components for the combobox
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Define allowed extensions
const allowedExtensions = [
  "jpg",
  "jpeg",
  "png",
  "gif",
  "bmp",
  "tiff",
  "tif",
  "webp",
  "heic",
  "heif",
  "svg",
  "ico",
  "raw",
  "cr2",
  "nef",
  "arw",
  "dng",
  "orf",
  "rw2",
  "sr2",
  "apng",
  "jp2",
  "j2k",
  "jpf",
  "jpx",
  "jpm",
  "mj2",
  "psd",
  "pdf",
  "emf",
  "exr",
  "avif",
];

// Create an object for the accept prop
const acceptObject = {
  "image/*": allowedExtensions.map((ext) => `.${ext}`),
};

export default function HomePage() {
  const [quality, setQuality] = useState("85");
  const [width, setWidth] = useState("");
  const [resizeWidthEnabled, setResizeWidthEnabled] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [converted, setConverted] = useState<string[]>([]);
  const [destFolder, setDestFolder] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<{ message: string; details?: string } | null>(null);
  // New state for output format; default to "jpeg"
  const [outputFormat, setOutputFormat] = useState("jpeg");
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const pluralize = (count: number, singular: string, plural: string): string =>
    count === 1 ? singular : plural;

  // State to control the Drawer open/close
  const [drawerOpen, setDrawerOpen] = useState(false);

  // onDrop: filter files based on allowedExtensions
  const onDrop = useCallback((acceptedFiles: File[]) => {
    setError(null);
    setConverted([]);
    setDestFolder("");

    const filteredFiles = acceptedFiles.filter((file) => {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext && allowedExtensions.includes(ext)) {
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
  }, []);

  // Configure dropzone with our accept object
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled: isLoading,
    accept: acceptObject,
    multiple: true,
  });

  async function handleSubmit(e: React.FormEvent) {
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

    // Validate width if resizing is enabled
    if (resizeWidthEnabled) {
      const widthNum = parseInt(width, 10);
      if (isNaN(widthNum) || widthNum <= 0) {
        setError({ message: "Width must be a positive number." });
        toast.error("Width must be a positive number.");
        return;
      }
    }

    setIsLoading(true);
    setError(null);
    setConverted([]);
    setDestFolder("");

    const formData = new FormData();
    files.forEach((file) => formData.append("files[]", file));
    // Append quality only if JPEG is selected
    if (outputFormat === "jpeg") {
      formData.append("quality", quality);
    }
    if (resizeWidthEnabled) {
      formData.append("width", width);
    }
    // Append the selected output format
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
        });
        toast.error(err.error || "Error uploading files.");
        return;
      }

      const data = await res.json();
      setConverted(data.converted_files);
      setDestFolder(data.dest_folder);
      // Do not clear file selection automatically on success
      setDrawerOpen(true);
      await delay(600);
      toast.success(pluralize(data.converted_files.length, "Image", "Images") + " compressed successfully!");
    } catch (err) {
      console.error(err);
      setError({
        message: "Something went wrong. Please try again.",
        details: err instanceof Error ? err.message : undefined,
      });
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  // Reset the form to its initial state
  function handleReset() {
    setFiles([]);
    setQuality("85");
    setWidth("");
    setResizeWidthEnabled(false);
    setOutputFormat("jpeg");
    setError(null);
    setConverted([]);
    setDestFolder("");
    toast.info("App Selection has been reset.");
  }

  function clearFileSelection() {
    setFiles([]);
    toast.info(pluralize(files.length, "Image", "Images") + " selection cleared! 🧹");
  }

  function removeFile(fileName: string) {
    setFiles((prev) => prev.filter((f) => f.name !== fileName));
  }

  function handleDownloadAll() {
    window.location.href = `/api/download_all?folder=${encodeURIComponent(destFolder)}`;
  }

  return (
    <TooltipProvider delayDuration={0}>
      <main className="min-h-screen bg-gray-950 text-gray-50 p-4 flex flex-col items-center">
        <ToastContainer />
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
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Output Format Selector */}
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <Label htmlFor="outputFormat" className="text-sm">
                    Output Format
                  </Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Info className="h-4 w-4 text-gray-400 cursor-pointer" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-gray-800 text-white p-2 rounded shadow-lg border-0">
                      <p className="text-sm">
                        <strong>PNG:</strong> Preserves transparency (alpha) and is best for images with transparent backgrounds.
                        <br />
                        <strong>JPEG:</strong> Ideal for images without transparency and produces smaller file sizes.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Select value={outputFormat} onValueChange={setOutputFormat}>
                  <SelectTrigger
                    id="outputFormat"
                    className="bg-gray-800 text-gray-300 border-gray-700 focus:border-blue-500"
                  >
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 text-gray-300 border-gray-700">
                    <SelectItem value="jpeg">
                      JPEG (smaller file size)
                    </SelectItem>
                    <SelectItem value="png">
                      PNG (preserves transparency)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Quality Slider Field with Tooltip - only show if outputFormat is JPEG */}
              {outputFormat === "jpeg" && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="quality" className="text-sm flex items-center gap-1">
                      Quality (for JPEG only)
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>
                            <Info className="h-4 w-4 text-gray-400 cursor-pointer" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="bg-gray-800 text-white p-2 rounded shadow-lg border-0">
                          <p className="text-sm">
                            Adjust the JPEG quality (100 gives the best quality, lower values reduce file size).
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </Label>
                    <span className="text-sm text-gray-400">{quality}</span>
                  </div>
                  <input
                    id="quality"
                    type="range"
                    min="10"
                    max="100"
                    value={quality}
                    onChange={(e) => setQuality(e.target.value)}
                    disabled={isLoading}
                    className="w-full accent-blue-500"
                  />
                </div>
              )}

              {/* Resize Width Switch & Input with Tooltip */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label htmlFor="resizeWidthToggle" className="text-sm flex items-center gap-1">
                    Resize Width
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <Info className="h-4 w-4 text-gray-400 cursor-pointer" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="bg-gray-800 text-white p-2 rounded shadow-lg border-0">
                        <p className="text-sm">
                          Resizes the image(s) to the desired width while preserving the original aspect ratio.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <Switch
                    id="resizeWidthToggle"
                    checked={resizeWidthEnabled}
                    onCheckedChange={(checked) => {
                      setResizeWidthEnabled(checked);
                      if (checked && width === "") {
                        setWidth("800");
                      } else if (!checked) {
                        setWidth("");
                      }
                    }}
                    disabled={isLoading}
                  />
                </div>
                {resizeWidthEnabled && (
                  <Input
                    id="width"
                    type="number"
                    placeholder="800"
                    value={width}
                    onChange={(e) => setWidth(e.target.value)}
                    disabled={isLoading}
                    className="bg-gray-800 text-gray-100 placeholder-gray-400 border border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                )}
              </div>

              {/* Error Message Display */}
              {error && (
                <div className="p-2 bg-red-600 text-white rounded-md">
                  <p>
                    <strong>Error:</strong> {error.message}
                  </p>
                  {error.details && (
                    <p>
                      <strong>Details:</strong> {error.details}
                    </p>
                  )}
                </div>
              )}

              {/* DRAG-AND-DROP ZONE */}
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-md p-6 text-center transition-colors ${
                  isDragActive ? "border-blue-400" : "border-gray-700"
                } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <input {...getInputProps()} />
                {isDragActive ? (
                  <p className="text-blue-300">Drop Images here...</p>
                ) : isLoading ? (
                  <p>Cannot drop Images while processing...</p>
                ) : (
                  <p>Drag & drop Images here, or click to select</p>
                )}
              </div>

              {/* SHOW SELECTED FILES */}
              {files.length > 0 && (
                <div className="mt-2 space-y-1">
                  <Label>Files to convert:</Label>
                  {files.map((file) => (
                    <div
                      key={file.name}
                      className="flex items-center justify-between bg-gray-800 rounded-md p-2 text-gray-100"
                    >
                      <span className="text-sm">{file.name}</span>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={isLoading}
                        onClick={() => removeFile(file.name)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* SUBMIT & RESET BUTTONS */}
              <div className="flex items-center justify-between gap-4">
                <Button type="submit" variant="default" disabled={isLoading}>
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processing...
                    </div>
                  ) : (
                    "Start Converting"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={clearFileSelection}
                  disabled={isLoading}
                  className="flex items-center gap-2 outline outline-1 outline-gray-700"
                >
                  <Trash className="h-4 w-4" />
                  Clear
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {converted.length > 0 && (
          <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
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
                      <Button variant="secondary" onClick={handleDownloadAll}>
                        Download All as Zip
                      </Button>
                    </div>
                  )}
                </div>
                <div className="p-4 pb-0">
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
        )}

        <Card className="w-full max-w-xl mt-8">
          <CardHeader>
            <CardTitle>Open Source & Free</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              This project is <strong>open source</strong> and freely available.
              Check out the source code on{" "}
              <a
                href="https://github.com/karimz1/imgcompress"
                className="text-blue-400 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub
              </a>.
            </p>
            <p className="text-sm text-gray-600 mt-2">
              Created by <strong>Karim Zouine</strong>. Donations are very welcome,
              if you find this tool useful 🤗 My PayPal:{" "}
              <a
                href="mailto:mails.karimzouine@gmail.com"
                className="text-blue-400 hover:underline"
              >
                mails.karimzouine@gmail.com
              </a>
            </p>
          </CardContent>
        </Card>
      </main>
    </TooltipProvider>
  );
}
