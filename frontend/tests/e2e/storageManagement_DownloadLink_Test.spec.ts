import { test, expect } from '@playwright/test';
import fs from 'fs';
import {
  uploadFilesToDropzoneAsync,
  assertFilesPresentInDropzoneAsync,
  clickConversionButtonAsync,
  assertZipButtonNotRenderedAsync,
  assertDownloadLinksAsync,
  clearStorageManagerAsync,
  assertCloseDrawerBtnClickAsync,
  openStorageManagerAsync,
  getStorageManagementDownloadLinkLocator,
  assertStorageManagerFileCountAsync
} from './utls/helpers';
import { downloadFilesAsync } from './utls/downloadHelper';
import { ImageFileDto } from './utls/ImageFileDto';



test('storage management download link allows downloading converted files', async ({ page, request }) => {
  await clearStorageManagerAsync(request);
  await page.goto('/');

  const files: ImageFileDto[] = [new ImageFileDto('pexels-pealdesign-28594392.jpg')];
  const expectedFileName = files[0].getExpectedOutputFileName();

  await uploadFilesToDropzoneAsync(page, files);
  await assertFilesPresentInDropzoneAsync(page, files);

  await clickConversionButtonAsync(page);
  await assertZipButtonNotRenderedAsync(page);
  await assertDownloadLinksAsync(page, files);
  await assertStorageManagerFileCountAsync(request, files.length);

  await assertCloseDrawerBtnClickAsync(page);

  await openStorageManagerAsync(page);
  const storageDownloadLinkLocator = getStorageManagementDownloadLinkLocator(page, expectedFileName);

  await expect(storageDownloadLinkLocator).toHaveCount(1);

  const downloadedPaths = await downloadFilesAsync(page, storageDownloadLinkLocator);
  expect(downloadedPaths.length).toBe(1);

  const downloadedPath = downloadedPaths[0];
  expect(fs.existsSync(downloadedPath)).toBeTruthy();
});
