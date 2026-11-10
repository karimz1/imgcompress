export const PDF_WORKSPACE_ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.avif,.gif,.bmp,.tif,.tiff,.heic,.heif";
export const PDF_WORKSPACE_MAX_PAGES = 500;

export interface PdfWorkspaceSettings {
  apply_layout: boolean;
  pdf_preset: string;
  pdf_scale: string;
  pdf_margin_mm: string;
  pdf_paginate: boolean;
  pdf_quality: string;
}

export function appendPdfSettings(body: FormData, settings: PdfWorkspaceSettings) {
  Object.entries(settings).forEach(([key, value]) => body.append(key, String(value)));
}

export interface PdfPagePreview {
  page: number;
  width: number;
  height: number;
  preview: string;
  source_page?: number;
  part?: number;
}

export interface WorkspacePage extends PdfPagePreview {
  id: string;
  sourceId: string;
  file: File;
  included: boolean;
  rotation: number;
}

export interface SavedPdfSelection {
  pages: WorkspacePage[];
  settings: PdfWorkspaceSettings;
  filename: string;
  ocr: boolean;
  language: string;
}

export interface LocalPdfFile {
  id: number;
  filename: string;
  url: string;
  pageCount: number;
}

export function pdfFilename(value: string): string {
  return `${value.trim().replace(/\.pdf$/i, "").replace(/[<>:"/\\|?*\x00-\x1f]/g, "_") || "merged"}.pdf`;
}

export async function createWorkspacePdf(selection: SavedPdfSelection, signal: AbortSignal): Promise<Blob> {
  const selected = selection.pages.filter((page) => page.included);
  if (!selected.length) throw new Error("Select at least one page.");
  const body = new FormData();
  const sources = [...new Set(selected.map((page) => page.sourceId))];
  sources.forEach((source) => body.append("files", selected.find((page) => page.sourceId === source)!.file));
  body.append("pages", JSON.stringify(selected.map((page) => ({ source: sources.indexOf(page.sourceId), page: page.page, rotation: page.rotation }))));
  appendPdfSettings(body, selection.settings);
  body.append("ocr", String(selection.ocr));
  if (selection.ocr) body.append("ocr_language", selection.language);
  const response = await fetch("/api/pdf/merge", { method: "POST", body, signal });
  if (!response.ok) throw new Error(await pdfResponseError(response));
  return response.blob();
}

/** Carry page choices across paper-size, quality, pagination and mode changes. */
export async function preparePdfSelection(selection: SavedPdfSelection, settings: PdfWorkspaceSettings, signal: AbortSignal): Promise<SavedPdfSelection> {
  if (JSON.stringify(selection.settings) === JSON.stringify(settings)) return selection;
  const pages: WorkspacePage[] = [];
  const rank = new Map<string, number>();
  for (const file of new Set(selection.pages.map((page) => page.file))) {
    const previous = selection.pages.filter((page) => page.file === file);
    const sourceId = previous[0].sourceId;
    const previews = await previewPdfSource(file, signal, undefined, settings);
    for (const preview of previews) {
      if (pages.length >= PDF_WORKSPACE_MAX_PAGES) throw new Error(`The output contains more than ${PDF_WORKSPACE_MAX_PAGES} pages.`);
      const matches = previous.filter((page) => (page.source_page ?? page.page) === (preview.source_page ?? preview.page));
      const exact = matches.find((page) => (page.part ?? 0) === (preview.part ?? 0));
      // Collapsing paginated parts includes their source when any part was included.
      const collapsing = matches.length > 1 && previews.filter((page) => (page.source_page ?? page.page) === (preview.source_page ?? preview.page)).length === 1;
      const included = collapsing ? matches.some((page) => page.included) : exact?.included ?? matches.some((page) => page.included);
      const id = `${sourceId}-${preview.page}`;
      const reference = exact ?? matches[0] ?? previous[0];
      rank.set(id, selection.pages.indexOf(reference) + (preview.part ?? 0) / 10000);
      pages.push({ ...preview, id, sourceId, file, included: matches.length ? included : true, rotation: reference.rotation });
    }
  }
  pages.sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);
  return { ...selection, settings: { ...settings }, pages };
}

export function pdfPageDimensions(page: Pick<WorkspacePage, "width" | "height" | "rotation">) {
  return page.rotation % 180 ? { width: page.height, height: page.width } : { width: page.width, height: page.height };
}

export function pdfPageSizeLabel(page: Pick<WorkspacePage, "width" | "height" | "rotation">, locale: string): string {
  const { width, height } = pdfPageDimensions(page);
  const short = Math.min(width, height);
  const long = Math.max(width, height);
  const formats = [["A3", 842, 1191, 297, 420], ["A4", 595, 842, 210, 297], ["A5", 420, 595, 148, 210], ["Letter", 612, 792, 215.9, 279.4], ["Legal", 612, 1008, 215.9, 355.6]] as const;
  const format = formats.find(([, w, h]) => Math.abs(w - short) < 2 && Math.abs(h - long) < 2);
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const widthMm = format ? format[width > height ? 4 : 3] : width * 25.4 / 72;
  const heightMm = format ? format[width > height ? 3 : 4] : height * 25.4 / 72;
  const size = `${number.format(widthMm)} × ${number.format(heightMm)} mm`;
  return format ? `${format[0]} · ${size}` : size;
}

export async function previewPdfSource(file: File, signal: AbortSignal, page?: number, settings?: PdfWorkspaceSettings, side?: number): Promise<PdfPagePreview[]> {
  const body = new FormData();
  body.append("file", file);
  if (page !== undefined) body.append("page", String(page));
  if (side !== undefined) body.append("side", String(side));
  if (settings) appendPdfSettings(body, settings);
  const response = await fetch("/api/pdf/preview", { method: "POST", body, signal });
  if (!response.ok) throw new Error(await pdfResponseError(response));
  return (await response.json()).pages;
}

export async function pdfResponseError(response: Response): Promise<string> {
  try {
    return (await response.json()).error || `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
}

export function movePdfPage(pages: WorkspacePage[], fromId: string, toId: string): WorkspacePage[] {
  const from = pages.findIndex((page) => page.id === fromId);
  const to = pages.findIndex((page) => page.id === toId);
  if (from < 0 || to < 0 || from === to) return pages;
  const next = [...pages];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}
