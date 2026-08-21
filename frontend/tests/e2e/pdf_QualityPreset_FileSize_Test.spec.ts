import { test, expect, Page, APIRequestContext } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import {
  uploadFilesToDropzoneAsync,
  assertFilesPresentInDropzoneAsync,
  clickConversionButtonAsync,
  setOutputFormatAsync,
  setPdfPresetAsync,
  setPdfScaleAsync,
  setPdfQualityAsync,
  clearStorageManagerAsync,
  assertDownloadLinksAsync,
  assertStorageManagerFileCountAsync,
} from './utls/helpers';
import { downloadFilesAsync } from './utls/downloadHelper';
import { ImageFileDto } from './utls/ImageFileDto';
import { PDF_QUALITY_OPTIONS, type PdfQualityOption } from '../../src/lib/pdfQuality';

const SAMPLE_IMAGE = new ImageFileDto('pexels-pealdesign-28594392.jpg');

/**
 * The presets from lowest to highest quality.
 *
 * The ordering is the assertion this suite owns; the set of presets belongs to
 * the app, and is checked against it below so a newly added preset cannot slip
 * through untested.
 */
const QUALITY_LADDER: readonly PdfQualityOption[] = ['small', 'medium', 'high', 'ultra'];

test('the quality ladder covers every document quality preset the app ships', () => {
  expect([...QUALITY_LADDER].sort()).toEqual([...PDF_QUALITY_OPTIONS].sort());
});

test.describe('PDF document quality', () => {
  test.beforeEach(async ({ request }) => {
    await startFromEmptyStorageAsync(request);
  });

  test('exporting the same image at a higher quality produces a larger PDF', async ({
    page,
    request,
  }) => {
    const sizesInBytes = new Map<PdfQualityOption, number>();

    for (const quality of QUALITY_LADDER) {
      sizesInBytes.set(quality, await exportSampleImageAsPdfAsync(page, request, quality));
    }

    reportMeasuredSizes(sizesInBytes);
    assertFileSizeGrowsAtEveryQualityStep(sizesInBytes);
  });
});

async function startFromEmptyStorageAsync(request: APIRequestContext): Promise<void> {
  await clearStorageManagerAsync(request);
  await assertStorageManagerFileCountAsync(request, 0);
}

async function exportSampleImageAsPdfAsync(
  page: Page,
  request: APIRequestContext,
  quality: PdfQualityOption
): Promise<number> {
  await startFromEmptyStorageAsync(request);
  await page.goto('/');

  await choosePdfExportSettingsAsync(page, quality);
  await convertSampleImageAsync(page);

  const exportedPdfPath = await downloadExportedPdfAsync(page, quality);
  assertIsReadablePdf(exportedPdfPath);

  return fs.statSync(exportedPdfPath).size;
}

async function choosePdfExportSettingsAsync(page: Page, quality: PdfQualityOption): Promise<void> {
  await setOutputFormatAsync(page, 'PDF');
  await setPdfPresetAsync(page, 'A4 Portrait');
  await setPdfScaleAsync(page, 'Fit');
  await setPdfQualityAsync(page, quality);
}

async function convertSampleImageAsync(page: Page): Promise<void> {
  await uploadFilesToDropzoneAsync(page, [SAMPLE_IMAGE]);
  await assertFilesPresentInDropzoneAsync(page, [SAMPLE_IMAGE]);
  await clickConversionButtonAsync(page);
}

async function downloadExportedPdfAsync(page: Page, quality: PdfQualityOption): Promise<string> {
  const downloadLinks = await assertDownloadLinksAsync(page, [SAMPLE_IMAGE]);

  const downloadedPaths = await downloadFilesAsync(page, downloadLinks);
  expect(downloadedPaths.length).toBe(1);

  // Every run downloads the same suggested filename, so keep each export under a
  // preset specific name instead of letting the next one overwrite it.
  const downloadedPath = downloadedPaths[0];
  const keptPath = path.join(
    path.dirname(downloadedPath),
    `${quality}-${path.basename(downloadedPath)}`
  );
  fs.renameSync(downloadedPath, keptPath);

  return keptPath;
}

function assertIsReadablePdf(filePath: string): void {
  expect(path.extname(filePath).toLowerCase()).toBe('.pdf');
  expect(fs.readFileSync(filePath).subarray(0, 4).toString()).toBe('%PDF');
}

function reportMeasuredSizes(sizesInBytes: Map<PdfQualityOption, number>): void {
  const measured = QUALITY_LADDER.map((q) => `${q}=${sizesInBytes.get(q)} bytes`).join(', ');
  console.log(`PDF size per document quality preset: ${measured}`);
}

/**
 * Asserts the only guarantee the feature actually makes: each step up the ladder
 * renders at a higher DPI and compresses less, so it must yield a larger file.
 *
 * Deliberately no expected byte counts and no minimum growth factor. Those would
 * encode today's Pillow and fpdf encoder behaviour, and a dependency bump that
 * shifts the numbers would fail the suite without anything being broken.
 */
function assertFileSizeGrowsAtEveryQualityStep(
  sizesInBytes: Map<PdfQualityOption, number>
): void {
  for (let step = 1; step < QUALITY_LADDER.length; step++) {
    const lowerQuality = QUALITY_LADDER[step - 1];
    const higherQuality = QUALITY_LADDER[step];

    const lowerSize = sizesInBytes.get(lowerQuality)!;
    const higherSize = sizesInBytes.get(higherQuality)!;

    expect(
      higherSize,
      `'${higherQuality}' (${higherSize} bytes) must produce a larger PDF than '${lowerQuality}' (${lowerSize} bytes)`
    ).toBeGreaterThan(lowerSize);
  }
}
