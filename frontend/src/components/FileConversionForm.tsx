"use client";

import React, { useMemo } from "react";
import { useDropzone } from "react-dropzone";
import { Info, Loader2, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";

interface FileConversionFormProps {
  isLoading: boolean;
  error: { message: string; details?: string } | null;
  quality: string;
  setQuality: (val: string) => void;
  width: string;
  setWidth: (val: string) => void;
  resizeWidthEnabled: boolean;
  setResizeWidthEnabled: (val: boolean) => void;
  outputFormat: string;
  setOutputFormat: (val: string) => void;
  files: File[];
  removeFile: (name: string) => void;
  clearFileSelection: () => void;
  onSubmit: (e: React.FormEvent) => void;
  
  // From useDropzone
  getRootProps: ReturnType<typeof useDropzone>["getRootProps"];
  getInputProps: ReturnType<typeof useDropzone>["getInputProps"];
  isDragActive: boolean;

  // New props for showing supported formats
  supportedExtensions: string[];
  extensionsLoading: boolean;
  extensionsError: Error | null;
}

const tooltipContent = {
  outputFormat:
  "PNG: Preserves transparency (alpha) and is best for images with transparent backgrounds.\nJPEG: Ideal for images without transparency and produces smaller file sizes.\nICO: Commonly used for favicons and application icons, supports transparency (alpha). Recommended to use PNG as the source when converting to ICO.",
  quality:
    "Adjust the JPEG quality (100 gives the best quality, lower values reduce file size).",
  resizeWidth:
    "Resizes the image(s) to the desired width while preserving the original aspect ratio.",
};

const FileConversionForm: React.FC<FileConversionFormProps> = ({
  isLoading,
  error,
  quality,
  setQuality,
  width,
  setWidth,
  resizeWidthEnabled,
  setResizeWidthEnabled,
  outputFormat,
  setOutputFormat,
  files,
  removeFile,
  clearFileSelection,
  onSubmit,
  getRootProps,
  getInputProps,
  isDragActive,
  supportedExtensions,
  extensionsLoading,
  extensionsError,
}) => {
  const renderError = useMemo(
    () =>
      error && (
        <div
          data-testid="error-holder"
          className="p-2 bg-red-600 text-white rounded-md"
        >
          <p data-testid="error-message-holder">
            <strong>Error:</strong> {error.message}
          </p>
          {error.details && (
            <p data-testid="error-details-holder">
              <strong>Details:</strong> {error.details}
            </p>
          )}
        </div>
      ),
    [error]
  );

  const renderFilesList = useMemo(
    () =>
      files.length > 0 && (
        <div className="mt-2 space-y-1">
          <Label>Files to convert:</Label>
          {files.map((file) => (
            <div
              key={file.name}
              className="flex items-center justify-between bg-gray-800 rounded-md p-2 text-gray-100"
              data-testid="dropzone-added-file-wrapper"
            >
              <span className="text-sm" data-testid="dropzone-added-file">
                {file.name}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={isLoading}
                onClick={() => removeFile(file.name)}
                data-testid="dropzone-remove-file-btn"
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      ),
    [files, isLoading, removeFile]
  );

  const renderDropZone = useMemo(
    () => (
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-md p-6 text-center transition-colors ${
          isDragActive ? "border-blue-400" : "border-gray-700"
        } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <input {...getInputProps()} data-testid="dropzone-input" />
        {isDragActive ? (
          <p className="text-blue-300">Drop Images here...</p>
        ) : isLoading ? (
          <p>Cannot drop Images while processing...</p>
        ) : (
          <p>Drag & drop Images here, or click to select</p>
        )}
      </div>
    ),
    [getInputProps, getRootProps, isDragActive, isLoading]
  );

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/*
        A "Popover" to show all supported file extensions.
        Triggered by a button in the top-right corner.
      */}
      <div className="flex justify-end">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="flex items-center gap-1">
              <Info className="h-4 w-4" />
              Supported Formats {supportedExtensions.length > 0 && `(${supportedExtensions.length})`}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            side="bottom"
            className="bg-gray-900 text-white p-3 rounded-md shadow-md w-56 border-0 max-h-[300px] overflow-auto"
          >
            {extensionsLoading ? (
              <p>Loading...</p>
            ) : extensionsError ? (
              <p className="text-red-400">Error loading formats</p>
            ) : (
              // Display them in a comma-separated string:
              <p className="text-sm">
                {supportedExtensions.join(", ")}
              </p>
            )}
          </PopoverContent>

        </Popover>
      </div>

      {/* Output Format */}
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
            <TooltipContent
              side="top"
              className="bg-gray-800 text-white p-2 rounded shadow-lg border-0 whitespace-pre-line"
            >
              {tooltipContent.outputFormat}
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
            <SelectItem value="jpeg">JPEG (smaller file size)</SelectItem>
            <SelectItem value="png">PNG (preserves transparency)</SelectItem>
            <SelectItem value="ico">ICO (preserves transparency)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Quality for JPEG */}
      {outputFormat === "jpeg" && (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Label
              htmlFor="quality"
              className="text-sm flex items-center gap-1"
            >
              Quality (for JPEG only)
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Info className="h-4 w-4 text-gray-400 cursor-pointer" />
                  </span>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className="bg-gray-800 text-white p-2 rounded shadow-lg border-0"
                >
                  <p className="text-sm">{tooltipContent.quality}</p>
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

      {/* Resize Width */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Label
            htmlFor="resizeWidthToggle"
            className="text-sm flex items-center gap-1"
          >
            Resize Width
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Info className="h-4 w-4 text-gray-400 cursor-pointer" />
                </span>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className="bg-gray-800 text-white p-2 rounded shadow-lg border-0"
              >
                <p className="text-sm">{tooltipContent.resizeWidth}</p>
              </TooltipContent>
            </Tooltip>
          </Label>
          <Switch
            data-testid="resize-width-switch"
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
            data-testid="resize-width-input"
            itemProp="data-testid: convert-btn"
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

      {/* Error Alert (if any) */}
      {renderError}

      {/* Dropzone */}
      {renderDropZone}

      {/* Files List */}
      {renderFilesList}

      {/* Action Buttons */}
      <div className="flex items-center justify-between gap-4">
        <Button type="submit" variant="default" disabled={isLoading} data-testid="convert-btn">
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
  );
};

export default FileConversionForm;
