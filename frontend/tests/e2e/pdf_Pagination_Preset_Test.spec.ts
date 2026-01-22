import { test, expect, Page, Locator } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import {
  clearStorageManagerAsync,
  assertStorageManagerFileCountAsync,
  setOutputFormatAsync,
  setPdfPresetAsync,
  setPdfScaleAsync,
  setPdfMarginMmAsync,
  setPdfPaginateEnabledAsync,
  clickConversionButtonAsync,
  waitForSupportedFormatsCountAsync,
} from './utls/helpers';
import { downloadFilesAsync } from './utls/downloadHelper';

type TempImage = { filePath: string; cleanup: () => void };

async function createTempImage(width: number, height: number, name: string): Promise<TempImage> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'imgcompress-e2e-'));
  const filePath = path.join(dir, name);
  await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 130, g: 50, b: 50 },
    },
  })
    .png()
    .toFile(filePath);

  return {
    filePath,
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

async function loadPdfFromDownload(page: Page, downloadLinks: Locator): Promise<Buffer> {
  const downloadedPaths = await downloadFilesAsync(page, downloadLinks);
  expect(downloadedPaths.length).toBe(1);
  return fs.readFileSync(downloadedPaths[0]);
}

test.beforeEach(async ({ request }) => {
  await clearStorageManagerAsync(request);
  await assertStorageManagerFileCountAsync(request, 0);
});

test('splits long images into multiple A4 pages with pagination', async ({ page }) => {
  await page.goto('/');

  await setOutputFormatAsync(page, 'PDF');
  await setPdfPresetAsync(page, 'A4 Auto');
  await setPdfScaleAsync(page, 'Fit');
  await setPdfMarginMmAsync(page, 10);
  await setPdfPaginateEnabledAsync(page, true);

  const pdfScaleSelect = page.locator('#pdfScale');
  await expect(pdfScaleSelect).toBeDisabled();

  const tempImage = await createTempImage(800, 3000, 'long.png');
  try {
    await waitForSupportedFormatsCountAsync(page);
    await page.locator('[data-testid="dropzone-input"]').setInputFiles(tempImage.filePath);

    await clickConversionButtonAsync(page);

    const downloadLinks = page.locator('[data-testid="drawer-uploaded-file-item-link"]');
    await expect(downloadLinks).toHaveCount(1);

    const pdfBytes = await loadPdfFromDownload(page, downloadLinks);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    expect(pdfDoc.getPageCount()).toBeGreaterThan(1);

    const firstPage = pdfDoc.getPage(0);
    const { width, height } = firstPage.getSize();
    expect(Math.round(width)).toBe(595);
    expect(Math.round(height)).toBe(842);
  } finally {
    tempImage.cleanup();
  }
});

test('auto-rotates A4 preset for wide images', async ({ page }) => {
  await page.goto('/');

  await setOutputFormatAsync(page, 'PDF');
  await setPdfPresetAsync(page, 'A4 Auto');
  await setPdfScaleAsync(page, 'Fit');
  await setPdfMarginMmAsync(page, 0);
  await setPdfPaginateEnabledAsync(page, false);

  const pdfScaleSelect = page.locator('#pdfScale');
  await expect(pdfScaleSelect).toBeEnabled();

  const tempImage = await createTempImage(2000, 900, 'wide.png');
  try {
    await waitForSupportedFormatsCountAsync(page);
    await page.locator('[data-testid="dropzone-input"]').setInputFiles(tempImage.filePath);

    await clickConversionButtonAsync(page);

    const downloadLinks = page.locator('[data-testid="drawer-uploaded-file-item-link"]');
    await expect(downloadLinks).toHaveCount(1);

    const pdfBytes = await loadPdfFromDownload(page, downloadLinks);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    expect(pdfDoc.getPageCount()).toBe(1);

    const firstPage = pdfDoc.getPage(0);
    const { width, height } = firstPage.getSize();
    expect(Math.round(width)).toBe(842);
    expect(Math.round(height)).toBe(595);
  } finally {
    tempImage.cleanup();
  }
});
