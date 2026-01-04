"use client"

import React from "react"
import {Info, ExternalLink} from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogTrigger,
} from "@/components/ui/dialog"
import {Button} from "@/components/ui/button"

interface SupportedFormatsDialogProps {
    supportedExtensions: string[]
    verifiedExtensions: string[]
    extensionsLoading: boolean
    extensionsError: Error | null
}

export function SupportedFormatsDialog({
                                           supportedExtensions,
                                           verifiedExtensions,
                                           extensionsLoading,
                                           extensionsError,
                                       }: SupportedFormatsDialogProps) {
    const total = supportedExtensions.length
    const unverified = supportedExtensions.filter(
        (ext) => !verifiedExtensions.includes(ext)
    )

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="flex items-center gap-1" data-testid="supported-formats-btn">
                    <Info className="h-4 w-4"/>
                    Supported Formats{" "}
                    {extensionsLoading ? "(…)" : total ? `(${total})` : ""}
                </Button>
            </DialogTrigger>

            <DialogContent
                className="max-w-[600px] rounded-xl border border-border bg-white dark:bg-zinc-900
                   text-zinc-900 dark:text-zinc-50 shadow-xl"
            >
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-base sm:text-lg font-semibold">
                        <Info className="h-5 w-5 text-blue-500 dark:text-blue-400"/>
                    Supported Formats (Images & PDFs)
                    </DialogTitle>
                    <DialogDescription className="text-sm text-muted-foreground">
                        Verified and experimental upload formats available in this tool.
                    </DialogDescription>
                </DialogHeader>

                {extensionsLoading ? (
                    <p className="text-sm text-muted-foreground">Loading…</p>
                ) : extensionsError ? (
                    <p className="text-sm text-destructive">
                        Error loading formats: {extensionsError.message}
                    </p>
                ) : (
                    <div className="space-y-6 overflow-y-auto max-h-[65vh] pr-2">
                        {/* ✅ Verified Formats */}
                        <section>
                            <h3 className="font-semibold text-green-600 dark:text-green-400 text-base mb-1">
                                ✅ Verified Formats
                            </h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                These formats have been thoroughly tested and verified to work
                                reliably within <strong>imgcompress</strong>. You can use them with confidence in
                                their stability and output quality.
                            </p>
                            <p className="mt-2 text-sm font-mono break-words text-foreground">
                                {verifiedExtensions.length > 0
                                    ? verifiedExtensions.join(" · ")
                                    : "None listed"}
                            </p>
                        </section>

                        <hr className="border-border/40"/>

                        {/* 🧪 Experimental Formats */}
                        <section>
                            <h3 className="font-semibold text-yellow-600 dark:text-yellow-400 text-base mb-1">
                                🧪 Supported but Experimental
                            </h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                The formats listed below are supported by the{" "}
                                <a
                                    href="https://pillow.readthedocs.io/en/stable/handbook/image-file-formats.html#"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 dark:text-blue-400 text-xs hover:underline"
                                >
                                    Pillow library
                                </a>
                                , which is used internally for image conversion. However, they have not yet
                                undergone full automated testing in <strong>imgcompress</strong>. While they
                                are expected to work correctly, they are considered <em>experimental</em> until
                                officially verified.
                            </p>

                            <p className="mt-2 text-sm font-mono break-words text-foreground">
                                {unverified.length > 0 ? unverified.join(" · ") : "None listed"}
                            </p>
                            <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
                                If you experience issues, please open a{" "}
                                  <a
                                    href="https://github.com/karimz1/imgcompress/issues"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 dark:text-blue-400 text-xs hover:underline"
                                >
                                    GitHub issue for Imgcompress
                                </a> with a sample file. It helps improve test coverage and reliability.
                            </p>
                        </section>
                    </div>
                )}
           </DialogContent>
        </Dialog>
    )
}
