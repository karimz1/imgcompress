"use client"

import React from "react"
import { Info, ShieldCheck, FileType } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

const APP_CONFIG = {
    GITHUB_ISSUES_URL: "https://github.com/karimz1/imgcompress/issues",
}

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
    const unverified = supportedExtensions.filter(
        (ext) => !verifiedExtensions.includes(ext)
    )

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2" data-testid="supported-formats-btn">
                    <Info className="h-4 w-4" />
                    Supported Formats {extensionsLoading ? "(...)" : supportedExtensions.length > 0 ? `(${supportedExtensions.length})` : ""}
                </Button>
            </DialogTrigger>

            <DialogContent className="max-w-md rounded-xl shadow-xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileType className="h-5 w-5 text-blue-500" />
                        Supported Formats
                    </DialogTitle>
                    <DialogDescription className="text-sm">
                        All files are processed within your local environment.
                    </DialogDescription>
                </DialogHeader>

                {extensionsLoading ? (
                    <div className="py-6 text-center text-sm text-muted-foreground animate-pulse">
                        Loading formats...
                    </div>
                ) : extensionsError ? (
                    <div className="py-6 text-sm text-destructive">
                        Unable to load format list.
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Verified Section */}
                        <section>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-green-600 dark:text-green-400 mb-2 flex items-center gap-1">
                                <ShieldCheck className="h-3.5 w-3.5" />
                                Verified
                            </h3>
                            <div className="flex flex-wrap gap-1.5 font-mono text-[11px]">
                                {verifiedExtensions.map((ext) => (
                                    <span 
                                        key={ext} 
                                        className="px-2 py-0.5 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded text-foreground"
                                    >
                                        {ext}
                                    </span>
                                ))}
                            </div>
                        </section>

                        {/* Experimental Section */}
                        <section>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-yellow-600 dark:text-yellow-400 mb-2">
                                Experimental
                            </h3>
                            <div className="flex flex-wrap gap-1.5 font-mono text-[11px]">
                                {unverified.length > 0 ? (
                                    unverified.map((ext) => (
                                        <span 
                                            key={ext} 
                                            className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-muted-foreground"
                                        >
                                            {ext}
                                        </span>
                                    ))
                                ) : (
                                    <span className="text-xs text-muted-foreground italic">None listed</span>
                                )}
                            </div>
                            
                            <div className="mt-4 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-border">
                                <p className="text-[11px] text-muted-foreground leading-normal">
                                    If a format does not work as expected, please <strong>open a GitHub issue and include a sample file</strong>. This helps improve support.
                                </p>
                                <a 
                                    href={APP_CONFIG.GITHUB_ISSUES_URL} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-[11px] text-blue-500 hover:underline font-medium mt-2 inline-block"
                                >
                                    Report an issue →
                                </a>
                            </div>
                        </section>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}