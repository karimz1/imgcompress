"use client";

import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export default function HomePage() {
  const [quality, setQuality] = useState("85");
  const [width, setWidth] = useState("800");
  const [files, setFiles] = useState<File[]>([]);
  const [converted, setConverted] = useState<string[]>([]);
  const [destFolder, setDestFolder] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Drag-and-drop config:
  // We pass "disabled: isLoading" so it won't accept new files while processing.
  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles((prev) => [...prev, ...acceptedFiles]);
  }, []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled: isLoading, // Disable while isLoading
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (files.length === 0) {
      alert("Please drop or select some files first.");
      return;
    }

    setIsLoading(true);
    const formData = new FormData();
    files.forEach((file) => formData.append("files[]", file));
    formData.append("quality", quality);
    formData.append("width", width);

    try {
      const res = await fetch("/api/compress", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Error uploading files");
        return;
      }
      const data = await res.json();
      setConverted(data.converted_files);
      setDestFolder(data.dest_folder);
    } catch (err) {
      console.error(err);
      alert("Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }

  function removeFile(fileName: string) {
    setFiles((prev) => prev.filter((f) => f.name !== fileName));
  }

  function handleDownloadAll() {
    window.location.href = `/api/download_all?folder=${encodeURIComponent(
      destFolder
    )}`;
  }

  return (
    <main className="min-h-screen bg-gray-950 text-gray-50 p-4 flex flex-col items-center">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>karimz1/imgcompress: Image Compression Tool</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Quality Field */}
            <div className="space-y-1">
              <Label htmlFor="quality" className="text-sm">
                Quality
              </Label>
              <Input
                id="quality"
                type="number"
                placeholder="85"
                value={quality}
                onChange={(e) => setQuality(e.target.value)}
                disabled={isLoading}
                className="bg-gray-900 text-gray-100 placeholder-gray-400 
                  border border-gray-700 focus:border-blue-500 
                  focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {/* Width Field */}
            <div className="space-y-1">
              <Label htmlFor="width" className="text-sm">
                Width
              </Label>
              <Input
                id="width"
                type="number"
                placeholder="800"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
                disabled={isLoading}
                className="bg-gray-900 text-gray-100 placeholder-gray-400 
                  border border-gray-700 focus:border-blue-500 
                  focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {/* DRAG-AND-DROP ZONE */}
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-md p-6 text-center transition-colors
                ${
                  isDragActive
                    ? "border-blue-400"
                    : "border-gray-700"
                }
                ${
                  isLoading
                    ? "opacity-50 cursor-not-allowed" // visually show it's disabled
                    : ""
                }
              `}
            >
              <input {...getInputProps()} />
              {isDragActive ? (
                <p className="text-blue-300">Drop files here...</p>
              ) : isLoading ? (
                <p>Cannot drop files while processing...</p>
              ) : (
                <p>Drag & drop files here, or click to select</p>
              )}
            </div>

            {/* SHOW SELECTED FILES */}
            {files.length > 0 && (
              <div className="mt-2 space-y-1">
                <Label>Files to upload:</Label>
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

            {/* SUBMIT BUTTON (Spinner if isLoading) */}
            <Button type="submit" variant="default" disabled={isLoading}>
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </div>
              ) : (
                "Upload & Compress"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* RESULTS */}
      {converted.length > 0 && (
        <Card className="w-full max-w-xl mt-8">
          <CardHeader>
            <CardTitle>Converted Files</CardTitle>
          </CardHeader>
          <CardContent>
            {/* "Download All" button if there's more than 1 file */}
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-300">
                {converted.length} file(s) converted
              </p>
              {converted.length > 1 && (
                <Button variant="secondary" onClick={handleDownloadAll}>
                  Download All as ZIP
                </Button>
              )}
            </div>

            <ul className="space-y-2">
              {converted.map((fname) => (
                <li key={fname}>
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
          </CardContent>
        </Card>
      )}
    </main>
  );
}
