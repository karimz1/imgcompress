"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { BookOpen, ExternalLink } from "lucide-react"
import { APP_CONFIG } from "@/lib/config"

export function HelpButton() {
  return (
    <a
      href={APP_CONFIG.DOCS_WEB_UI_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="no-underline"
      data-testid="how-to-use-btn"
    >
      <Button
        variant="secondary"
        size="sm"
        className="h-9 rounded-full px-4 py-2 shadow-sm flex items-center gap-2 opacity-80 hover:opacity-100 transition-opacity border border-black/10 dark:border-white/10 bg-white/70 dark:bg-zinc-900/70 hover:bg-white/80 dark:hover:bg-zinc-800/80 backdrop-blur font-medium"
      >
        <BookOpen className="h-4 w-4" />
        <span>How to Use</span>
        <ExternalLink className="h-3 w-3 opacity-50" />
      </Button>
    </a>
  )
}
