import { test, expect } from '@playwright/test';
import {
  uploadFilesToDropzoneAsync,
  assertFilesPresentInDropzoneAsync,
  clickConversionButtonAsync,
  assertDownloadLinksAsync,
  assertCloseDrawerBtnClickAsync,
  openStorageManagerAsync,
  getStorageManagementDownloadLinkLocator,
  clearStorageManagerAsync,
  assertStorageManagerFileCountAsync,
  setOutputFormatAsync,
  assertDownloadUnavailableDialogAsync,
} from './utls/helpers';
import { ImageFileDto } from './utls/ImageFileDto';

test.beforeEach(async ({ request }) => {
  await clearStorageManagerAsync(request);
  await assertStorageManagerFileCountAsync(request, 0);
});

// Same "file is gone" scenario as the drawer, but triggered from the Storage
// Manager download link. It must surface the identical dialog (asserted via the
// shared helper), not the raw JSON error.
test('storage manager download shows the file-unavailable dialog when the file was deleted', async ({ page, request }) => {
  await page.goto('/');
  const files: ImageFileDto[] = [new ImageFileDto('pexels-pealdesign-28594392.jpg')];
  const expectedFileName = files[0].getExpectedOutputFileName();

  await setOutputFormatAsync(page, 'JPEG');
  await uploadFilesToDropzoneAsync(page, files);
  await assertFilesPresentInDropzoneAsync(page, files);

  await clickConversionButtonAsync(page);
  await assertDownloadLinksAsync(page, files);
  await assertCloseDrawerBtnClickAsync(page);

  await openStorageManagerAsync(page);
  const storageDownloadLink = getStorageManagementDownloadLinkLocator(page, expectedFileName);
  await expect(storageDownloadLink).toHaveCount(1);

  // Delete the file on the backend while the (now stale) row is still displayed.
  await clearStorageManagerAsync(request);

  await storageDownloadLink.click();

  await assertDownloadUnavailableDialogAsync(page);
});
