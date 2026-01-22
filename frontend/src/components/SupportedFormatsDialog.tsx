"use client"

import React, { useState, useMemo, useEffect, useRef } from "react"
import { Info, ShieldCheck, FileType, Search, ArrowRight, Bug } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const APP_CONFIG = {
    GITHUB_ISSUES_URL: "https://github.com/karimz1/imgcompress/issues",
}

interface SupportedFormatsDialogProps {
    supportedExtensions: string[]
    verifiedExtensions: string[]
    extensionsLoading: boolean
    extensionsError?: Error | null
}

export function SupportedFormatsDialog({
    supportedExtensions,
    verifiedExtensions,
    extensionsLoading,
}: SupportedFormatsDialogProps) {
    const [searchQuery, setSearchQuery] = useState("")
    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const formatTestId = (ext: string) =>
        `supported-format-${ext.replace(/^\./, "").toLowerCase().replace(/[^a-z0-9_-]/g, "")}`

    const unverified = useMemo(() => 
        supportedExtensions.filter((ext) => !verifiedExtensions.includes(ext)),
        [supportedExtensions, verifiedExtensions]
    )

    const isMatch = (ext: string) => 
        searchQuery.length >= 2 && ext.toLowerCase().includes(searchQuery.toLowerCase())

    useEffect(() => {
        if (searchQuery.length >= 2 && scrollContainerRef.current) {
            const firstMatch = scrollContainerRef.current.querySelector('[data-search-match="true"]')
            if (firstMatch) {
                firstMatch.scrollIntoView({ 
                    behavior: "smooth", 
                    block: "center", 
                    inline: "nearest" 
                })
            }
        }
    }, [searchQuery])

    return (
        <Dialog onOpenChange={(open) => !open && setSearchQuery("")}>
            <DialogTrigger asChild>
                <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-2 border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-[#0f172a]/40 backdrop-blur-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all rounded-lg"
                    data-testid="supported-formats-btn"
                >
                    <Info className="h-4 w-4" />
                    What can I open?
                    {!extensionsLoading && (
                        <span
                            data-testid="supported-formats-count"
                            className="ml-1 px-1.5 py-0.5 text-[10px] bg-slate-100 dark:bg-slate-800/50 rounded border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400"
                        >
                            {supportedExtensions.length}
                        </span>
                    )}
                </Button>
            </DialogTrigger>

            <DialogContent
                data-testid="supported-formats-dialog"
                className="max-w-2xl bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-800 p-0 shadow-2xl rounded-xl overflow-hidden sm:max-h-[85vh]"
            >
                <div className="p-8 pb-4">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                            <FileType className="h-5 w-5 text-blue-500" />
                            Supported files
                        </DialogTitle>
                        <DialogDescription className="text-slate-600 dark:text-slate-400 text-sm mt-3 leading-relaxed max-w-[95%]">
                            Here is a cheat sheet of what I can open for you. You can pick your result format using the <span className="font-bold text-slate-800 dark:text-slate-200 underline decoration-slate-300 dark:decoration-slate-700 underline-offset-4">Output Format</span> menu on the main screen after you close this.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="relative mt-8">
                        <div className="flex justify-between items-center mb-2 px-1">
                            <label className="text-[10px] uppercase tracking-wider text-slate-600 dark:text-slate-400 font-bold">
                                Search list
                            </label>
                            <span className="text-[10px] text-slate-500 dark:text-slate-500 italic font-medium">
                                Just type to find a format
                            </span>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
                            <Input
                                placeholder="Search (e.g. psd, tiff)..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 h-11 bg-slate-50 dark:bg-black/20 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-200 rounded-lg focus-visible:ring-1 focus-visible:ring-blue-500/30"
                                data-testid="supported-formats-search"
                            />
                        </div>
                    </div>
                </div>

                <div
                    ref={scrollContainerRef}
                    data-testid="supported-formats-list"
                    className="px-8 pb-6 space-y-10 max-h-[45vh] overflow-y-auto custom-scrollbar scroll-mt-10"
                >
                    <section className="mt-2">
                        <div className="flex items-center gap-2 mb-5">
                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-500/80" />
                            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-500/80">
                                Tested & Working
                            </h3>
                        </div>
                        <div className="flex flex-wrap gap-2.5">
                            {verifiedExtensions.map((ext) => {
                                const match = isMatch(ext);
                                return (
                                    <span 
                                        key={ext} 
                                        data-testid={formatTestId(ext)}
                                        data-format={ext}
                                        data-search-match={match}
                                        className={`px-3 py-1.5 text-[11px] font-mono border rounded-md transition-all duration-300 ${
                                            match 
                                            ? "bg-blue-600 text-white border-blue-400 scale-110 shadow-lg shadow-blue-500/20 z-10" 
                                            : "bg-emerald-50/50 dark:bg-[#1e293b]/30 border-emerald-200 dark:border-slate-800 text-emerald-700 dark:text-emerald-400 font-bold"
                                        }`}
                                    >
                                        {ext}
                                    </span>
                                );
                            })}
                        </div>
                    </section>

                    <section>
                        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-700 dark:text-slate-400 mb-2">
                            Other possible formats
                        </h3>
                        <p className="text-[11px] text-slate-600 dark:text-slate-500 mb-4 italic font-medium leading-relaxed">
                            These haven't been fully tested yet, but they might work!
                        </p>
                        <div className="flex flex-wrap gap-2.5">
                            {unverified.map((ext) => {
                                const match = isMatch(ext);
                                return (
                                    <span 
                                        key={ext} 
                                        data-testid={formatTestId(ext)}
                                        data-format={ext}
                                        data-search-match={match}
                                        className={`px-3 py-1.5 text-[11px] font-mono border rounded-md transition-all duration-300 ${
                                            match 
                                            ? "bg-blue-600 text-white border-blue-400 scale-110 shadow-lg shadow-blue-500/20 z-10" 
                                            : "bg-slate-50 dark:bg-[#1e293b]/20 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-500"
                                        }`}
                                    >
                                        {ext}
                                    </span>
                                );
                            })}
                        </div>
                    </section>
                </div>

                <div className="p-5 bg-slate-50 dark:bg-black/40 border-t border-slate-200 dark:border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-4 transition-colors">
                    <p className="text-[11px] text-slate-700 dark:text-slate-400 font-medium">
                        ImgCompress here to help you convert your images!
                    </p>
                    <a 
                        href={APP_CONFIG.GITHUB_ISSUES_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-2"
                    >
                        <Bug className="h-3 w-3" />
                        Report a bug <ArrowRight className="h-3 w-3 opacity-50" />
                    </a>
                </div>
            </DialogContent>
        </Dialog>
    )
}