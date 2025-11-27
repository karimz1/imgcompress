import { test } from '@playwright/test';
import {
  assertFilesPresentInDropzoneAsync,
  clickConversionButtonAsync,
  clickDownloadZipButtonAndGetUrlAsync,
  assertZipContentAsync,
  assertDownloadLinksAsync,
  AssertImageWidth,
  setResizeWidthAsync,
  uploadFilesToDropzoneAsync,
} from './utls/helpers';
import { downloadFilesAndGetMetadataAsync } from './utls/downloadHelper';
import { ImageFileDto } from './utls/ImageFileDto';

test('should upload two files, verify individual downloads by clicking and ZIP download availability, with resize-width', async ({ page }) => {
  await page.goto('/');
  const desiredWidth: number = 400;
  const imageFileNames: ImageFileDto[] = [
    new ImageFileDto("pexels-pealdesign-28594392.jpg"),
    new ImageFileDto("pexels-willianjusten-29944187.jpg"),
    new ImageFileDto("IMG_0935.heic"),
    new ImageFileDto("vecteezy_new-update-logo-template-illustration_5412356-0.eps"),
    new ImageFileDto("37443511_8499861.psd")
  ];

  await uploadFilesToDropzoneAsync(page, imageFileNames);
  await setResizeWidthAsync(page, desiredWidth);
  await assertFilesPresentInDropzoneAsync(page, imageFileNames);

  await clickConversionButtonAsync(page);

  const zipDownloadPath: string = await clickDownloadZipButtonAndGetUrlAsync(page);
  await assertZipContentAsync(zipDownloadPath, imageFileNames);

  
  const fileItemLocator = await assertDownloadLinksAsync(page, imageFileNames);
  const downloads = await downloadFilesAndGetMetadataAsync(page, fileItemLocator);
  for (const { metadata } of downloads) {
    AssertImageWidth(desiredWidth, metadata);
  }
});
