import { test } from '@playwright/test';
import {
  assertFilesPresentInDropzoneAsync,
  setResizeWidthAsync,
  clickConversionButtonAsync,
  assertZipButtonNotRenderedAsync,
  assertDownloadLinksAsync,
  AssertImageWidth,
  uploadFilesToDropzoneAsync,
} from './utls/helpers';
import { downloadFilesAndGetMetadataAsync } from './utls/downloadHelper';
import { ImageFileDto } from './utls/ImageFileDto';

test('should upload a file via drag-and-drop and verify the download functionality using resize width validation', async ({ page }) => {
  await page.goto('/');
  const desiredWidth: number = 600;
  const fileNames: ImageFileDto[] = [ new ImageFileDto("pexels-pealdesign-28594392.jpg")];

  await uploadFilesToDropzoneAsync(page, fileNames);
  await assertFilesPresentInDropzoneAsync(page, fileNames);

  await setResizeWidthAsync(page, desiredWidth);
  
  await clickConversionButtonAsync(page);
  await assertZipButtonNotRenderedAsync(page);

  
  const fileItemLocator = await assertDownloadLinksAsync(page, fileNames);
  const downloads = await downloadFilesAndGetMetadataAsync(page, fileItemLocator);
  for (const { metadata } of downloads) {
    AssertImageWidth(desiredWidth, metadata);
  }
});
