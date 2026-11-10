"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, ArrowLeftRight, Maximize, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { pdfPageDimensions, pdfPageSizeLabel, previewPdfSource, type PdfWorkspaceSettings, type WorkspacePage } from "@/lib/pdfWorkspace";

interface Props {
  pages: WorkspacePage[];
  initialPage: WorkspacePage | null;
  settings: PdfWorkspaceSettings;
  onClose: () => void;
  returnFocus: () => void;
}

export function PdfDocumentPreview({ pages, initialPage, settings, onClose, returnFocus }: Props) {
  const { t, i18n } = useTranslation();
  const viewport = useRef<HTMLDivElement>(null);
  const pageElements = useRef(new Map<string, HTMLElement>());
  const [currentId, setCurrentId] = useState(initialPage?.id ?? "");
  const [mode, setMode] = useState<"page" | "width" | "custom">("page");
  const [percent, setPercent] = useState(100);
  const [zoomDraft, setZoomDraft] = useState("100");
  const [pageDraft, setPageDraft] = useState("1");
  const [viewSize, setViewSize] = useState({ width: 800, height: 600 });
  const scrollFrame = useRef(0);
  const currentIndex = Math.max(0, pages.findIndex((page) => page.id === currentId));
  const currentPage = pages[currentIndex] ?? initialPage;
  const dimensions = initialPage ? pdfPageDimensions(initialPage) : { width: 595, height: 842 };
  const scale = mode === "custom" ? percent / 100 : Math.min(
    (viewSize.width - 48) / (dimensions.width * 4 / 3),
    mode === "page" ? (viewSize.height - 70) / (dimensions.height * 4 / 3) : Infinity,
  );
  const zoom = Math.max(0.1, Math.min(4, scale));

  useEffect(() => {
    if (!initialPage) return;
    setCurrentId(initialPage.id);
    setMode("page");
  }, [initialPage]);

  useEffect(() => {
    setZoomDraft(String(Math.round(zoom * 100)));
  }, [zoom]);

  useEffect(() => setPageDraft(String(currentIndex + 1)), [currentIndex]);

  useEffect(() => {
    if (!initialPage) return;
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setViewSize({ width: element.clientWidth, height: element.clientHeight }));
    observer.observe(element);
    setViewSize({ width: element.clientWidth, height: element.clientHeight });
    return () => observer.disconnect();
  }, [initialPage]);

  useEffect(() => () => cancelAnimationFrame(scrollFrame.current), []);

  // Fit uses the initially opened sheet as its reference, so scrolling through
  // differently sized pages never changes the zoom or moves the document.
  const fitReference = initialPage ? pdfPageDimensions(initialPage) : dimensions;
  const fitZoom = mode === "custom" ? zoom : Math.max(0.1, Math.min(4,
    Math.min((viewSize.width - 48) / (fitReference.width * 4 / 3), mode === "page" ? (viewSize.height - 70) / (fitReference.height * 4 / 3) : Infinity),
  ));

  useLayoutEffect(() => {
    if (!initialPage) return;
    const element = pageElements.current.get(initialPage.id);
    if (element && viewport.current) viewport.current.scrollTop = element.offsetTop;
  }, [initialPage, viewSize.width, viewSize.height]);

  function goTo(index: number) {
    const targetIndex = Math.max(0, Math.min(pages.length - 1, Number.isFinite(index) ? index : 0));
    const page = pages[targetIndex];
    const element = page && pageElements.current.get(page.id);
    if (!element || !viewport.current) return;
    setCurrentId(page.id);
    setPageDraft(String(targetIndex + 1));
    viewport.current.scrollTo({ top: element.offsetTop, behavior: "instant" });
  }

  function changeZoom(value: number) {
    const next = Math.max(10, Math.min(400, Number.isFinite(value) ? value : 100));
    if (mode === "custom" && next === percent) { setZoomDraft(String(next)); return; }
    setMode("custom");
    setPercent(next);
    setZoomDraft(String(next));
    // Keep the active page in view when changing zoom.
    requestAnimationFrame(() => {
      const element = pageElements.current.get(currentId);
      if (element && viewport.current) viewport.current.scrollTop = element.offsetTop;
    });
  }

  const displayedZoom = mode === "custom" ? Math.round(zoom * 100) : Math.round(fitZoom * 100);
  useEffect(() => { if (mode !== "custom") setZoomDraft(String(displayedZoom)); }, [displayedZoom, mode]);

  return <Dialog open={!!initialPage} onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="flex h-[94dvh] w-[97vw] max-w-7xl flex-col gap-0 overflow-hidden rounded-xl p-0" data-testid="pdf-document-preview" onEscapeKeyDown={(event) => { event.preventDefault(); event.stopPropagation(); onClose(); }} onCloseAutoFocus={(event) => { event.preventDefault(); returnFocus(); }}>
      <DialogHeader className="shrink-0 border-b p-4 pr-12 text-start">
        <DialogTitle className="truncate">{currentPage?.file.name}</DialogTitle>
        <DialogDescription>{t("pdfWorkspace.pageOf", { page: currentIndex + 1, total: pages.length })}{currentPage ? ` · ${pdfPageSizeLabel(currentPage, i18n.language)}` : ""}</DialogDescription>
      </DialogHeader>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b p-2" data-testid="pdf-preview-toolbar">
        <div className="flex items-center gap-1">
          <Button type="button" size="icon" variant="ghost" className="h-9 w-9" disabled={currentIndex === 0} aria-label={t("pdfWorkspace.previousPage")} onClick={() => goTo(currentIndex - 1)}><ArrowLeft /></Button>
          <Input type="number" min={1} max={pages.length} className="h-9 w-16 text-center" aria-label={t("pdfWorkspace.goToPage")} value={pageDraft} onChange={(event) => setPageDraft(event.target.value)} onBlur={() => { if (Number(pageDraft) !== currentIndex + 1) goTo(Number(pageDraft) - 1 || 0); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); goTo(Number(pageDraft) - 1 || 0); } }} />
          <span className="text-sm text-muted-foreground">/ {pages.length}</span>
          <Button type="button" size="icon" variant="ghost" className="h-9 w-9" disabled={currentIndex === pages.length - 1} aria-label={t("pdfWorkspace.nextPage")} onClick={() => goTo(currentIndex + 1)}><ArrowRight /></Button>
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" size="icon" variant="ghost" className="h-9 w-9" disabled={displayedZoom <= 10} aria-label={t("pdfWorkspace.zoomOut")} onClick={() => changeZoom(displayedZoom - 25)}><Minus /></Button>
          <Input type="number" min={10} max={400} step={25} className="h-9 w-[4.5rem] text-center" aria-label={t("pdfWorkspace.zoom")} value={zoomDraft} onChange={(event) => setZoomDraft(event.target.value)} onBlur={() => { if (Number(zoomDraft) !== displayedZoom) changeZoom(Number(zoomDraft)); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); changeZoom(Number(zoomDraft)); } }} /><span className="text-sm">%</span>
          <Button type="button" size="icon" variant="ghost" className="h-9 w-9" disabled={displayedZoom >= 400} aria-label={t("pdfWorkspace.zoomIn")} onClick={() => changeZoom(displayedZoom + 25)}><Plus /></Button>
          <Button type="button" size="icon" variant={mode === "page" ? "secondary" : "ghost"} className="h-9 w-9" aria-label={t("pdfWorkspace.fitPage")} title={t("pdfWorkspace.fitPage")} onClick={() => setMode("page")}><Maximize /></Button>
          <Button type="button" size="icon" variant={mode === "width" ? "secondary" : "ghost"} className="h-9 w-9" aria-label={t("pdfWorkspace.fitWidth")} title={t("pdfWorkspace.fitWidth")} onClick={() => setMode("width")}><ArrowLeftRight /></Button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-36 shrink-0 space-y-3 overflow-auto border-e bg-muted/30 p-3 md:block" aria-label={t("pdfWorkspace.pageNavigation")}>
          {pages.map((page, index) => <button type="button" key={page.id} onClick={() => goTo(index)} aria-current={page.id === currentPage?.id ? "page" : undefined} aria-label={t("pdfWorkspace.outputPage", { page: index + 1 })} className={cn("block w-full rounded border p-2 text-xs", page.id === currentPage?.id ? "border-blue-500 ring-1 ring-blue-500" : "border-transparent hover:border-muted-foreground")}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={page.preview} alt="" loading="lazy" className="mx-auto h-24 w-full object-contain" style={{ transform: `rotate(${page.rotation}deg)` }} /><span className="mt-1 block">{index + 1}</span>
          </button>)}
        </aside>
        <div ref={viewport} className="min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain bg-slate-100 dark:bg-slate-900" data-testid="pdf-preview-scroll" onScroll={() => {
          cancelAnimationFrame(scrollFrame.current);
          scrollFrame.current = requestAnimationFrame(() => {
            if (!viewport.current) return;
            const anchor = viewport.current.scrollTop + viewport.current.clientHeight * 0.3;
            let closest = currentId;
            for (const [id, element] of pageElements.current) {
              if (element.offsetTop <= anchor) closest = id;
              else break;
            }
            if (viewport.current.scrollTop + viewport.current.clientHeight >= viewport.current.scrollHeight - 2) closest = pages.at(-1)?.id ?? closest;
            setCurrentId(closest);
          });
        }} onKeyDown={(event) => {
          if (event.key === "PageDown" || event.key === "PageUp") { event.preventDefault(); goTo(currentIndex + (event.key === "PageDown" ? 1 : -1)); }
        }} tabIndex={0} aria-label={t("pdfWorkspace.pageNavigation")}>
          <div className="relative flex min-w-full w-max flex-col items-center gap-6 p-4 sm:p-6">
            {pages.map((page, index) => <section key={page.id} ref={(element) => { if (element) pageElements.current.set(page.id, element); else pageElements.current.delete(page.id); }} className="shrink-0" data-testid="pdf-preview-sheet" data-preview-page={page.id}>
              <p className="mb-2 max-w-full text-xs text-slate-600 dark:text-slate-300">{t("pdfWorkspace.pageOf", { page: index + 1, total: pages.length })} · <span data-testid="pdf-page-format">{pdfPageSizeLabel(page, i18n.language)}</span>{!page.included ? ` · ${t("pdfWorkspace.excluded")}` : ""}</p>
              <PageImage page={page} settings={settings} viewport={viewport} zoom={fitZoom} />
            </section>)}
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>;
}

function PageImage({ page, settings, viewport, zoom }: { page: WorkspacePage; settings: PdfWorkspaceSettings; viewport: React.RefObject<HTMLDivElement | null>; zoom: number }) {
  const { t } = useTranslation();
  const element = useRef<HTMLDivElement>(null);
  const [nearby, setNearby] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const dimensions = pdfPageDimensions(page);
  const width = dimensions.width * 4 / 3 * zoom;
  const height = dimensions.height * 4 / 3 * zoom;
  const pixelRatio = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  const requiredSide = Math.min(4096, Math.max(1600, Math.ceil(Math.max(width, height) * Math.min(pixelRatio, 2) / 800) * 800));
  const settingsKey = JSON.stringify(settings);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setNearby(entry.isIntersecting), { root: viewport.current, rootMargin: "300px" });
    if (element.current) observer.observe(element.current);
    return () => observer.disconnect();
  }, [viewport]);
  useEffect(() => {
    if (!nearby) { setPreview(null); return; }
    const request = new AbortController();
    previewPdfSource(page.file, request.signal, page.page, JSON.parse(settingsKey), requiredSide)
      .then((result) => { if (!request.signal.aborted) setPreview(result[0].preview); })
      .catch(() => { /* Keep the existing thumbnail when a detailed render fails. */ });
    return () => request.abort();
  }, [nearby, page.file, page.page, settingsKey, requiredSide]);
  return <div ref={element} style={{ width, height }} className={cn("relative overflow-hidden bg-white shadow-md ring-1 ring-black/10", !page.included && "opacity-50")}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={preview ?? page.preview} alt={t("pdfWorkspace.pageLabel", { name: page.file.name, page: page.page + 1 })} draggable={false} className="absolute left-1/2 top-1/2 max-w-none" data-testid="pdf-preview-page-image" style={{ width: page.width * 4 / 3 * zoom, height: page.height * 4 / 3 * zoom, transform: `translate(-50%, -50%) rotate(${page.rotation}deg)` }} />
  </div>;
}
