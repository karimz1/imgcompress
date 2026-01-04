"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { HelpCircle, ExternalLink } from "lucide-react"

export function HelpButton() {
  const documentationUrl = "https://karimz1.github.io/imgcompress/web-ui.html"

  return (
    <a
      href={documentationUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="no-underline"
    >
      <Button
        variant="secondary"
        size="sm"
        className="h-9 rounded-full px-3 py-2 shadow-sm flex items-center gap-2 opacity-70 hover:opacity-100 transition-opacity border border-black/10 dark:border-white/10 bg-white/60 dark:bg-zinc-900/60 hover:bg-white/70 dark:hover:bg-zinc-800/70 backdrop-blur"
      >
        <HelpCircle className="h-4 w-4" />
        <span className="hidden sm:inline">How to Use</span>
        <ExternalLink className="h-3 w-3 opacity-50" />
      </Button>
    </a>
  )
}
