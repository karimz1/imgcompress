"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, ArrowLeftRight, ArrowUp, ArrowDown, Maximize, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { usePdfPageSort } from "./usePdfPageSort";
import { cn } from "@/lib/utils";
import { movePdfPages, pdfPageDimensions, pdfPageSizeLabel, previewPdfSource, type PdfWorkspaceSettings, type WorkspacePage } from "@/lib/pdfWorkspace";

interface Props {
  pages: WorkspacePage[];
  initialPage: WorkspacePage | null;
  settings: PdfWorkspaceSettings;
  onChange: (update: (pages: WorkspacePage[]) => WorkspacePage[]) => void;
  onClose: () => void;
  returnFocus: () => void;
}

export function PdfDocumentPreview({ pages, initialPage, settings, onChange, onClose, returnFocus }: Props) {
  const { t, i18n } = useTranslation();
  const viewport = useRef<HTMLDivElement>(null);
  const [viewportNode, setViewportNode] = useState<HTMLDivElement | null>(null);
  const mountViewport = useCallback((element: HTMLDivElement | null) => { viewport.current = element; setViewportNode(element); }, []);
  const pageElements = useRef(new Map<string, HTMLElement>());
  const [currentId, setCurrentId] = useState("");
  const [marked, setMarked] = useState<Set<string>>(new Set());
  const anchor = useRef("");
  const [hideExcluded, setHideExcluded] = useState(false);
  const [mode, setMode] = useState<"page" | "width" | "custom">("page");
  const [percent, setPercent] = useState(100);
  const [zoomDraft, setZoomDraft] = useState("100");
  const [pageDraft, setPageDraft] = useState("1");
  const [viewSize, setViewSize] = useState({ width: 800, height: 600 });
  const [panning, setPanning] = useState(false);
  const pan = useRef<{ id: number; x: number; y: number; left: number; top: number; moved: boolean; pageId?: string } | null>(null);
  const suppressPanClick = useRef(false);
  const scrollFrame = useRef(0);
  const zoomFrame = useRef(0);
  const visiblePages = hideExcluded ? pages.filter((page) => page.included) : pages;
  const visibleIds = new Set(visiblePages.map((page) => page.id));
  const selected = new Set([...marked].filter((id) => visibleIds.has(id)));
  const currentIndex = Math.max(0, visiblePages.findIndex((page) => page.id === currentId));
  const currentPage = visiblePages[currentIndex];
  const dimensions = initialPage ? pdfPageDimensions(initialPage) : { width: 595, height: 842 };
  // Fit stays stable while scrolling through mixed paper sizes.
  const zoom = Math.max(0.1, Math.min(4, mode === "custom" ? percent / 100 : Math.min(
    (viewSize.width - 48) / (dimensions.width * 4 / 3),
    mode === "page" ? (viewSize.height - 90) / (dimensions.height * 4 / 3) : Infinity,
  )));
  const displayedZoom = Math.round(zoom * 100);
  const sort = usePdfPageSort(pages, onChange, !initialPage, selected);

  useEffect(() => {
    if (!initialPage) return;
    setCurrentId(initialPage.id); setMarked(new Set([initialPage.id]));
    anchor.current = initialPage.id;
    setHideExcluded(false); setMode("page");
  }, [initialPage]);
  useEffect(() => { if (mode !== "custom") setZoomDraft(String(displayedZoom)); }, [displayedZoom, mode]);
  useEffect(() => setPageDraft(String(currentIndex + 1)), [currentIndex]);
  useEffect(() => {
    if (!initialPage || !viewportNode) return;
    const element = viewportNode;
    const observer = new ResizeObserver(() => setViewSize({ width: element.clientWidth, height: element.clientHeight }));
    observer.observe(element);
    setViewSize({ width: element.clientWidth, height: element.clientHeight });
    return () => observer.disconnect();
  }, [initialPage, viewportNode]);
  useEffect(() => () => { cancelAnimationFrame(scrollFrame.current); cancelAnimationFrame(zoomFrame.current); }, []);
  useLayoutEffect(() => {
    const element = initialPage && pageElements.current.get(initialPage.id);
    if (element && viewport.current) viewport.current.scrollTop = element.offsetTop;
  }, [initialPage, viewportNode, viewSize.width, viewSize.height]);

  function goTo(index: number) {
    const target = Math.max(0, Math.min(visiblePages.length - 1, Number.isFinite(index) ? index : 0));
    const page = visiblePages[target];
    const element = page && pageElements.current.get(page.id);
    if (!element || !viewport.current) return;
    setCurrentId(page.id); setPageDraft(String(target + 1));
    viewport.current.scrollTo({ top: element.offsetTop, behavior: "instant" });
  }

  function markPage(id: string, shift = false, additive = false) {
    const start = visiblePages.findIndex((page) => page.id === anchor.current);
    const end = visiblePages.findIndex((page) => page.id === id);
    if (shift && start >= 0 && end >= 0) {
      const range = visiblePages.slice(Math.min(start, end), Math.max(start, end) + 1).map((page) => page.id);
      setMarked(new Set(additive ? [...selected, ...range] : range));
    } else {
      setMarked((previous) => {
        if (!additive) return new Set([id]);
        const next = new Set(previous);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
      anchor.current = id;
    }
  }

  function toggleIncluded(ids: ReadonlySet<string>) {
    const include = !pages.filter((page) => ids.has(page.id)).every((page) => page.included);
    onChange((items) => items.map((page) => ids.has(page.id) ? { ...page, included: include } : page));
  }

  function moveMarked(direction: -1 | 1) {
    const indices = visiblePages.flatMap((page, index) => selected.has(page.id) ? [index] : []);
    const index = direction < 0 ? Math.min(...indices) - 1 : Math.max(...indices) + 1;
    const target = visiblePages[index];
    if (target) onChange((items) => movePdfPages(items, selected, target.id));
  }

  function changeZoom(value: number, point?: { x: number; y: number }) {
    const next = Math.round(Math.max(10, Math.min(400, Number.isFinite(value) ? value : 100)));
    if (next === displayedZoom) { setZoomDraft(String(next)); return; }
    const scroller = viewport.current;
    const element = currentPage && pageElements.current.get(currentPage.id);
    const position = point ?? { x: (scroller?.clientWidth ?? 0) / 2, y: (scroller?.clientHeight ?? 0) / 2 };
    const relativeX = (scroller?.scrollLeft ?? 0) + position.x - (element?.offsetLeft ?? 0);
    const relativeY = (scroller?.scrollTop ?? 0) + position.y - (element?.offsetTop ?? 0);
    const ratio = next / (zoom * 100);
    setMode("custom"); setPercent(next); setZoomDraft(String(Math.round(next)));
    cancelAnimationFrame(zoomFrame.current);
    zoomFrame.current = requestAnimationFrame(() => {
      if (!scroller || !element) return;
      scroller.scrollLeft = element.offsetLeft + relativeX * ratio - position.x;
      scroller.scrollTop = element.offsetTop + relativeY * ratio - position.y;
    });
  }
  const wheelZoom = useRef(changeZoom);
  wheelZoom.current = changeZoom;
  const zoomValue = useRef(displayedZoom);
  zoomValue.current = displayedZoom;
  useEffect(() => {
    const element = viewportNode;
    if (!element || !initialPage) return;
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      wheelZoom.current(zoomValue.current * Math.exp(-Math.max(-100, Math.min(100, event.deltaY)) * 0.003), { x: event.clientX - rect.left, y: event.clientY - rect.top });
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, [initialPage, viewportNode]);

  function shortcuts(event: React.KeyboardEvent) {
    if ((event.target as HTMLElement).closest("input,textarea,select,[contenteditable=true]") || event.altKey) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
      event.preventDefault(); setMarked(new Set(visiblePages.map((page) => page.id))); return;
    }
    const button = (event.target as HTMLElement).closest("button");
    if (event.code === "Space" && (!button || button.hasAttribute("data-pdf-sort-surface"))) {
      event.preventDefault(); if (!event.repeat && selected.size) toggleIncluded(selected); return;
    }
    if (["ArrowDown", "ArrowUp", "PageDown", "PageUp"].includes(event.key) && !button) {
      event.preventDefault();
      const next = Math.max(0, Math.min(visiblePages.length - 1, currentIndex + (["ArrowDown", "PageDown"].includes(event.key) ? 1 : -1)));
      if (visiblePages[next]) markPage(visiblePages[next].id, event.shiftKey, event.ctrlKey || event.metaKey);
      goTo(next);
    }
  }

  const includeLabel = (page: WorkspacePage) => t("pdfWorkspace.include", { name: t("pdfWorkspace.pageLabel", { name: page.file.name, page: page.page + 1 }) });
  return <Dialog open={!!initialPage} onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="flex h-[94dvh] w-[97vw] max-w-7xl flex-col gap-0 overflow-hidden rounded-xl p-0" data-testid="pdf-document-preview" onKeyDown={shortcuts} onEscapeKeyDown={(event) => { event.preventDefault(); event.stopPropagation(); if (!sort.isDragging()) onClose(); }} onCloseAutoFocus={(event) => { event.preventDefault(); returnFocus(); }}>
      <DialogHeader className="shrink-0 border-b p-3 pr-12 text-start">
        <DialogTitle className="truncate">{currentPage?.file.name ?? initialPage?.file.name}</DialogTitle>
        <DialogDescription>{t("pdfWorkspace.pageOf", { page: visiblePages.length ? currentIndex + 1 : 0, total: visiblePages.length })}{currentPage ? ` · ${pdfPageSizeLabel(currentPage, i18n.language)}` : ""}</DialogDescription>
      </DialogHeader>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b p-2" data-testid="pdf-preview-toolbar">
        <div className="flex items-center gap-1">
          <Button type="button" size="icon" variant="ghost" className="h-9 w-9" disabled={!visiblePages.length || currentIndex === 0} aria-label={t("pdfWorkspace.previousPage")} onClick={() => goTo(currentIndex - 1)}><ArrowLeft /></Button>
          <Input type="number" min={1} max={visiblePages.length} disabled={!visiblePages.length} className="h-9 w-16 text-center" aria-label={t("pdfWorkspace.goToPage")} value={visiblePages.length ? pageDraft : "0"} onChange={(event) => setPageDraft(event.target.value)} onBlur={() => { if (Number(pageDraft) !== currentIndex + 1) goTo(Number(pageDraft) - 1 || 0); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); goTo(Number(pageDraft) - 1 || 0); } }} />
          <span className="text-sm">/ {visiblePages.length}</span>
          <Button type="button" size="icon" variant="ghost" className="h-9 w-9" disabled={!visiblePages.length || currentIndex === visiblePages.length - 1} aria-label={t("pdfWorkspace.nextPage")} onClick={() => goTo(currentIndex + 1)}><ArrowRight /></Button>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs"><input type="checkbox" checked={hideExcluded} onChange={(event) => setHideExcluded(event.target.checked)} className="h-4 w-4 accent-blue-600" />{t("pdfWorkspace.hideExcluded")}</label>
        <div className="flex items-center gap-1">
          <Button type="button" size="icon" variant="ghost" className="h-9 w-9" disabled={displayedZoom <= 10} aria-label={t("pdfWorkspace.zoomOut")} onClick={() => changeZoom(displayedZoom - 25)}><Minus /></Button>
          <Input type="number" min={10} max={400} step={25} className="h-9 w-[4.5rem] text-center" aria-label={t("pdfWorkspace.zoom")} value={zoomDraft} onChange={(event) => setZoomDraft(event.target.value)} onBlur={(event) => { if (Number(event.currentTarget.value) !== displayedZoom) changeZoom(Number(event.currentTarget.value)); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); changeZoom(Number(event.currentTarget.value)); } }} /><span className="text-sm">%</span>
          <Button type="button" size="icon" variant="ghost" className="h-9 w-9" disabled={displayedZoom >= 400} aria-label={t("pdfWorkspace.zoomIn")} onClick={() => changeZoom(displayedZoom + 25)}><Plus /></Button>
          <Button type="button" size="icon" variant={mode === "page" ? "secondary" : "ghost"} className="h-9 w-9" aria-label={t("pdfWorkspace.fitPage")} title={t("pdfWorkspace.fitPage")} onClick={() => setMode("page")}><Maximize /></Button>
          <Button type="button" size="icon" variant={mode === "width" ? "secondary" : "ghost"} className="h-9 w-9" aria-label={t("pdfWorkspace.fitWidth")} title={t("pdfWorkspace.fitWidth")} onClick={() => setMode("width")}><ArrowLeftRight /></Button>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-1 text-xs">
        <span aria-live="polite" data-testid="pdf-preview-marked">{t("pdfWorkspace.markedPages", { count: selected.size })}</span>
        <Button type="button" size="sm" variant="ghost" disabled={!selected.size} onClick={() => toggleIncluded(selected)}>{t("pdfWorkspace.toggleMarked")}</Button>
        <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={!selected.size || selected.has(visiblePages[0]?.id)} aria-label={t("pdfWorkspace.moveMarkedEarlier")} onClick={() => moveMarked(-1)}><ArrowUp /></Button>
        <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={!selected.size || selected.has(visiblePages.at(-1)?.id ?? "")} aria-label={t("pdfWorkspace.moveMarkedLater")} onClick={() => moveMarked(1)}><ArrowDown /></Button>
        <details className="ms-auto max-w-full text-muted-foreground"><summary className="cursor-pointer py-1">{t("pdfWorkspace.shortcuts")}</summary><p className="max-w-2xl pb-2" data-testid="pdf-preview-shortcuts">{t("pdfWorkspace.shortcutHelp")}</p></details>
      </div>
      <div className="flex min-h-0 flex-1">
        <aside ref={sort.scrollRef} className="hidden w-36 shrink-0 overflow-auto border-e bg-muted/30 p-3 md:block" aria-label={t("pdfWorkspace.pageNavigation")}>
          <div ref={sort.gridRef} className="relative space-y-3" onClickCapture={sort.onClickCapture}>
            {visiblePages.map((page, index) => <div key={page.id} data-page-id={page.id} onPointerDown={(event) => sort.onPointerDown(event, page.id)} onTouchStart={(event) => sort.onTouchStart(event, page.id)} onDragStart={(event) => event.preventDefault()} className={cn("relative select-none rounded border text-xs", selected.has(page.id) ? "border-blue-500 bg-blue-500/10 ring-1 ring-blue-500" : "border-transparent hover:border-muted-foreground", sort.dragged === page.id && "opacity-20")} data-testid="pdf-preview-thumbnail" data-marked={selected.has(page.id)}>
              <input type="checkbox" checked={page.included} onChange={() => toggleIncluded(new Set([page.id]))} aria-label={includeLabel(page)} className="absolute start-2 top-2 z-10 h-4 w-4 accent-blue-600" />
              <button type="button" data-pdf-sort-surface aria-pressed={selected.has(page.id)} onClick={(event) => { markPage(page.id, event.shiftKey, event.ctrlKey || event.metaKey); goTo(index); }} aria-current={page.id === currentPage?.id ? "page" : undefined} aria-label={t("pdfWorkspace.outputPage", { page: index + 1 })} className="block w-full cursor-grab rounded px-2 pb-2 pt-6 focus-visible:outline-2 focus-visible:outline-blue-500 active:cursor-grabbing">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={page.preview} alt="" draggable={false} loading="lazy" className={cn("pointer-events-none mx-auto h-24 w-full object-contain", !page.included && "opacity-40")} style={{ transform: `rotate(${page.rotation}deg)` }} /><span className="mt-1 block">{index + 1}</span>
              </button>
            </div>)}
          </div>
        </aside>
        <div ref={mountViewport} className={cn("min-h-0 min-w-0 flex-1 touch-pan-x touch-pan-y select-none overflow-auto overscroll-contain bg-slate-100 outline-offset-[-2px] dark:bg-slate-900", panning ? "cursor-grabbing" : "cursor-grab")} data-testid="pdf-preview-scroll" onScroll={() => {
          cancelAnimationFrame(scrollFrame.current);
          scrollFrame.current = requestAnimationFrame(() => {
            if (!viewport.current) return;
            const position = viewport.current.scrollTop + viewport.current.clientHeight * 0.3;
            let closest = visiblePages[0]?.id ?? "";
            for (const page of visiblePages) {
              const element = pageElements.current.get(page.id);
              if (element && element.offsetTop <= position) closest = page.id; else break;
            }
            if (viewport.current.scrollTop + viewport.current.clientHeight >= viewport.current.scrollHeight - 2) closest = visiblePages.at(-1)?.id ?? closest;
            setCurrentId(closest);
          });
        }} onPointerDown={(event) => {
          if (event.pointerType === "touch" || event.button !== 0 || (event.target as HTMLElement).closest("button,input,label")) return;
          const element = event.currentTarget;
          element.focus({ preventScroll: true });
          pan.current = { id: event.pointerId, x: event.clientX, y: event.clientY, left: element.scrollLeft, top: element.scrollTop, moved: false, pageId: (event.target as HTMLElement).closest<HTMLElement>("[data-preview-page]")?.dataset.previewPage };
          element.setPointerCapture(event.pointerId);
        }} onPointerMove={(event) => {
          const start = pan.current;
          if (!start || start.id !== event.pointerId) return;
          const dx = event.clientX - start.x, dy = event.clientY - start.y;
          if (Math.hypot(dx, dy) > 4) { start.moved = true; setPanning(true); }
          if (start.moved) { event.currentTarget.scrollLeft = start.left - dx; event.currentTarget.scrollTop = start.top - dy; }
        }} onPointerUp={(event) => {
          const start = pan.current;
          if (!start) return;
          suppressPanClick.current = true;
          if (!start.moved && start.pageId) markPage(start.pageId, event.shiftKey, event.ctrlKey || event.metaKey);
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
          pan.current = null; setPanning(false);
          window.setTimeout(() => { suppressPanClick.current = false; }, 0);
        }} onLostPointerCapture={() => { pan.current = null; setPanning(false); }} onPointerCancel={() => { pan.current = null; setPanning(false); }} onClick={(event) => {
          if (suppressPanClick.current || (event.target as HTMLElement).closest("input,label,button")) return;
          const id = (event.target as HTMLElement).closest<HTMLElement>("[data-preview-page]")?.dataset.previewPage;
          if (id) markPage(id, event.shiftKey, event.ctrlKey || event.metaKey);
        }} tabIndex={0} aria-label={t("pdfWorkspace.pageNavigation")}>
          {!visiblePages.length && <p className="p-8 text-center text-sm text-muted-foreground">{t("pdfWorkspace.noVisiblePages")}</p>}
          <div className="relative flex min-w-full w-max flex-col items-center gap-6 p-4 sm:p-6">
            {visiblePages.map((page, index) => <section key={page.id} ref={(element) => { if (element) pageElements.current.set(page.id, element); else pageElements.current.delete(page.id); }} className="shrink-0" data-testid="pdf-preview-sheet" data-preview-page={page.id} data-marked={selected.has(page.id)}>
              <label className="mb-2 flex max-w-full cursor-pointer items-center gap-2 text-xs text-slate-600 dark:text-slate-300"><input type="checkbox" checked={page.included} onChange={() => toggleIncluded(new Set([page.id]))} aria-label={includeLabel(page)} className="h-4 w-4 accent-blue-600" /><span>{t("pdfWorkspace.pageOf", { page: index + 1, total: visiblePages.length })} · <span data-testid="pdf-page-format">{pdfPageSizeLabel(page, i18n.language)}</span>{!page.included ? ` · ${t("pdfWorkspace.excluded")}` : ""}</span></label>
              <PageImage page={page} settings={settings} viewport={viewport} zoom={zoom} marked={selected.has(page.id)} />
            </section>)}
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>;
}

function PageImage({ page, settings, viewport, zoom, marked }: { page: WorkspacePage; settings: PdfWorkspaceSettings; viewport: React.RefObject<HTMLDivElement | null>; zoom: number; marked: boolean }) {
  const { t } = useTranslation();
  const element = useRef<HTMLDivElement>(null);
  const [nearby, setNearby] = useState(false);
  const [preview, setPreview] = useState<{ src: string; side: number } | null>(null);
  const dimensions = pdfPageDimensions(page);
  const width = dimensions.width * 4 / 3 * zoom;
  const height = dimensions.height * 4 / 3 * zoom;
  const pixelRatio = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  const requiredSide = Math.min(8192, Math.max(1600, Math.ceil(Math.max(width, height) * Math.min(pixelRatio, 2) / 800) * 800));
  const settingsKey = JSON.stringify(settings);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setNearby(entry.isIntersecting), { root: viewport.current, rootMargin: "300px" });
    if (element.current) observer.observe(element.current);
    return () => observer.disconnect();
  }, [viewport]);
  useEffect(() => { setPreview(null); }, [page.file, page.page, settingsKey]);
  useEffect(() => {
    if (!nearby) { setPreview(null); return; }
    if (preview && preview.side >= requiredSide) return;
    const request = new AbortController();
    // Avoid repeatedly uploading and rendering the source during wheel gestures.
    const timer = window.setTimeout(() => {
      previewPdfSource(page.file, request.signal, page.page, JSON.parse(settingsKey), requiredSide)
        .then((result) => { if (!request.signal.aborted) setPreview({ src: result[0].preview, side: requiredSide }); })
        .catch(() => { /* Keep the previous raster if a detailed render fails. */ });
    }, 150);
    return () => { clearTimeout(timer); request.abort(); };
  }, [nearby, page.file, page.page, settingsKey, requiredSide, preview]);
  return <div ref={element} style={{ width, height }} className={cn("relative overflow-hidden bg-white shadow-md ring-1 ring-black/10", !page.included && "opacity-50", marked && "ring-2 ring-blue-500")}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={preview?.src ?? page.preview} alt={t("pdfWorkspace.pageLabel", { name: page.file.name, page: page.page + 1 })} draggable={false} className="pointer-events-none absolute left-1/2 top-1/2 max-w-none" data-testid="pdf-preview-page-image" style={{ width: page.width * 4 / 3 * zoom, height: page.height * 4 / 3 * zoom, transform: `translate(-50%, -50%) rotate(${page.rotation}deg)` }} />
  </div>;
}
