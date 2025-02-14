"use client";

import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Check, LifeBuoy, XCircle, AlertTriangle } from "lucide-react";
import { useErrorStore } from "@/context/ErrorStore";


const ErrorModal = () => {
  const { error, clearError } = useErrorStore();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  
  useEffect(() => {
    if (error && error.isApiError) {
      setOpen(true);
    } else {
      setOpen(false);
    }
  }, [error]);

  
  if (!error || !error.isApiError) {
    return null;
  }

  const handleCopy = () => {
    const errorText =
      error.message + (error.details ? "\n\n" + error.details : "");
    navigator.clipboard.writeText(errorText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenTicket = () => {
    
    window.open("https://example.com/support", "_blank");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(openVal) => {
        if (!openVal) {
          clearError();
          setOpen(false);
        }
      }}
    >
      <DialogContent className="bg-gray-950 text-gray-50 w-full max-w-3xl mx-auto p-6 md:p-8 rounded-lg shadow-2xl">
        <DialogHeader className="flex items-center space-x-3">
          <AlertTriangle className="h-10 w-10 text-red-500" />
          <DialogTitle className="text-3xl font-bold">Error Occurred</DialogTitle>
        </DialogHeader>
        <DialogDescription className="mt-4">
          <div className="w-full font-medium text-xl mb-2 flex items-center space-x-2">
            <XCircle className="h-6 w-6 text-red-400" />
            <span>{error.message}</span>
          </div>
          {error.details && (
            <div className="mt-2 w-full p-4 bg-gray-800 rounded-md border border-gray-700 max-h-60 overflow-y-auto">
              <pre className="text-sm break-words whitespace-pre-wrap">
                {error.details}
              </pre>
            </div>
          )}
          <div className="mt-4 text-base text-gray-300">
            Please open a ticket and notify the developer so this can be fixed ASAP.
          </div>
        </DialogDescription>
        <DialogFooter className="flex flex-wrap justify-end gap-4 mt-6 w-full">
          <Button
            variant="outline"
            className="flex items-center bg-gray-200 text-gray-900 border-gray-300 hover:bg-gray-300"
            onClick={handleCopy}
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                <span className="ml-2">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                <span className="ml-2">Copy Error</span>
              </>
            )}
          </Button>
          <Button
            variant="outline"
            className="flex items-center bg-gray-200 text-gray-900 border-gray-300 hover:bg-gray-300"
            onClick={handleOpenTicket}
          >
            <LifeBuoy className="h-4 w-4" />
            <span className="ml-2">Open Ticket</span>
          </Button>
          <Button
            className="flex items-center bg-gray-200 text-gray-900 border-gray-300 hover:bg-gray-300"
            onClick={() => {
              clearError();
              setOpen(false);
            }}
          >
            <XCircle className="h-4 w-4" />
            <span className="ml-2">Close</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ErrorModal;
