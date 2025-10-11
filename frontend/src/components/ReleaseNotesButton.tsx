"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Megaphone } from "lucide-react"

interface ReleaseEntry {
  version: string
  date?: string
  notes: string[]
}

interface ReleaseNotesData {
  releases: ReleaseEntry[]
}

const LinkText = ({ text }: { text: string }) => {
  const mdLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g
  const urlRegex = /(https?:\/\/[^\s)]+)/g

  const renderLinks = (t: string, key = 0): React.ReactNode[] => {
    const nodes: React.ReactNode[] = []
    let last = 0
    let match: RegExpExecArray | null
    while ((match = urlRegex.exec(t)) !== null) {
      if (match.index > last) nodes.push(<React.Fragment key={`t-${key}-${last}`}>{t.slice(last, match.index)}</React.Fragment>)
      const url = match[1]
      nodes.push(<a key={`u-${key}-${match.index}`} href={url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{url}</a>)
      last = match.index + match[0].length
    }
    if (last < t.length) nodes.push(<React.Fragment key={`t-end-${key}`}>{t.slice(last)}</React.Fragment>)
    return nodes
  }

  const renderMarkdown = (t: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = []
    let last = 0
    let m: RegExpExecArray | null
    let key = 0
    while ((m = mdLinkRegex.exec(t)) !== null) {
      const [full, label, url] = m
      if (m.index > last) parts.push(...renderLinks(t.slice(last, m.index), key++))
      parts.push(<a key={`md-${key}-${m.index}`} href={url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{label}</a>)
      last = m.index + full.length
    }
    if (last < t.length) parts.push(...renderLinks(t.slice(last), key++))
    return parts
  }

  const render = (t: string): React.ReactNode => (
    <>
      {t.split(/\r?\n/).map((ln, i, arr) => (
        <React.Fragment key={i}>
          {renderMarkdown(ln)}
          {i < arr.length - 1 && <br />}
        </React.Fragment>
      ))}
    </>
  )

  return <>{render(text)}</>
}

const parseMarkdown = (md: string): ReleaseEntry[] => {
  const sectionRegex = /^##\s+v?(\d+\.\d+\.\d+)\s+[—-]\s+(\d{4}-\d{2}-\d{2})\s*[\r\n]+([\s\S]*?)(?=^##\s+|$)/gm
  const releases: ReleaseEntry[] = []
  let match: RegExpExecArray | null
  while ((match = sectionRegex.exec(md)) !== null) {
    const [, version, date, body] = match
    const lines = body.trim().split(/\r?\n/)
    const notes: string[] = []
    let i = 0
    while (i < lines.length) {
      if (!lines[i].trim()) { i++; continue }
      const bullet = lines[i].match(/^\s*[-*+]\s+(.*)$/)
      let text = bullet ? bullet[1] : lines[i]
      i++
      while (i < lines.length && !/^\s*([-*+]\s+|#{1,6}\s+|$)/.test(lines[i])) text += "\n" + lines[i++].trimEnd()
      notes.push(text.trim())
    }
    if (!notes.length && body) notes.push(body.trim())
    releases.push({ version, date, notes })
  }
  return releases
}

export function ReleaseNotesButton() {
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [data, setData] = React.useState<ReleaseNotesData | null>(null)

  const loadNotes = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/release-notes.md", { cache: "no-store" })
      if (res.ok) {
        const md = await res.text()
        const releases = parseMarkdown(md)
        if (releases.length) setData({ releases })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load release notes")
    } finally {
      setLoading(false)
    }
  }, [])

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next && !data && !loading && !error) void loadNotes()
  }

  const releases = data?.releases ?? []

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="secondary"
          size="sm"
          className="h-9 rounded-full px-3 py-2 shadow-sm flex items-center gap-2 opacity-70 hover:opacity-100 transition-opacity border border-black/10 dark:border-white/10 bg-white/60 dark:bg-zinc-900/60 hover:bg-white/70 dark:hover:bg-zinc-800/70 backdrop-blur"
        >
          <Megaphone className="h-4 w-4" />
          <span className="hidden sm:inline">Release Notes</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Release Notes</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!loading && !error && releases.length > 0 && (
            <div className="space-y-5">
              {releases.map((r, i) => (
                <div key={i} className="space-y-2">
                  <div className="text-sm font-semibold">{`v${r.version}${r.date ? ` · ${r.date}` : ""}`}</div>
                  <ul className="list-disc pl-5 space-y-2">
                    {r.notes.map((n, j) => (
                      <li key={j} className="text-sm leading-relaxed"><LinkText text={n} /></li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
          {!loading && !error && !releases.length && (
            <p className="text-sm text-muted-foreground">No release notes available.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}