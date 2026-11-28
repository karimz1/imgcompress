import { test } from '@playwright/test';
import {
  assertFilesPresentInDropzoneAsync,
  setResizeWidthAsync,
  clickConversionButtonAsync,
  assertZipButtonNotRenderedAsync,
  assertDownloadLinksAsync,
  AssertImageWidth,
  AssertDownloadsIsEqualsToSourceImageWidth,
  uploadFilesToDropzoneAsync,
  setOutputFormatAsync,
} from './utls/helpers';
import { downloadFilesAndGetMetadataAsync } from './utls/downloadHelper';
import { ImageFileDto } from './utls/ImageFileDto';

test.describe('Camera RAW input', () => {
  test('converts a DNG to JPEG at the requested width', async ({ page }) => {
    await page.goto('/');
    const desiredWidth = 600;
    const fileNames: ImageFileDto[] = [new ImageFileDto('apple-iphone-xs.dng')];
    await setOutputFormatAsync(page, 'JPEG');
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

  test('converts a CR3 and a NEF together at their full size', async ({ page }) => {
    await page.goto('/');
    const fileNames: ImageFileDto[] = [
      new ImageFileDto('canon-eos-r6.cr3', 3407),
      new ImageFileDto('nikon-d70s.nef', 3039),
    ];
    await setOutputFormatAsync(page, 'JPEG');
    await uploadFilesToDropzoneAsync(page, fileNames);
    await assertFilesPresentInDropzoneAsync(page, fileNames);

    await clickConversionButtonAsync(page);

    const fileItemLocator = await assertDownloadLinksAsync(page, fileNames);
    const downloads = await downloadFilesAndGetMetadataAsync(page, fileItemLocator);
    AssertDownloadsIsEqualsToSourceImageWidth(downloads, fileNames);
  });
});
