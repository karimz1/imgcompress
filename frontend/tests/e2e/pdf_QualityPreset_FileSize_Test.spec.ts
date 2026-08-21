import { test, expect } from '@playwright/test';
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
  assertStorageManagerFileCountAsync,
  PDF_QUALITY_KEYS,
  type PdfQualityKey,
} from './utls/helpers';
import { downloadFilesAsync } from './utls/downloadHelper';
import { ImageFileDto } from './utls/ImageFileDto';

// Lowest to highest. Each preset caps the render DPI and the JPEG quality of the
// embedded images, so stepping up the ladder must produce a larger PDF.
const QUALITY_LADDER: readonly PdfQualityKey[] = PDF_QUALITY_KEYS;

// Measured separation between neighbouring presets is roughly 2.5x for this
// fixture. Asserting a 1.2x floor proves the preset actually changed the output
// rather than differing by a handful of bytes, while leaving plenty of headroom.
const MIN_GROWTH_FACTOR = 1.2;

test.beforeEach(async ({ request }) => {
  await clearStorageManagerAsync(request);
  await assertStorageManagerFileCountAsync(request, 0);
});

test('document quality presets produce progressively larger PDFs', async ({ page, request }) => {
  const file = new ImageFileDto('pexels-pealdesign-28594392.jpg');
  const sizesInBytes = new Map<PdfQualityKey, number>();

  for (const quality of QUALITY_LADDER) {
    await clearStorageManagerAsync(request);
    await page.goto('/');

    await setOutputFormatAsync(page, 'PDF');
    await setPdfPresetAsync(page, 'A4 Portrait');
    await setPdfScaleAsync(page, 'Fit');
    await setPdfQualityAsync(page, quality);

    await uploadFilesToDropzoneAsync(page, [file]);
    await assertFilesPresentInDropzoneAsync(page, [file]);
    await clickConversionButtonAsync(page);

    const downloadLinks = page.locator('[data-testid="drawer-uploaded-file-item-link"]');
    await expect(downloadLinks).toHaveCount(1);

    const downloadedPaths = await downloadFilesAsync(page, downloadLinks);
    expect(downloadedPaths.length).toBe(1);

    // Every run downloads the same suggested filename, so keep each export under
    // a preset specific name instead of letting the next iteration overwrite it.
    const downloadedPath = downloadedPaths[0];
    const keptPath = path.join(
      path.dirname(downloadedPath),
      `${quality}-${path.basename(downloadedPath)}`
    );
    fs.renameSync(downloadedPath, keptPath);

    expect(path.extname(keptPath).toLowerCase()).toBe('.pdf');
    expect(fs.readFileSync(keptPath).subarray(0, 4).toString()).toBe('%PDF');

    sizesInBytes.set(quality, fs.statSync(keptPath).size);
  }

  console.log(
    'PDF size per document quality preset:',
    QUALITY_LADDER.map((q) => `${q}=${sizesInBytes.get(q)} bytes`).join(', ')
  );

  for (let i = 1; i < QUALITY_LADDER.length; i++) {
    const lower = QUALITY_LADDER[i - 1];
    const higher = QUALITY_LADDER[i];
    const lowerSize = sizesInBytes.get(lower)!;
    const higherSize = sizesInBytes.get(higher)!;

    expect(
      higherSize,
      `'${higher}' (${higherSize} bytes) must be at least ${MIN_GROWTH_FACTOR}x '${lower}' (${lowerSize} bytes)`
    ).toBeGreaterThan(lowerSize * MIN_GROWTH_FACTOR);
  }
});
