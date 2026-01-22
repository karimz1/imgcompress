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
  clearStorageManagerAsync,
  assertStorageManagerFileCountAsync,
} from './utls/helpers';
import { downloadFilesAsync } from './utls/downloadHelper';
import { ImageFileDto } from './utls/ImageFileDto';

test.beforeEach(async ({ request }) => {
  await clearStorageManagerAsync(request);
  await assertStorageManagerFileCountAsync(request, 0);
});

test('exports a JPG as a PDF', async ({ page }) => {
  await page.goto('/');

  const files: ImageFileDto[] = [new ImageFileDto('pexels-pealdesign-28594392.jpg')];

  await setOutputFormatAsync(page, 'PDF');
  await setPdfPresetAsync(page, 'A4 Auto');
  await setPdfScaleAsync(page, 'Fit');
  await uploadFilesToDropzoneAsync(page, files);
  await assertFilesPresentInDropzoneAsync(page, files);

  await clickConversionButtonAsync(page);

  const downloadLinks = page.locator('[data-testid="drawer-uploaded-file-item-link"]');
  await expect(downloadLinks).toHaveCount(1);
  const linkText = (await downloadLinks.first().textContent()) || '';
  expect(linkText.toLowerCase()).toContain('.pdf');

  const downloadedPaths = await downloadFilesAsync(page, downloadLinks);
  expect(downloadedPaths.length).toBe(1);

  const downloadedPath = downloadedPaths[0];
  expect(fs.existsSync(downloadedPath)).toBeTruthy();
  expect(path.extname(downloadedPath).toLowerCase()).toBe('.pdf');

  const header = fs.readFileSync(downloadedPath).subarray(0, 4);
  expect(header.toString()).toBe('%PDF');
});
