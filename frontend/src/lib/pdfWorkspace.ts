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
}

export interface WorkspacePage extends PdfPagePreview {
  id: string;
  sourceId: string;
  file: File;
  included: boolean;
  rotation: number;
}

export async function previewPdfSource(file: File, signal: AbortSignal, page?: number, settings?: PdfWorkspaceSettings): Promise<PdfPagePreview[]> {
  const body = new FormData();
  body.append("file", file);
  if (page !== undefined) body.append("page", String(page));
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
