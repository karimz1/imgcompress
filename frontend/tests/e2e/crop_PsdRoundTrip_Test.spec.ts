import { expect, test } from '@playwright/test';
import path from 'path';
import sharp from 'sharp';
import {
  bootCropPageAsync,
  CROP_FIXTURES,
} from './utls/cropHelpers';
import {
  clickConversionButtonAsync,
  uploadFilesToDropzoneAsync,
} from './utls/helpers';
import { downloadFilesAndGetMetadataAsync } from './utls/downloadHelper';

test('crop runs first: PSD round-trip through backend bitmap render + compress', async ({ page }) => {
  await bootCropPageAsync(page, 'PNG');
  await uploadFilesToDropzoneAsync(page, [CROP_FIXTURES.psd]);
  await expect(page.getByTestId('dropzone-added-file')).toContainText(
    CROP_FIXTURES.psd.fileName
  );

  await page.getByTestId('dropzone-crop-file-btn').first().click();
  await expect(page.getByTestId('crop-dialog')).toBeVisible();
  await expect(page.getByTestId('crop-width-input')).toBeVisible({ timeout: 60_000 });

  await page.getByTestId('crop-width-input').fill('480');
  await page.getByTestId('crop-height-input').fill('270');
  await page.getByTestId('crop-save-btn').click();
  await expect(page.getByTestId('dropzone-crop-badge')).toContainText('cropped');

  await clickConversionButtonAsync(page);

  const downloadLinks = page.locator('[data-testid="drawer-uploaded-file-item-link"]');
  await expect(downloadLinks).toHaveCount(1);
  const linkTexts = await downloadLinks.allTextContents();
  expect(
    linkTexts.some((t) => t.includes('_cropped') && t.toLowerCase().endsWith('.png'))
  ).toBe(true);

  const downloads = await downloadFilesAndGetMetadataAsync(page, downloadLinks);
  const meta: sharp.Metadata = downloads[0].metadata;
  expect(meta.format).toBe('png');
  expect(meta.width).toBe(480);
  expect(meta.height).toBe(270);
  expect(path.basename(downloads[0].newFilePath)).toContain('_cropped');
});
