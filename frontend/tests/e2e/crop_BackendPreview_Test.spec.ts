import { expect, test } from '@playwright/test';
import { CROP_FIXTURES, bootCropPageAsync } from './utls/cropHelpers';
import { uploadFilesToDropzoneAsync } from './utls/helpers';
import { ImageFileDto } from './utls/ImageFileDto';

const BACKEND_BITMAP_FILES: ImageFileDto[] = [CROP_FIXTURES.psd, CROP_FIXTURES.eps];

for (const sample of BACKEND_BITMAP_FILES) {
  test(`crop modal: backend-rendered bitmap opens editor for ${sample.fileName}`, async ({ page }) => {
    await bootCropPageAsync(page, 'PNG');
    await uploadFilesToDropzoneAsync(page, [sample]);
    await expect(page.getByTestId('dropzone-added-file')).toContainText(
      sample.fileName
    );

    const bitmapResponsePromise = page.waitForResponse((response) => {
      const request = response.request();
      return (
        request.method() === 'POST' &&
        response.url().includes('/api/crop/bitmap') &&
        response.ok() &&
        (response.headers()['content-type'] ?? '').includes('image/png')
      );
    });

    await page.getByTestId('dropzone-crop-file-btn').first().click();
    await expect(page.getByTestId('crop-dialog')).toBeVisible();

    await bitmapResponsePromise;
    await expect(page.getByTestId('crop-width-input')).toBeVisible();
    await expect(page.getByTestId('crop-height-input')).toBeVisible();
    await expect(page.getByTestId('crop-dims-label')).toContainText('px');

    await page.getByTestId('crop-save-btn').click();
    await expect(page.getByTestId('crop-dialog')).toHaveCount(0);
    await expect(page.getByTestId('dropzone-crop-badge')).toContainText('cropped');
  });
}
