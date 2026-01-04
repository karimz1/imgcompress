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
  setMaxSizeInMBAsync,
  switchCompressionModeAsync
} from './utls/helpers';
import { downloadFilesAsync } from './utls/downloadHelper';
import { ImageFileDto } from './utls/ImageFileDto';

/**
 * E2E: AVIF settings mode → Set by File Size
 * - Select AVIF output
 * - Switch to "Set by File Size" mode
 * - Set a small target (e.g., 0.10 MB)
 * - Convert and then verify that a download link appears and downloaded file
 *   is present and does not exceed the selected target size.
 */

 test('AVIF Set by File Size mode produces downloadable file under target size', async ({ page }) => {
  await page.goto('/');

  const files: ImageFileDto[] = [new ImageFileDto('pexels-pealdesign-28594392.jpg')];
  const targetMB = 0.10;

  const targetBytes = Math.round(targetMB * 1024 * 1024);

  await setOutputFormatAsync(page, 'AVIF');
  await uploadFilesToDropzoneAsync(page, files);
  await assertFilesPresentInDropzoneAsync(page, files);

  // Switch AVIF settings mode to Set by File Size
  await switchCompressionModeAsync(page, 'size');

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
  expect(stat.size).toBeLessThanOrEqual(targetBytes + 4096); // +4KB tolerance

  expect(path.extname(downloadedPath).toLowerCase()).toBe('.avif');
});
