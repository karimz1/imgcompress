import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import {
  uploadFilesToDropzoneAsync,
  assertFilesPresentInDropzoneAsync,
  clickConversionButtonAsync,
  assertZipButtonNotRenderedAsync,
  assertDownloadLinksAsync,
  setOutputFormatAsync,
  setMaxSizeInMBAsync
} from './utls/helpers';
import { downloadFilesAsync } from './utls/downloadHelper';
import { ImageFileDto } from './utls/ImageFileDto';

/**
 * E2E: JPEG settings mode → Set by File Size
 * - Select JPEG output
 * - Switch to "Set by File Size" mode
 * - Set a small target (e.g., 0.20 MB)
 * - Convert and then verify that a download link appears and downloaded file
 *   is present and does not exceed the selected target size.
 */

 test('JPEG Set by File Size mode produces downloadable file under target size', async ({ page }) => {
  await page.goto('/');

  const files: ImageFileDto[] = [new ImageFileDto('pexels-pealdesign-28594392.jpg')];
  const targetMB = 0.20;

  const targetBytes = Math.round(targetMB * 1024 * 1024);

  await uploadFilesToDropzoneAsync(page, files);
  await assertFilesPresentInDropzoneAsync(page, files);

  await setOutputFormatAsync(page, 'JPEG');

  // Switch JPEG settings mode to Set by File Size
  const sizeModeBtn = page.getByRole('button', { name: /Set by File Size/i });
  await sizeModeBtn.click();

  await setMaxSizeInMBAsync(page, targetMB);

  await clickConversionButtonAsync(page);
  await assertZipButtonNotRenderedAsync(page);

  // Ensure there is a download link and download the file
  const linkLocator = await assertDownloadLinksAsync(page, files);
  const downloadedPaths = await downloadFilesAsync(page, linkLocator);

  expect(downloadedPaths.length).toBe(1);
  const downloadedPath = downloadedPaths[0];
  expect(fs.existsSync(downloadedPath)).toBeTruthy();

  // Assert size is <= targetBytes (allow a small overhead of a few bytes)
  const stat = fs.statSync(downloadedPath);
  expect(stat.size).toBeLessThanOrEqual(targetBytes + 2048); // +2KB tolerance for headers/metadata

  expect(path.extname(downloadedPath).toLowerCase()).toBe('.jpg');
});