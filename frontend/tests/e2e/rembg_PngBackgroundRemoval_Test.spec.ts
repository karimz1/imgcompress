import { test, expect } from '@playwright/test';
import {
  assertFilesPresentInDropzoneAsync,
  clickConversionButtonAsync,
  assertZipButtonNotRenderedAsync,
  assertDownloadLinksAsync,
  uploadFilesToDropzoneAsync,
  setOutputFormatAsync,
  setRembgEnabledAsync,
  AssertImageHasTransparentPixels,
} from './utls/helpers';
import { downloadFilesAndGetMetadataAsync } from './utls/downloadHelper';
import { ImageFileDto } from './utls/ImageFileDto';

test('should convert to PNG with AI background removal enabled', async ({ page }) => {
  await page.goto('/');
  const fileNames: ImageFileDto[] = [new ImageFileDto('pexels-pealdesign-28594392.jpg')];

  await uploadFilesToDropzoneAsync(page, fileNames);
  await assertFilesPresentInDropzoneAsync(page, fileNames);

  await setOutputFormatAsync(page, 'PNG');
  await setRembgEnabledAsync(page, true);

  await clickConversionButtonAsync(page);
  await assertZipButtonNotRenderedAsync(page);

  const fileItemLocator = await assertDownloadLinksAsync(page, fileNames);
  const downloads = await downloadFilesAndGetMetadataAsync(page, fileItemLocator);
  for (const { metadata, newFilePath } of downloads) {
    expect(metadata.format).toBe('png');
    expect(metadata.hasAlpha).toBeTruthy();
    await AssertImageHasTransparentPixels(newFilePath);
  }
});
