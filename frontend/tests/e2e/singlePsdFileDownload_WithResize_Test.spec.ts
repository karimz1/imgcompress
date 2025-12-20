import { test } from '@playwright';
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

test('should upload a PSD via drag-and-drop and verify the download functionality using resize width validation', async ({ page }) => {
  await page.goto('/');
  const desiredWidth: number = 600;
  const fileNames: ImageFileDto[] = [ new ImageFileDto("37443511_8499861.psd")];

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
