"use client";

import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, Check, FileStack, GripVertical, Loader2, Plus, RotateCw, Trash2, Undo2, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { usePdfPageSort } from "@/components/pdf-workspace/usePdfPageSort";
import { PdfDocumentPreview } from "@/components/pdf-workspace/PdfDocumentPreview";
import { cn } from "@/lib/utils";
import { formatUploadLimit, maxUploadBytes } from "@/lib/uploadLimit";
import { preparePdfSelection, movePdfPage, PDF_WORKSPACE_ACCEPT, PDF_WORKSPACE_MAX_PAGES, previewPdfSource, type SavedPdfSelection, type WorkspacePage, type PdfWorkspaceSettings } from "@/lib/pdfWorkspace";

interface PdfWorkspaceProps {
  files: File[];
  onAddFiles: (files: File[]) => void;
  disabled: boolean;
  visible: boolean;
  settings: PdfWorkspaceSettings;
  savedSelection?: SavedPdfSelection | null;
  clearRequest?: number;
  onClearSelection: () => void;
  onSaveSelection: (selection: SavedPdfSelection) => void;
}

export function PdfWorkspace({ files, onAddFiles, disabled, visible, settings: formSettings, savedSelection, clearRequest = 0, onClearSelection, onSaveSelection }: PdfWorkspaceProps) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(formSettings);
  const [pages, setPages] = useState<WorkspacePage[]>([]);
  const [removed, setRemoved] = useState<WorkspacePage[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [filename, setFilename] = useState("merged");
  const [dropActive, setDropActive] = useState(false);
  const [zoom, setZoom] = useState<WorkspacePage | null>(null);
  const [ocr, setOcr] = useState(false);
  const [ocrStatus, setOcrStatus] = useState<{ available: boolean; languages: string[] } | null>(null);
  const [ocrLanguage, setOcrLanguage] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const workspaceTitle = useRef<HTMLHeadingElement>(null);
  const zoomTrigger = useRef<HTMLButtonElement | null>(null);
  const importing = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const imported = useRef(new Set<File>());
  const currentFiles = useRef(files);
  currentFiles.current = files;
  const nextSourceId = useRef(0);
  const preparedSettings = useRef("");
  const selected = pages.filter((page) => page.included);
  const sort = usePdfPageSort(pages, updatePages, busy || !open);

  function languageName(code: string) {
    const locale = ({ eng: "en", deu: "de", fra: "fr", spa: "es", ita: "it", por: "pt", rus: "ru", jpn: "ja", chi_sim: "zh-Hans", chi_tra: "zh-Hant", ara: "ar", hin: "hi", hun: "hu" } as Record<string, string>)[code] ?? code;
    try { return new Intl.DisplayNames([i18n.language], { type: "language" }).of(locale) ?? code; }
    catch { return code; }
  }

  useEffect(() => () => controller.current?.abort(), []);

  useEffect(() => {
    const sources = new Set(files);
    setPages((current) => {
      const retained = current.filter((page) => sources.has(page.file));
      return retained.length === current.length ? current : retained;
    });
    const retained = new Set([...imported.current].filter((file) => sources.has(file)));
    if (retained.size !== imported.current.size) setRemoved(null);
    imported.current = retained;
  }, [files]);

  const lastClearRequest = useRef(0);
  useEffect(() => {
    if (clearRequest === lastClearRequest.current) return;
    lastClearRequest.current = clearRequest;
    controller.current?.abort();
    setPages([]);
    imported.current.clear();
    preparedSettings.current = "";
    setRemoved(null);
    setError(null);
    setOcr(false);
  }, [clearRequest]);

  useEffect(() => {
    if (!open) return;
    const request = new AbortController();
    fetch("/api/pdf/ocr", { signal: request.signal }).then(async (response) => {
      if (!response.ok) throw new Error("OCR status unavailable");
      const status: { available: boolean; languages: string[] } = await response.json();
      setOcrStatus(status);
      setOcrLanguage((previous) => status.languages.includes(previous) ? previous
        : status.languages.includes(i18n.language.startsWith("de") ? "deu" : "eng") ? (i18n.language.startsWith("de") ? "deu" : "eng") : status.languages[0] ?? "");
      if (!status.available) setOcr(false);
    }).catch(() => { if (!request.signal.aborted) { setOcrStatus({ available: false, languages: [] }); setOcr(false); } });
    return () => request.abort();
  }, [open, i18n.language]);

  async function addFiles(incoming: File[], reset = false, sourceSettings = settings, registerSources = false) {
    const pending = incoming.filter((file) => !imported.current.has(file));
    if (importing.current || pending.length === 0) return;
    importing.current = true;
    setBusy(true);
    setError(null);
    setRemoved(null);
    const request = new AbortController();
    controller.current = request;
    let count = reset ? 0 : pages.length;
    let size = reset ? 0 : [...new Set(pages.map((page) => page.file))].reduce((sum, file) => sum + file.size, 0);
    const errors: string[] = [];
    try {
      // Sequential imports keep previews ordered and bound decoder memory.
      for (const file of pending) {
        setProgress(t("pdfWorkspace.importing", { name: file.name }));
        try {
          if (size + file.size > maxUploadBytes()) {
            throw new Error(t("pdfWorkspace.uploadLimit", { size: formatUploadLimit(i18n.language) }));
          }
          if (count >= PDF_WORKSPACE_MAX_PAGES) throw new Error(t("pdfWorkspace.pageLimit", { count: PDF_WORKSPACE_MAX_PAGES }));
          const previews = await previewPdfSource(file, request.signal, undefined, sourceSettings);
          if (request.signal.aborted) return;
          if (!registerSources && !currentFiles.current.includes(file)) continue;
          if (count + previews.length > PDF_WORKSPACE_MAX_PAGES) {
            throw new Error(t("pdfWorkspace.pageLimit", { count: PDF_WORKSPACE_MAX_PAGES }));
          }
          // These IDs only identify local cards; counters also work on HTTP NAS installations.
          const sourceId = String(++nextSourceId.current);
          const added = previews.map((preview) => ({ ...preview, id: `${sourceId}-${preview.page}`, sourceId, file, included: true, rotation: 0 }));
          count += added.length;
          size += file.size;
          if (registerSources) onAddFiles([file]);
          imported.current.add(file);
          setPages((current) => [...current, ...added]);
        } catch (cause) {
          if (request.signal.aborted) return;
          errors.push(`${file.name}: ${cause instanceof Error ? cause.message : t("pdfWorkspace.failed")}`);
        }
      }
      if (errors.length) setError(errors.join("\n"));
    } finally {
      importing.current = false;
      setBusy(false);
      setProgress("");
    }
  }

  async function openWorkspace() {
    const nextSettingsKey = JSON.stringify(formSettings);
    setOpen(true);
    if (preparedSettings.current !== nextSettingsKey && pages.length > 0) {
      importing.current = true; setBusy(true); setError(null); setProgress(t("pdfWorkspace.exporting"));
      const request = new AbortController(); controller.current = request;
      try {
        const prepared = await preparePdfSelection(selectionSnapshot(), formSettings, request.signal);
        if (request.signal.aborted) return;
        const sources = new Set(currentFiles.current);
        const retained = { ...prepared, pages: prepared.pages.filter((page) => sources.has(page.file)) };
        setPages(retained.pages); setSettings(formSettings); preparedSettings.current = nextSettingsKey;
        if (currentFiles.current.length) onSaveSelection(retained);
      } catch (cause) { if (!request.signal.aborted) setError(cause instanceof Error ? cause.message : t("pdfWorkspace.failed")); }
      finally { importing.current = false; setBusy(false); setProgress(""); }
      return;
    }
    preparedSettings.current = nextSettingsKey; setSettings(formSettings);
    void addFiles(files, pages.length === 0, formSettings);
  }

  function updatePages(update: (current: WorkspacePage[]) => WorkspacePage[]) {
    setPages(update);
  }

  function selectionSnapshot(): SavedPdfSelection {
    return { pages: pages.map((page) => ({ ...page })), settings: { ...settings }, filename, ocr, language: ocrLanguage };
  }

  function closeWorkspace() {
    if (!importing.current && (pages.length || removed)) onSaveSelection(selectionSnapshot());
    setOpen(false);
  }

  let outputNumber = 0;
  return (
    <>
      {visible && <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-500/25 bg-blue-500/5 p-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-medium"><FileStack className="h-5 w-5 shrink-0" />{t("pdfWorkspace.title")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t(formSettings.apply_layout ? "pdfWorkspace.layoutIntro" : "pdfWorkspace.intro")}</p>
          {savedSelection && <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border bg-background/60 px-3 py-2" data-testid="pdf-selection-summary"><Check className="h-4 w-4 shrink-0" /><span className="text-sm font-medium">{t("pdfWorkspace.selectionSaved", { count: savedSelection.pages.filter((page) => page.included).length })}</span><Button type="button" variant="ghost" size="sm" className="ms-auto" disabled={disabled || busy} onClick={onClearSelection} data-testid="pdf-selection-clear"><Trash2 />{t("pdfWorkspace.discardSelection")}</Button></div>}
        </div>
        <Button type="button" variant="outline" disabled={disabled || busy} onClick={openWorkspace} data-testid="pdf-workspace-open">{t("pdfWorkspace.open")}</Button>
      </div>}
      <Dialog open={open} onOpenChange={(value) => {
        if (!value && zoom) { setZoom(null); return; }
        if (!value) closeWorkspace(); else setOpen(true);
      }}>
        <DialogContent onOpenAutoFocus={(event) => { event.preventDefault(); workspaceTitle.current?.focus(); }} className="flex h-[92dvh] w-[96vw] max-w-6xl flex-col gap-0 overflow-hidden rounded-xl p-0" data-testid="pdf-workspace" onInteractOutside={(event) => { if (zoom) event.preventDefault(); }} onDragOver={(event) => {
          if (event.dataTransfer.types.includes("Files")) { event.preventDefault(); setDropActive(true); }
        }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropActive(false); }} onDrop={(event) => {
          event.preventDefault(); setDropActive(false);
          if (!busy && event.dataTransfer.files.length) void addFiles(Array.from(event.dataTransfer.files), false, settings, true);
        }}>
          <DialogHeader className="shrink-0 border-b px-5 pb-4 pt-5 pr-12 text-start">
            <DialogTitle ref={workspaceTitle} tabIndex={-1} className="outline-none">{t("pdfWorkspace.title")}</DialogTitle>
            <DialogDescription>{t("pdfWorkspace.description")}</DialogDescription>
            <p className="text-xs text-muted-foreground" data-testid="pdf-workspace-settings">{settings.apply_layout
              ? `${t("pdfWorkspace.usingSettings")}: ${t(`form.pdfPreset.options.${({ "original": "original", "a4-auto": "a4Auto", "a4-portrait": "a4Portrait", "a4-landscape": "a4Landscape", "letter-auto": "letterAuto", "letter-portrait": "letterPortrait", "letter-landscape": "letterLandscape", "mobile-portrait": "mobilePortrait", "mobile-landscape": "mobileLandscape" } as Record<string, string>)[settings.pdf_preset]}`)} · ${t(`form.pdfQuality.options.${settings.pdf_quality}`)}${settings.pdf_preset !== "original" ? ` · ${settings.pdf_margin_mm || "10"} mm · ${t(`form.pdfScale.options.${settings.pdf_paginate ? "fit" : settings.pdf_scale}`)}${settings.pdf_paginate ? ` · ${t("form.pdfPaginate.label")}` : ""}` : ""}`
              : t("pdfWorkspace.keepSizes")}</p>
          </DialogHeader>
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b p-3">
            <input ref={input} type="file" multiple accept={PDF_WORKSPACE_ACCEPT} className="sr-only" aria-label={t("pdfWorkspace.add")} data-testid="pdf-workspace-input" disabled={busy} onChange={(event) => {
              void addFiles(Array.from(event.target.files ?? []), false, settings, true); event.target.value = "";
            }} />
            <Button type="button" size="sm" disabled={busy} onClick={() => input.current?.click()}><Plus />{t("pdfWorkspace.add")}</Button>
            <Button type="button" size="sm" variant="outline" disabled={busy || !pages.length} onClick={() => updatePages((current) => current.map((page) => ({ ...page, included: true })))}>{t("pdfWorkspace.selectAll")}</Button>
            <Button type="button" size="sm" variant="outline" disabled={busy || !pages.length} onClick={() => updatePages((current) => current.map((page) => ({ ...page, included: false })))}>{t("pdfWorkspace.deselectAll")}</Button>
            <Button type="button" size="sm" variant="ghost" disabled={busy || pages.length === selected.length} onClick={() => { setRemoved(pages); updatePages((current) => current.filter((page) => page.included)); }}><Trash2 />{t("pdfWorkspace.removeExcluded")}</Button>
            {removed && <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => { updatePages(() => removed); setRemoved(null); }}><Undo2 />{t("pdfWorkspace.undo")}</Button>}
            <span className="ms-auto text-sm text-muted-foreground" aria-live="polite" data-testid="pdf-workspace-count">{t("pdfWorkspace.summary", { selected: selected.length, total: pages.length })}</span>
          </div>
          {busy && <p role="status" className="flex shrink-0 items-center gap-2 border-b bg-blue-500/5 px-5 py-3 text-sm"><Loader2 className="h-4 w-4 animate-spin" />{progress}</p>}
          {error && <div role="alert" className="max-h-28 shrink-0 overflow-auto whitespace-pre-wrap border-b bg-red-500/10 px-5 py-3 text-sm text-red-700 dark:text-red-300">{error}</div>}
          <div ref={sort.scrollRef} className={cn("min-h-0 flex-1 overflow-auto overscroll-contain p-4", dropActive && "bg-blue-500/10 ring-2 ring-inset ring-blue-500")}>
            {!pages.length ? (
              <button type="button" disabled={busy} onClick={() => input.current?.click()} className="flex h-full min-h-48 w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 text-center disabled:opacity-50">
                <FileStack className="h-10 w-10 text-blue-500" /><span className="font-medium">{t("pdfWorkspace.empty")}</span><span className="text-sm text-muted-foreground">{t("pdfWorkspace.formats")}</span>
              </button>
            ) : (
              <div ref={sort.gridRef} className="relative grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {pages.map((page, index) => {
                  const number = page.included ? ++outputNumber : null;
                  const label = t("pdfWorkspace.pageLabel", { name: page.file.name, page: page.page + 1 });
                  return (
                    <article key={page.id} data-page-id={page.id} data-testid="pdf-workspace-page" data-included={page.included}
                      onPointerDown={(event) => sort.onPointerDown(event, page.id)} onTouchStart={(event) => sort.onTouchStart(event, page.id)} onDragStart={(event) => event.preventDefault()}
                      className={cn("min-w-0 select-none rounded-lg border bg-card p-2 transition-[border-color,box-shadow]", !busy && "cursor-grab active:cursor-grabbing", page.included ? "border-blue-500/60" : "border-dashed border-muted-foreground/40", sort.dragged === page.id && "opacity-20 ring-2 ring-blue-500/50")}>
                      <div className="mb-2 flex items-center justify-between gap-1">
                        <label className="flex min-w-0 cursor-pointer items-center gap-2 text-xs font-medium">
                          <input type="checkbox" checked={page.included} disabled={busy} onChange={() => updatePages((current) => current.map((item) => item.id === page.id ? { ...item, included: !item.included } : item))} aria-label={t("pdfWorkspace.include", { name: label })} className="h-4 w-4 accent-blue-600" />
                          <span>{number ? t("pdfWorkspace.outputPage", { page: number }) : t("pdfWorkspace.excluded")}</span>
                        </label>
                        <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground" aria-hidden="true" />
                      </div>
                      <div data-testid="pdf-workspace-thumbnail" className="relative flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded bg-slate-100">
                        {/* Previews come from the local API, not the Next image optimizer. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={page.preview} alt={label} draggable={false} loading="lazy" className={cn("pointer-events-none h-full w-full object-contain p-2 transition-transform motion-reduce:transition-none", !page.included && "opacity-40")} style={{ transform: `rotate(${page.rotation}deg)`, scale: page.rotation % 180 ? "0.72" : "1" }} />
                        <div className="absolute bottom-2 right-2 flex gap-1">
                          <Button type="button" size="icon" variant="outline" className="h-9 w-9 border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50" aria-label={t("pdfWorkspace.preview", { name: label })} title={t("pdfWorkspace.preview", { name: label })} onClick={(event) => { zoomTrigger.current = event.currentTarget; setZoom(page); }}><ZoomIn /></Button>
                          <Button type="button" size="icon" variant="outline" disabled={busy} className="h-9 w-9 border-red-200 bg-white text-red-600 shadow-sm hover:bg-red-50 hover:text-red-700" aria-label={t("crop.fit.layers.remove", { name: label })} title={t("crop.fit.layers.remove", { name: label })} onClick={() => { setRemoved(pages); updatePages((current) => current.filter((item) => item.id !== page.id)); }}><Trash2 /></Button>
                        </div>
                      </div>
                      <p className="mt-2 truncate text-xs font-medium" title={page.file.name}>{page.file.name}</p>
                      <p className="text-xs text-muted-foreground">{t("pdfWorkspace.sourcePage", { page: page.page + 1 })}</p>
                      <div className="mt-2 flex justify-between gap-1">
                        <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={busy || index === 0} aria-label={t("pdfWorkspace.moveEarlier", { name: label })} onClick={() => updatePages((current) => movePdfPage(current, page.id, current[index - 1].id))}><ArrowLeft /></Button>
                        <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={busy} aria-label={t("pdfWorkspace.rotate", { name: label })} onClick={() => updatePages((current) => current.map((item) => item.id === page.id ? { ...item, rotation: (item.rotation + 90) % 360 } : item))}><RotateCw /></Button>
                        <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={busy || index === pages.length - 1} aria-label={t("pdfWorkspace.moveLater", { name: label })} onClick={() => updatePages((current) => movePdfPage(current, page.id, current[index + 1].id))}><ArrowRight /></Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-3 border-t p-4">
            <div className="flex w-full flex-wrap items-center gap-2 text-sm">
              <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={ocr} disabled={busy || !ocrStatus?.available} onChange={(event) => setOcr(event.target.checked)} className="h-4 w-4 accent-blue-600" />{t("pdfWorkspace.ocr")}</label>
              <Button type="button" variant="ghost" size="sm" className="ms-auto" disabled={busy || !pages.length} onClick={onClearSelection}>{t("pdfWorkspace.clear")}</Button>
              {ocr && <select aria-label={t("pdfWorkspace.ocrLanguage")} value={ocrLanguage} disabled={busy} onChange={(event) => setOcrLanguage(event.target.value)} className="rounded border bg-background px-2 py-1">{ocrStatus?.languages.map((language) => <option key={language} value={language}>{languageName(language)}</option>)}</select>}
              {!ocrStatus?.available && <span className="w-full text-xs text-muted-foreground">{t("pdfWorkspace.ocrUnavailable")}</span>}
            </div>
            <div className="ms-auto flex w-full items-center justify-end gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none"><label htmlFor="pdf-workspace-filename" className="sr-only">{t("pdfWorkspace.filename")}</label>
              <Input id="pdf-workspace-filename" value={filename} disabled={busy} onChange={(event) => setFilename(event.target.value)} className="min-w-0 sm:w-44" aria-label={t("pdfWorkspace.filename")} /><span className="shrink-0 text-sm text-muted-foreground">.pdf</span></div>
              <Button type="button" className="min-w-0 px-2 sm:px-4" disabled={busy || !pages.length} onClick={closeWorkspace} data-testid="pdf-workspace-save"><Check /><span className="truncate">{t("pdfWorkspace.saveSelection")}</span></Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <PdfDocumentPreview pages={pages} initialPage={open ? zoom : null} settings={settings} onToggleIncluded={(id) => updatePages((current) => current.map((page) => page.id === id ? { ...page, included: !page.included } : page))} onClose={() => setZoom(null)} returnFocus={() => zoomTrigger.current?.focus()} />
    </>
  );
}
