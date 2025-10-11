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

const renderLinksInText = (text: string, keyPrefix = 0): React.ReactNode[] => {
  const urlRegex = /(https?:\/\/[^\s)]+)/g
  const nodes: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = urlRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(
        <React.Fragment key={`t-${keyPrefix}-${lastIndex}`}>
          {text.slice(lastIndex, match.index)}
        </React.Fragment>
      )
    }
    const url = match[1]
    nodes.push(
      <a
        key={`u-${keyPrefix}-${match.index}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2"
      >
        {url}
      </a>
    )
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    nodes.push(<React.Fragment key={`t-end-${keyPrefix}`}>{text.slice(lastIndex)}</React.Fragment>)
  }

  return nodes
}

const renderMarkdownLinks = (text: string): React.ReactNode[] => {
  const mdLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0

  while ((match = mdLinkRegex.exec(text)) !== null) {
    const [full, label, url] = match

    if (match.index > lastIndex) {
      parts.push(...renderLinksInText(text.slice(lastIndex, match.index), key++))
    }

    parts.push(
      <a
        key={`md-${key}-${match.index}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2"
      >
        {label}
      </a>
    )
    lastIndex = match.index + full.length
  }

  if (lastIndex < text.length) {
    parts.push(...renderLinksInText(text.slice(lastIndex), key++))
  }

  return parts
}

const LinkText = ({ text }: { text: string }) => {
  const lines = text.split(/\r?\n/)

  return (
    <>
      {lines.map((line, index) => (
        <React.Fragment key={index}>
          {renderMarkdownLinks(line)}
          {index < lines.length - 1 && <br />}
        </React.Fragment>
      ))}
    </>
  )
}

const isVersionHeader = (line: string) => {
  return /^##\s+v?\d+\.\d+\.\d+\s+[—-]\s+\d{4}-\d{2}-\d{2}\s*$/.test(line)
}

const isBulletPoint = (line: string) => {
  return /^[-*+]\s+/.test(line)
}

const extractVersionInfo = (line: string) => {
  const match = line.match(/^##\s+v?(\d+\.\d+\.\d+)\s+[—-]\s+(\d{4}-\d{2}-\d{2})\s*$/)
  if (!match) return null
  return { version: match[1], date: match[2] }
}

const extractBulletText = (line: string) => {
  const match = line.match(/^[-*+]\s+(.*)$/)
  return match ? match[1] : ""
}

const collectBulletNotes = (lines: string[], startIndex: number) => {
  const notes: string[] = []
  let i = startIndex

  while (i < lines.length) {
    const currentLine = lines[i].trim()

    if (isVersionHeader(currentLine)) break

    if (isBulletPoint(currentLine)) {
      let noteText = extractBulletText(currentLine)
      i++

      while (i < lines.length) {
        const nextLine = lines[i].trim()
        if (!nextLine || isVersionHeader(nextLine) || isBulletPoint(nextLine)) {
          break
        }
        noteText += '\n' + nextLine
        i++
      }

      notes.push(noteText.trim())
    } else {
      i++
    }
  }

  return { notes, nextIndex: i }
}

const parseMarkdown = (markdown: string): ReleaseEntry[] => {
  const lines = markdown.split(/\r?\n/)
  const releases: ReleaseEntry[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i].trim()

    if (isVersionHeader(line)) {
      const versionInfo = extractVersionInfo(line)

      if (versionInfo) {
        const { notes, nextIndex } = collectBulletNotes(lines, i + 1)

        if (notes.length > 0) {
          releases.push({
            version: versionInfo.version,
            date: versionInfo.date,
            notes
          })
        }

        i = nextIndex
      } else {
        i++
      }
    } else {
      i++
    }
  }

  return releases
}

const InfoBox = () => (
  <div className="mb-3 p-3 bg-muted/50 rounded-lg border border-border/50">
    <p className="text-xs text-muted-foreground leading-relaxed">
      Only the latest changes are listed here. For older release notes and all resolved issues, visit{" "}
      <a
        href="https://github.com/karimz1/imgcompress/issues?q=is%3Aissue%20state%3Aclosed"
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 hover:text-foreground transition-colors"
      >
        GitHub Issues
      </a>.
    </p>
  </div>
)

const LoadingState = () => (
  <p className="text-sm text-muted-foreground">Loading…</p>
)

const ErrorState = ({ message }: { message: string }) => (
  <p className="text-sm text-destructive">{message}</p>
)

const EmptyState = () => (
  <p className="text-sm text-muted-foreground">No release notes available.</p>
)

const ReleaseNote = ({ note }: { note: string }) => (
  <li className="text-sm leading-relaxed">
    <LinkText text={note} />
  </li>
)

const ReleaseSection = ({ release }: { release: ReleaseEntry }) => (
  <div className="space-y-2">
    <div className="text-sm font-semibold">
      {`v${release.version}${release.date ? ` · ${release.date}` : ""}`}
    </div>
    <ul className="list-disc pl-5 space-y-2">
      {release.notes.map((note, index) => (
        <ReleaseNote key={index} note={note} />
      ))}
    </ul>
  </div>
)

const ReleasesList = ({ releases }: { releases: ReleaseEntry[] }) => (
  <div className="space-y-5">
    {releases.map((release, index) => (
      <ReleaseSection key={index} release={release} />
    ))}
  </div>
)

const useFetchReleaseNotes = () => {
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [data, setData] = React.useState<ReleaseNotesData | null>(null)

  const loadNotes = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/release-notes.md", { cache: "no-store" })
      if (response.ok) {
        const markdown = await response.text()
        const releases = parseMarkdown(markdown)
        if (releases.length) {
          setData({ releases })
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load release notes")
    } finally {
      setLoading(false)
    }
  }, [])

  return { loading, error, data, loadNotes }
}

export function ReleaseNotesButton() {
  const [open, setOpen] = React.useState(false)
  const { loading, error, data, loadNotes } = useFetchReleaseNotes()

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (nextOpen && !data && !loading && !error) {
      void loadNotes()
    }
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
        <InfoBox />
        <div className="space-y-3">
          {loading && <LoadingState />}
          {error && <ErrorState message={error} />}
          {!loading && !error && releases.length > 0 && <ReleasesList releases={releases} />}
          {!loading && !error && !releases.length && <EmptyState />}
        </div>
      </DialogContent>
    </Dialog>
  )
}