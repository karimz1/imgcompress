import { test } from '@playwright/test';
import {
  assertFilesPresentInDropzoneAsync,
  clickConversionButtonAsync,
  assertDownloadLinksAsync,
  clearStorageManagerAsync,
  uploadFilesToDropzoneAsync,
  setOutputFormatAsync,
  assertDownloadUnavailableDialogAsync,
} from './utls/helpers';
import { ImageFileDto } from './utls/ImageFileDto';

// Scenario: a user compresses a file, the compressed output is deleted from the
// container, and then they click the download link in the compressed-files
// drawer. Instead of navigating to the raw {"error":"File not available."}
// JSON, they should see the friendly "file no longer here" dialog.
test('drawer download shows the file-unavailable dialog when the file was deleted', async ({ page, request }) => {
  await page.goto('/');
  const files: ImageFileDto[] = [new ImageFileDto('pexels-pealdesign-28594392.jpg')];

  await setOutputFormatAsync(page, 'JPEG');
  await uploadFilesToDropzoneAsync(page, files);
  await assertFilesPresentInDropzoneAsync(page, files);

  await clickConversionButtonAsync(page);
  const downloadLinks = await assertDownloadLinksAsync(page, files);

  // Delete the compressed output on the backend so the link now points at nothing.
  await clearStorageManagerAsync(request);

  await downloadLinks.first().click();

  await assertDownloadUnavailableDialogAsync(page);
});
